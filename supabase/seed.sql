-- ============================================================
-- Allowlist seed — IOWN investment team
-- ============================================================
-- Only emails listed here can sign in and use the dashboard.
--
-- IMPORTANT: replace every "lastname" placeholder below with each
-- teammate's REAL Google account email before deploying. The email
-- must match their Google sign-in address exactly (case-insensitive).
--
-- Add a teammate later with:
--   insert into allowed_users (email) values ('first.last@paradiem.org')
--   on conflict (email) do nothing;
-- Remove one with:
--   delete from allowed_users where email = 'first.last@paradiem.org';
-- ============================================================

insert into allowed_users (email) values
  ('carson.rich@paradiem.org'),         -- Carson (confirmed)
  ('eric.lastname@paradiem.org'),       -- TODO: replace "lastname"
  ('raymarie.lastname@paradiem.org'),   -- TODO: replace "lastname" (Ray Marie)
  ('matthew.lastname@paradiem.org'),    -- TODO: replace "lastname"
  ('drew.lastname@paradiem.org'),       -- TODO: replace "lastname"
  ('dom.lastname@paradiem.org')         -- TODO: replace "lastname"
on conflict (email) do nothing;
