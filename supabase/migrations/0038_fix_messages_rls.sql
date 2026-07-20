-- Fix messages RLS: tech ids are text; cast current_tech_id() like other tables.
-- Without ::text, owner-authenticated SELECTs can return no rows while the
-- client token path (service role) still works.

drop policy if exists messages_owner on public.messages;
create policy messages_owner on public.messages
  for all
  using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);

-- Same cast fix for service add-ons (same pattern in 0005).
drop policy if exists service_addons_owner on public.service_addons;
create policy service_addons_owner on public.service_addons
  for all
  using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);
