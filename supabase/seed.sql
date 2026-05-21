-- ============================================================
-- Allowlist seed — IOWN investment team
-- ============================================================
-- Only emails listed here can create an account and use the dashboard.
--
-- VERIFY every address below before running this. They were derived from
-- the pattern firstname.lastname@paradiem.org and must match each
-- person's real email EXACTLY (matching is case-insensitive) or that
-- person's sign-up will fail.
--
-- Add a teammate later with:
--   insert into allowed_users (email) values ('first.last@paradiem.org')
--     on conflict (email) do nothing;
-- Remove one with:
--   delete from allowed_users where email = 'first.last@paradiem.org';
-- ============================================================

insert into allowed_users (email) values
  ('carson.rich@paradiem.org'),      -- Carson Rich (confirmed)
  ('matthew.sullivan@paradiem.org'), -- Matthew Sullivan
  ('eric.dunavant@paradiem.org'),    -- Eric Dunavant
  ('drew.brown@paradiem.org'),       -- Drew Brown
  ('domnic.davenport@paradiem.org'), -- Domnic Davenport
  ('raymarie.fenger@paradiem.org'),  -- RayMarie Fenger
  ('gavin.morel@paradiem.org')       -- Gavin Morel
on conflict (email) do nothing;
