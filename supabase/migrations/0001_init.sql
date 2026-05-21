-- ============================================================
-- IOWN Trade Instructions Dashboard — initial schema
-- Run this in the Supabase SQL Editor (or via the Supabase CLI).
-- ============================================================

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------

create table if not exists clients (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  household_name text,
  created_at     timestamptz not null default now()
);

create table if not exists accounts (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null references clients(id) on delete cascade,
  account_number_last4 text not null,
  registration         text,   -- "Community Property", "IRA", "Custodial", "Individual"
  model                text    -- "7T", "7A", "C", "BT", etc.
);

create table if not exists instructions (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  title        text not null,
  description  text,
  owner        text,           -- "Ray Marie", "Matthew", "Carson", "Eric", "Drew", "Dom"
  status       text not null default 'open'
               check (status in ('open', 'in_progress', 'done', 'blocked')),
  source       text not null default 'manual'
               check (source in ('manual', 'screenshot', 'meeting_notes')),
  raw_text     text,           -- original instruction text (audit trail)
  meeting_date date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists instruction_steps (
  id             uuid primary key default gen_random_uuid(),
  instruction_id uuid not null references instructions(id) on delete cascade,
  step_order     int not null,
  description    text not null,
  status         text not null default 'open' check (status in ('open', 'done')),
  completed_by   text,
  completed_at   timestamptz
);

create table if not exists activity_log (
  id             uuid primary key default gen_random_uuid(),
  instruction_id uuid references instructions(id) on delete cascade,
  user_email     text not null,
  action         text not null,  -- "created", "status_change", "owner_change", "step_done", "note"
  note           text,
  created_at     timestamptz not null default now()
);

create table if not exists allowed_users (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

create index if not exists idx_instructions_client  on instructions(client_id);
create index if not exists idx_instructions_status  on instructions(status);
create index if not exists idx_instructions_updated on instructions(updated_at);
create index if not exists idx_steps_instruction    on instruction_steps(instruction_id);
create index if not exists idx_activity_instruction on activity_log(instruction_id);
create index if not exists idx_accounts_client      on accounts(client_id);

-- ------------------------------------------------------------
-- Helper functions
-- ------------------------------------------------------------

-- True when the current request's JWT email is on the allowlist.
-- SECURITY DEFINER so it can read allowed_users regardless of RLS.
create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_users
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- Best-effort actor for audit rows ("system" when run by the service role).
create or replace function public.current_actor()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', 'system');
$$;

-- ------------------------------------------------------------
-- Triggers: keep updated_at / completed_at fresh
-- ------------------------------------------------------------

create or replace function public.instructions_before_update()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_instructions_before_update on public.instructions;
create trigger trg_instructions_before_update
  before update on public.instructions
  for each row execute function public.instructions_before_update();

create or replace function public.steps_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := now();
    new.completed_by := public.current_actor();
  elsif new.status = 'open' then
    new.completed_at := null;
    new.completed_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_steps_before_update on public.instruction_steps;
create trigger trg_steps_before_update
  before update on public.instruction_steps
  for each row execute function public.steps_before_update();

-- Any change to a step bumps the parent instruction's updated_at,
-- so step activity surfaces it on the "stalest first" home view.
create or replace function public.steps_touch_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  iid uuid := coalesce(new.instruction_id, old.instruction_id);
begin
  update public.instructions set updated_at = now() where id = iid;
  if (tg_op = 'DELETE') then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_steps_touch_parent on public.instruction_steps;
create trigger trg_steps_touch_parent
  after insert or update or delete on public.instruction_steps
  for each row execute function public.steps_touch_parent();

-- ------------------------------------------------------------
-- Triggers: append to activity_log
-- ------------------------------------------------------------

create or replace function public.log_instruction_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text := public.current_actor();
begin
  if (tg_op = 'INSERT') then
    insert into public.activity_log(instruction_id, user_email, action, note)
    values (new.id, actor, 'created', new.title);
  elsif (tg_op = 'UPDATE') then
    if new.status is distinct from old.status then
      insert into public.activity_log(instruction_id, user_email, action, note)
      values (new.id, actor, 'status_change', old.status || ' -> ' || new.status);
    end if;
    if new.owner is distinct from old.owner then
      insert into public.activity_log(instruction_id, user_email, action, note)
      values (new.id, actor, 'owner_change',
              coalesce(old.owner, 'Unassigned') || ' -> ' || coalesce(new.owner, 'Unassigned'));
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_log_instruction_activity on public.instructions;
create trigger trg_log_instruction_activity
  after insert or update on public.instructions
  for each row execute function public.log_instruction_activity();

create or replace function public.log_step_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text := public.current_actor();
begin
  if (tg_op = 'UPDATE') and (new.status is distinct from old.status) then
    insert into public.activity_log(instruction_id, user_email, action, note)
    values (new.instruction_id, actor,
            case when new.status = 'done' then 'step_done' else 'step_reopened' end,
            new.description);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_log_step_activity on public.instruction_steps;
create trigger trg_log_step_activity
  after update on public.instruction_steps
  for each row execute function public.log_step_activity();

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------

alter table clients           enable row level security;
alter table accounts          enable row level security;
alter table instructions      enable row level security;
alter table instruction_steps enable row level security;
alter table activity_log      enable row level security;
alter table allowed_users     enable row level security;

-- A signed-in user may read ONLY their own allowlist row (powers the auth gate).
drop policy if exists "read own allowlist row" on allowed_users;
create policy "read own allowlist row"
  on allowed_users for select
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Every other table: full read/write for allowlisted users only.
drop policy if exists "allowlisted full access" on clients;
create policy "allowlisted full access" on clients
  for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

drop policy if exists "allowlisted full access" on accounts;
create policy "allowlisted full access" on accounts
  for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

drop policy if exists "allowlisted full access" on instructions;
create policy "allowlisted full access" on instructions
  for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

drop policy if exists "allowlisted full access" on instruction_steps;
create policy "allowlisted full access" on instruction_steps
  for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

drop policy if exists "allowlisted full access" on activity_log;
create policy "allowlisted full access" on activity_log
  for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

-- ------------------------------------------------------------
-- Realtime: publish instructions + steps so the team sees live updates
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'instructions'
  ) then
    alter publication supabase_realtime add table public.instructions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'instruction_steps'
  ) then
    alter publication supabase_realtime add table public.instruction_steps;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'activity_log'
  ) then
    alter publication supabase_realtime add table public.activity_log;
  end if;
end $$;
