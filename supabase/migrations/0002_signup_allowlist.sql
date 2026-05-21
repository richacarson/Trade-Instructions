-- ============================================================
-- Sign-in: email + password, locked to the allowlist
-- Run this in the Supabase SQL Editor AFTER 0001_init.sql.
-- ============================================================

-- Lightweight check the sign-up form calls before creating an account,
-- so a non-approved email gets a clear message instead of a raw error.
create or replace function public.is_email_allowed(check_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_users
    where lower(email) = lower(check_email)
  );
$$;

grant execute on function public.is_email_allowed(text) to anon, authenticated;

-- Hard enforcement: block account creation for any email that is not on
-- the allowlist. This runs inside the sign-up transaction, so a
-- non-approved sign-up fails and no account is ever created.
create or replace function public.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or not exists (
    select 1 from public.allowed_users
    where lower(email) = lower(new.email)
  ) then
    raise exception 'Email % is not authorized to use this app', new.email
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_signup_allowlist on auth.users;
create trigger trg_enforce_signup_allowlist
  before insert on auth.users
  for each row execute function public.enforce_signup_allowlist();
