begin;
-- New originals must go through a signed quarantine path and server validation.
-- Final writes are service-only; authenticated admins retain private read access.
drop policy portfolio_admin_upload on storage.objects;
commit;
