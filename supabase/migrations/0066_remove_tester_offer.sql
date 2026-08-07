-- The private tester offer (£1 first month via /tester) has been retired.
-- Clear the frozen "tester" signup offer from any remaining accounts so they
-- follow the standard offer rules (paywall, checkout coupons, admin labels).
update public.techs set "signupOffer" = '' where "signupOffer" = 'tester';
