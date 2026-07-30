-- push_subscriptions / push_queue had RLS enabled in 0063 with no policies,
-- so salon-owner (authenticated) writes were denied and subscribe failed with
-- a generic client error. Match the standard per-tech owner policy.

drop policy if exists push_subscriptions_owner on public.push_subscriptions;
create policy push_subscriptions_owner on public.push_subscriptions
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);

drop policy if exists push_queue_owner on public.push_queue;
create policy push_queue_owner on public.push_queue
  for all using ("techId" = current_tech_id()::text)
  with check ("techId" = current_tech_id()::text);
