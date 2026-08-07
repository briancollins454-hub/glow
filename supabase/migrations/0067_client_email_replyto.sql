-- Client-facing emails now always carry a replyTo (the salon's address, or
-- the platform inbox as a chased fallback). Record it on outbound_sends so
-- audits like scripts/report-client-replyto.mjs can measure coverage.
alter table public.outbound_sends add column if not exists "replyTo" text;

-- Inbound replies are now matched to the salon the thread relates to and
-- forwarded there; record where each forward went and which salon matched.
alter table public.inbound_forwards add column if not exists "forwardedTo" text;
alter table public.inbound_forwards add column if not exists "matchedTechId" text;
