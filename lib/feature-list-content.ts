/** Marketing reference content for the Glow feature guide PDF. */

export type MarketingFeature = {
  id: string;
  name: string;
  /** Short poster / reel headline */
  headline: string;
  /** One sentence for captions */
  tagline: string;
  category: string;
  pain: string;
  whatItIs: string;
  howItWorks: string;
  benefits: string[];
  marketingHooks: string[];
  whereInApp: string;
  competitorAngle?: string;
};

export type MarketingChapter = {
  id: string;
  title: string;
  subtitle: string;
  intro: string;
  features: MarketingFeature[];
};

export const POSITIONING = {
  oneLiner:
    "Glow is the booking system built for self-employed UK lash, nail and brow techs — your page, your clients, zero commission.",
  elevator:
    "A flat-fee (£19/mo), branded booking platform with beauty-specific rules built in: patch test gating, infill timing, deposits straight to your bank via Stripe Connect, automatic reminders, compliance records, and tools that protect your diary — without a marketplace poaching your regulars.",
  audience: "Self-employed lash, nail and brow technicians in the UK",
  pricing: "£9.50 first month, then £19/mo (or £180/year). 0% commission on all client payments.",
  pillars: [
    {
      title: "Your money, your clients",
      body: "No marketplace. No commission. Deposits and balances go to your bank via Stripe Connect. Clients book your branded page — not a directory next to your competitors.",
    },
    {
      title: "Rules that understand beauty work",
      body: "Patch tests, infills, product changes, reaction follow-ups — enforced automatically so bad bookings never land in your diary.",
    },
    {
      title: "Admin that runs itself",
      body: "Confirmations, reminders, balance links, aftercare, reviews, rebooking nudges, waitlist alerts, pre-care, and late-running cascades — sent without you chasing anyone.",
    },
    {
      title: "Proof when it matters",
      body: "Records, batches, reactions, consultation answers, and one-click evidence packs — built for insurers and claims, not just convenience.",
    },
  ],
};

export const CHAPTERS: MarketingChapter[] = [
  {
    id: "brand",
    title: "Your brand & booking page",
    subtitle: "The link in your bio — yours alone",
    intro:
      "Every tech gets a branded mini-site at glow-uk.com/yourname. This is your shop window, checkout, and client portal — without Fresha or Booksy branding, upsells, or competitor listings.",
    features: [
      {
        id: "branded-page",
        name: "Branded public booking page",
        headline: "Your bio link. Your brand. Not a marketplace.",
        tagline: "A mini-site at glow-uk.com/yourname — services, photos, reviews, and Book now.",
        category: "Brand",
        pain: "Marketplace links put your business next to rival salons and train clients to shop around.",
        whatItIs:
          "A mobile-first booking page with your business name, bio, location, brand colour, banner, profile photo, gallery, opening hours, and approved reviews.",
        howItWorks:
          "Set up branding in Settings. Share one permanent link in Instagram, TikTok, WhatsApp, and Google Business. Clients book without creating an account.",
        benefits: [
          "Looks professional without building a website",
          "Sticky Book now CTA on mobile",
          "Instagram and TikTok links built in",
          "No competitor listings underneath your services",
        ],
        marketingHooks: [
          "Stop sending clients to a page that shows your competitors.",
          "One link for your bio. Done.",
          "Your salon, your colours, your reviews — not theirs.",
        ],
        whereInApp: "Settings → Brand & profile · Public page at /{handle}",
        competitorAngle: "Fresha/booksy marketplace pages vs your own branded URL",
      },
      {
        id: "service-menu",
        name: "Service menu, categories & add-ons",
        headline: "Your full menu. Priced how you want.",
        tagline: "Categories, durations, deposits, photos, and optional add-ons at checkout.",
        category: "Brand",
        pain: "DMing prices back and forth wastes time and loses bookings.",
        whatItIs:
          "Organise services by category (Lashes, Brows, Nails). Each service has price, duration, deposit rules, optional photo, aftercare text, and pre-care instructions.",
        howItWorks:
          "Add services in Dashboard → Services. Drag to reorder. Add-ons (e.g. brow tint upgrade) appear at checkout. Clients see clear pricing before they pick a slot.",
        benefits: [
          "No more 'how much is an infill?' DMs",
          "Add-ons increase average ticket without awkward upselling",
          "Per-service deposit control",
        ],
        marketingHooks: [
          "Your menu, your prices, your add-ons — live 24/7.",
          "Clients see the price before they slide into your DMs.",
        ],
        whereInApp: "Dashboard → Services",
      },
      {
        id: "real-availability",
        name: "Real-time availability",
        headline: "Only show slots you can actually do.",
        tagline: "Live diary slots in 15-minute steps — respects hours, time off, and existing bookings.",
        category: "Brand",
        pain: "Double bookings and back-and-forth scheduling eat your evenings.",
        whatItIs:
          "Clients only see genuinely free times based on your working hours, time off, service duration, and what's already in the diary.",
        howItWorks:
          "Set opening hours and block time off. When a client books, the slot is held. Google Calendar sync keeps everything aligned.",
        benefits: [
          "No double bookings",
          "Clients self-serve times that work",
          "Less WhatsApp ping-pong",
        ],
        marketingHooks: [
          "Your diary updates itself when someone books.",
          "Clients pick a real slot — you don't play calendar Tetris.",
        ],
        whereInApp: "Dashboard → Opening hours · Dashboard → Calendar",
      },
      {
        id: "consultation-forms",
        name: "Consultation forms",
        headline: "Know the allergies before they sit in your chair.",
        tagline: "Custom questions at checkout — allergies, medical history, preferences.",
        category: "Brand",
        pain: "Finding out about a sensitivity mid-appointment is dangerous and stressful.",
        whatItIs:
          "Build a consultation form with short text, long text, and yes/no questions. Answers are stored on the client profile.",
        howItWorks:
          "Add questions in Dashboard → Forms. They appear during online booking before payment. Responses show on the client record and in evidence packs.",
        benefits: [
          "Paperless consultation record",
          "Answers attached to the client forever",
          "Supports insurance and dispute resolution",
        ],
        marketingHooks: [
          "Consultation form built in — not a separate app.",
          "Ask what you need, every time they book.",
        ],
        whereInApp: "Dashboard → Forms · Client profile → Consultation answers",
      },
      {
        id: "reviews-public",
        name: "Reviews on your page",
        headline: "Social proof you control.",
        tagline: "Request reviews after appointments — approve before they go live.",
        category: "Brand",
        pain: "Fake Google reviews or no reviews at all hurts trust.",
        whatItIs:
          "After you mark an appointment completed, the client gets a review request. You approve star ratings before they appear on your booking page.",
        howItWorks:
          "Complete a booking → automatic review email. New reviews land in Dashboard → Reviews. Toggle 'Show on my page' for the ones you want public.",
        benefits: [
          "Only show reviews you're proud of",
          "Fresh social proof on your booking link",
          "No manual chasing for testimonials",
        ],
        marketingHooks: [
          "Reviews that land on your booking page — not lost in DMs.",
          "You approve what the world sees.",
        ],
        whereInApp: "Dashboard → Reviews",
      },
    ],
  },
  {
    id: "rules",
    title: "Smart booking rules",
    subtitle: "Stop bad bookings before they land",
    intro:
      "Generic booking tools treat every appointment the same. Glow enforces the rules lash, nail and brow techs actually live by — patch tests, infills, blocked clients, and approval before payment.",
    features: [
      {
        id: "patch-test-gating",
        name: "Patch test gating",
        headline: "No valid patch test? They can't book online.",
        tagline: "Services that need a patch test are blocked until you record a pass.",
        category: "Rules",
        pain: "A client books a lash lift online without a test — you're exposed and have to cancel awkwardly.",
        whatItIs:
          "Flag services as requiring a patch test. The booking flow checks for a valid pass in that category (not expired, with minimum lead time before the appointment).",
        howItWorks:
          "Set patch test rules per category (validity months, minimum hours before treatment). Record pass/fail on the client profile. Expired tests block booking until you log a new one.",
        benefits: [
          "Insurance-aligned records",
          "No workaround for clients online",
          "Clear message to the client on why they're blocked",
        ],
        marketingHooks: [
          "If they haven't had a patch test, they can't book a lash lift. Full stop.",
          "Patch tests aren't admin — they're your insurance paperwork.",
          "Glow blocks the booking so you don't have to.",
        ],
        whereInApp: "Dashboard → Services (per category) · Dashboard → Clients → Patch tests",
        competitorAngle: "Fresha, Booksy and Square don't block bookings on patch test status",
      },
      {
        id: "infill-rules",
        name: "Infill booking rules",
        headline: "Stop new clients booking your £35 infill.",
        tagline: "Infills are returning clients only — within your rebooking window.",
        category: "Rules",
        pain: "New clients book an infill to get a cheap full set. You lose money and time.",
        whatItIs:
          "Mark a service as an infill. Clients need a completed visit in the same category within your max gap days (e.g. 21 days).",
        howItWorks:
          "Link infill services to categories and set the window. If the client is new or too late, they're nudged to book a full set instead.",
        benefits: [
          "Protects full-set pricing",
          "Encourages regular rebooking",
          "Works automatically — no manual checking",
        ],
        marketingHooks: [
          "Infills for regulars only. Glow enforces it.",
          "No more 'can I just get an infill?' from brand-new clients.",
        ],
        whereInApp: "Dashboard → Services → Infill settings",
        competitorAngle: "Unique to Glow among major UK booking platforms",
      },
      {
        id: "blocked-clients",
        name: "Blocked & flagged clients",
        headline: "Problem clients can't book you again online.",
        tagline: "Block list plus private warning notes and no-show badges on every profile.",
        category: "Rules",
        pain: "Repeat no-shows and difficult clients keep slipping back through online booking.",
        whatItIs:
          "Block a client from online booking, add a private warning note only you see, and track no-show count with visible badges.",
        howItWorks:
          "Open the client in Dashboard → Clients. Tick 'Block from booking online' or add a warning. Blocked clients hit a wall on your public page.",
        benefits: [
          "Protect your diary without awkward confrontations",
          "See risk before you accept a manual booking",
          "No-show history follows the client",
        ],
        marketingHooks: [
          "Blocked means blocked — not 'we'll try to stop them'.",
          "See no-show history before you reply to a DM.",
        ],
        whereInApp: "Dashboard → Clients → Client profile",
      },
      {
        id: "booking-approval",
        name: "Booking approval",
        headline: "You approve before any deposit is taken.",
        tagline: "Manual or rules-based — new client at a weird hour? Your call.",
        category: "Rules",
        pain: "Auto-confirm means risky bookings are locked in before you've seen them.",
        whatItIs:
          "Booking requests can wait for your approval. Client gets a pending page; you approve or decline from the dashboard or email link.",
        howItWorks:
          "Turn on manual approval or rules mode in Settings. In rules mode, trusted returning clients auto-approve; new or risky ones wait for you.",
        benefits: [
          "No surprise bookings",
          "Decline without refund hassle — no deposit taken yet",
          "Control without turning off online booking",
        ],
        marketingHooks: [
          "Approve or decline before money changes hands.",
          "New client, odd time slot? You decide.",
        ],
        whereInApp: "Dashboard → Settings → Booking approval · /approve/{token}",
        competitorAngle: "Most marketplaces auto-confirm; Glow gives you the gate",
      },
      {
        id: "risk-deposits",
        name: "Risk-tiered deposits (Feature 2)",
        headline: "Bigger deposit when the risk is higher.",
        tagline: "Low, medium and high risk tiers — deposit % scales automatically.",
        category: "Rules",
        pain: "A 30% deposit doesn't hurt a serial no-show enough.",
        whatItIs:
          "Glow scores each client (new, no-show history, warning notes, VIP status, visit count) and adjusts deposit % accordingly.",
        howItWorks:
          "Set medium and high deposit tiers in Settings (e.g. 50% and 100%). Trusted regulars pay your normal deposit; flagged clients pay more.",
        benefits: [
          "No-show protection that actually bites",
          "VIP and regulars aren't punished",
          "Works with rules-based approval",
        ],
        marketingHooks: [
          "Same booking page — smarter deposits for risky clients.",
          "Your regulars pay less. Repeat no-shows pay more.",
        ],
        whereInApp: "Dashboard → Settings → Protection policy",
      },
      {
        id: "paired-patch-test",
        name: "Paired patch test bookings (Feature 3)",
        headline: "Book the patch test and the treatment together.",
        tagline: "One flow — test slot plus treatment slot, linked in the diary.",
        category: "Rules",
        pain: "Clients book the treatment but forget the test, or book the test and never return.",
        whatItIs:
          "Mark a service as a patch test service. When a client needs a test, they book the test appointment and treatment appointment in one online flow.",
        howItWorks:
          "Enable paired booking on qualifying services. The rules engine ensures correct lead time between test and treatment. Both appear in your calendar.",
        benefits: [
          "Fewer dropped conversions",
          "Correct spacing enforced automatically",
          "Less admin chasing for the second booking",
        ],
        marketingHooks: [
          "Patch test + appointment in one booking — not two DMs.",
          "Stop losing clients between test day and treatment day.",
        ],
        whereInApp: "Dashboard → Services → Patch test service toggle",
      },
      {
        id: "loyalty-vip",
        name: "Loyalty discount & VIP",
        headline: "Reward your regulars automatically.",
        tagline: "Discount after N visits — VIPs always qualify.",
        category: "Rules",
        pain: "Manually discounting loyal clients is easy to forget or inconsistent.",
        whatItIs:
          "Set a visit threshold and discount %. VIP-flagged clients always get the loyalty rate. Discount applies at online and manual booking.",
        howItWorks:
          "Configure in Settings. Completed visit count is tracked per client. Discount shows in the booking total automatically.",
        benefits: [
          "Retention without coupon codes",
          "VIP flag for your best clients",
          "Transparent pricing at checkout",
        ],
        marketingHooks: [
          "Your regulars get rewarded — automatically.",
          "Loyalty built in, not a spreadsheet.",
        ],
        whereInApp: "Dashboard → Settings → Loyalty · Client profile → VIP",
      },
      {
        id: "waitlist",
        name: "Waitlist",
        headline: "Fully booked? Capture the demand.",
        tagline: "Clients join the list — emailed automatically when a slot opens.",
        category: "Rules",
        pain: "You turn people away when you're full and never hear from them again.",
        whatItIs:
          "When no slots are available, clients can join a waitlist for a specific date or any date. On cancellation, waiting clients get an email.",
        howItWorks:
          "Client joins waitlist on the booking page. When you cancel a booking, Glow emails up to 10 waiting clients with a book-now link.",
        benefits: [
          "Fill gaps without posting 'who wants it?' stories",
          "Capture demand you'd otherwise lose",
          "First-come urgency on opened slots",
        ],
        marketingHooks: [
          "Fully booked doesn't mean fully lost.",
          "Cancel a client — the waitlist fills the gap.",
        ],
        whereInApp: "Public booking page · Automatic on cancellation",
      },
    ],
  },
  {
    id: "payments",
    title: "Payments & protection",
    subtitle: "Your money straight to your bank",
    intro:
      "Glow never holds client money. Stripe Connect sends deposits and balance payments directly to your bank. No-show and cancellation rules are enforced automatically.",
    features: [
      {
        id: "stripe-connect",
        name: "Stripe Connect — deposits to your bank",
        headline: "0% commission. Straight to your bank.",
        tagline: "Connect Stripe once — card payments land in your account, not ours.",
        category: "Payments",
        pain: "Platforms take commission and sometimes delay payouts.",
        whatItIs:
          "Stripe Connect onboarding in the dashboard. Clients pay deposits and balances by card; funds go to your connected bank account.",
        howItWorks:
          "Dashboard → Get paid → Connect Stripe. Once verified, online bookings can take card deposits. Glow's subscription is separate — never a cut of client payments.",
        benefits: [
          "0% commission on every booking",
          "Professional card checkout for clients",
          "You own the Stripe relationship",
        ],
        marketingHooks: [
          "Your money. Your bank. Not ours.",
          "£19/mo flat — not 20% of your Instagram clients.",
          "Deposits included. No £40 plan upsell.",
        ],
        whereInApp: "Dashboard → Get paid",
        competitorAngle: "vs Fresha 20% marketplace fee, Booksy Boost 30%",
      },
      {
        id: "deposits-config",
        name: "Deposits & no-show protection",
        headline: "Another no-show? Not on Glow.",
        tagline: "Take a deposit on every booking — or save a card and charge no-shows instead.",
        category: "Payments",
        pain: "No-shows and late cancellations mean working for free.",
        whatItIs:
          "Two protection modes: per-service deposits (% or fixed) that forfeit when rules are broken, or card-on-file — clients save a card at booking (nothing charged) and your no-show fee is charged to it if they don't turn up. Configurable cancellation window and no-show fee.",
        howItWorks:
          "Pick deposit or card-on-file in Settings, set defaults, override deposits per service. Mark no-show or cancel in Calendar — Glow applies forfeit/refund logic or charges the saved card. No-show count increments on the client.",
        benefits: [
          "Skin in the game for every client",
          "Automatic forfeit or card charge — no awkward chasing",
          "Clear policy shown at booking",
          "No-deposit booking pages still stay protected",
        ],
        marketingHooks: [
          "Stop working for free.",
          "Take a deposit. Set your window. Keep it when they no-show.",
          "Another no-show? Their deposit stays with you.",
          "No deposit? No problem — charge the saved card when they ghost.",
        ],
        whereInApp: "Dashboard → Settings · Dashboard → Calendar → Booking actions",
      },
      {
        id: "balance-link",
        name: "Pay balance link",
        headline: "Get paid before they walk in.",
        tagline: "Clients pay the remaining balance from a secure link before the appointment.",
        category: "Payments",
        pain: "Chasing 'can you transfer the rest?' on the day is awkward and slow.",
        whatItIs:
          "Each booking has a balance due amount and a tokenised pay link. Sent automatically by reminder email/SMS.",
        howItWorks:
          "After deposit, balance is tracked as unpaid/paid/refunded. Reminder scheduler sends the link before the appointment. You can also record cash/card in person.",
        benefits: [
          "Less day-of payment friction",
          "Outstanding balance visible on dashboard home",
          "Card or cash — you choose",
        ],
        marketingHooks: [
          "Balance link in their inbox — not a awkward convo at the door.",
          "See what's still owed before they arrive.",
        ],
        whereInApp: "Dashboard → Home (outstanding) · /pay/{token}",
      },
      {
        id: "income-reports",
        name: "Income & tax reports",
        headline: "Self Assessment without the spreadsheet panic.",
        tagline: "Income dashboard, CSV export, and UK tax-year PDF pack.",
        category: "Payments",
        pain: "January tax panic with payments scattered across apps and bank statements.",
        whatItIs:
          "Dashboard showing total income, deposits, balances, forfeited amounts, monthly breakdown, and per-service revenue. Export CSV or download a tax pack PDF per UK tax year.",
        howItWorks:
          "Payments are recorded per booking. Reports page shows live totals. Tax pack PDF covers 6 April – 5 April with turnover and transaction list.",
        benefits: [
          "One place for booking income",
          "Accountant-friendly export",
          "See no-shows and forfeited deposits separately",
        ],
        marketingHooks: [
          "Tax pack PDF in one click — not a Sunday night meltdown.",
          "Know what you earned without opening Stripe twelve times.",
        ],
        whereInApp: "Dashboard → Income",
      },
    ],
  },
  {
    id: "automations",
    title: "Automations & reminders",
    subtitle: "The admin you stopped doing",
    intro:
      "Glow chases clients so you can stay at the chair. Every automation runs on a 15-minute scheduler — confirmations, reminders, follow-ups, and compliance nudges.",
    features: [
      {
        id: "confirmations-reminders",
        name: "Confirmations & 24h reminders",
        headline: "You didn't become a tech to text reminders at 10pm.",
        tagline: "Booking confirmation instantly; day-before reminder by email and SMS.",
        category: "Automations",
        pain: "Manually reminding clients is exhausting and easy to forget.",
        whatItIs:
          "Automatic confirmation on book, 24-hour reminder before the appointment, optional 2-hour reminder, and balance request before the visit.",
        howItWorks:
          "Reminders are scheduled when a booking is created. Cron runs every 15 minutes. Preview everything in Dashboard → Reminders.",
        benefits: [
          "Fewer no-shows",
          "Professional client experience",
          "SMS when platform is configured",
        ],
        marketingHooks: [
          "Confirmations and reminders — on autopilot.",
          "Fewer gaps. Fewer no-shows. More time at the chair.",
        ],
        whereInApp: "Dashboard → Reminders",
      },
      {
        id: "aftercare-reviews",
        name: "Aftercare & review requests",
        headline: "Aftercare sent the moment you tap Complete.",
        tagline: "Aftercare email plus review request — no manual follow-up.",
        category: "Automations",
        pain: "You forget aftercare in the rush; clients forget to leave reviews.",
        whatItIs:
          "Per-service aftercare text emailed when you mark completed. Review request sent in the same flow.",
        howItWorks:
          "Write aftercare in the service settings. Tap Completed on a booking — client gets aftercare and a star rating request.",
        benefits: [
          "Consistent aftercare every time",
          "More reviews without asking in person",
          "Better retention and referrals",
        ],
        marketingHooks: [
          "Tap Complete. Aftercare and review request — done.",
          "Professional aftercare without copying the same message 20 times.",
        ],
        whereInApp: "Dashboard → Services → Aftercare · Dashboard → Calendar",
      },
      {
        id: "rebooking-nudge",
        name: "Rebooking nudge",
        headline: "Fill quiet weeks before they hurt.",
        tagline: "Email lapsed clients 30+ days after their last visit — with opt-out.",
        category: "Automations",
        pain: "Regulars drift away and you only notice when the diary goes quiet.",
        whatItIs:
          "Automated 'time to rebook' email for clients whose last completed visit was 30–120 days ago with nothing booked ahead.",
        howItWorks:
          "Cron identifies lapsed clients (max 25 per run). Email includes book-now link and PECR-compliant unsubscribe.",
        benefits: [
          "Proactive retention",
          "Legal marketing opt-out built in",
          "No manual list checking",
        ],
        marketingHooks: [
          "Glow nudges clients to rebook — you stay at the chair.",
          "Quiet diary? Glow emails clients who've gone quiet.",
        ],
        whereInApp: "Automatic · Dashboard → Reminders (preview)",
      },
      {
        id: "infill-nudge",
        name: "Infill deadline nudge (Feature 7)",
        headline: "Remind them before the infill window closes.",
        tagline: "Automatic email before their infill eligibility runs out.",
        category: "Automations",
        pain: "Clients miss the infill window and expect a full set price anyway.",
        whatItIs:
          "After a completed full set or qualifying visit, Glow schedules a reminder before the infill deadline.",
        howItWorks:
          "Triggered from completed bookings with infill services configured. Sends ahead of the deadline. Toggle in Settings.",
        benefits: [
          "More regular infill bookings",
          "Less awkward 'you're too late for an infill' conversations",
          "Protects your pricing rules",
        ],
        marketingHooks: [
          "Infill window closing? Glow reminds them for you.",
          "Keep regulars on schedule — automatically.",
        ],
        whereInApp: "Dashboard → Settings → Infill nudges · Dashboard → Reminders",
      },
      {
        id: "precare",
        name: "Pre-care confirmations (Feature 9)",
        headline: "Prep instructions sent — with a confirmation tap.",
        tagline: "48 hours before: clients get pre-care and confirm they've read it.",
        category: "Automations",
        pain: "Clients arrive without following prep (no caffeine, no mascara, etc.) and results suffer.",
        whatItIs:
          "Per-service pre-care text. Sent 48h before the appointment. Client confirms via a one-tap link.",
        howItWorks:
          "Add pre-care text on the service. Enable in Settings. Scheduler sends email/SMS with link to /precare/{token}. Confirmation logged on the booking.",
        benefits: [
          "Fewer bad outcomes from poor prep",
          "Proof client received instructions",
          "Professional client experience",
        ],
        marketingHooks: [
          "Pre-care instructions — sent and confirmed before they arrive.",
          "No more 'I didn't know I wasn't supposed to…'",
        ],
        whereInApp: "Dashboard → Services → Pre-care · /precare/{token}",
      },
      {
        id: "running-late",
        name: "Running late cascade (Feature 8)",
        headline: "Running late? One tap — everyone notified.",
        tagline: "Email and SMS all remaining clients today with your message.",
        category: "Automations",
        pain: "Running 20 minutes late means individually messaging five clients while driving.",
        whatItIs:
          "One-tap panel on Home and Calendar. Enter minutes late and optional message. Glow notifies all remaining clients today by email and SMS.",
        howItWorks:
          "Skips completed, cancelled, and no-show. 30-minute grace window prevents duplicate cascades. Logged for your records.",
        benefits: [
          "Professional communication under stress",
          "Saves time on a bad day",
          "Clients appreciate the heads-up",
        ],
        marketingHooks: [
          "One tap. Every client today gets the message.",
          "Running late shouldn't mean five separate texts.",
        ],
        whereInApp: "Dashboard → Home · Dashboard → Calendar → Running late?",
      },
      {
        id: "reaction-checkin",
        name: "48-hour reaction check-in (Feature 5)",
        headline: "Check they're fine after patch tests and tints.",
        tagline: "Auto follow-up 48h later — client taps fine or reaction.",
        category: "Automations",
        pain: "Delayed reactions after tints and lifts go unreported until it's serious.",
        whatItIs:
          "After patch tests and chemical treatments, Glow schedules a 48h check-in. Client responds via /checkin/{token}. Reactions can be logged to their profile.",
        howItWorks:
          "Created when you record a patch test or complete a qualifying treatment. Scheduler sends the link. Responses appear on Reminders and client profile.",
        benefits: [
          "Early reaction detection",
          "Documented follow-up for insurance",
          "Shows duty of care",
        ],
        marketingHooks: [
          "48 hours later — Glow asks if they're okay.",
          "Duty of care on autopilot.",
        ],
        whereInApp: "Dashboard → Reminders · /checkin/{token}",
      },
    ],
  },
  {
    id: "compliance",
    title: "Compliance & product safety",
    subtitle: "Stay insured. Prove it when it matters.",
    intro:
      "Features 1, 4, 5, and 6 form Glow's compliance stack — built for UK insurers, product changes (including TPO transitions), and claims that need paperwork fast.",
    features: [
      {
        id: "product-change",
        name: "Product-change re-flag (Feature 1)",
        headline: "Switched products? Glow knows who needs re-testing.",
        tagline: "Log a product change — affected clients are flagged and notified.",
        category: "Compliance",
        pain: "After a product switch, you don't know which clients still have 'valid' tests on the old formula.",
        whatItIs:
          "Log a product change event (by category or service). Valid patch tests in scope are invalidated. Affected clients enter a retest queue and get notified.",
        howItWorks:
          "Services page → Product change panel. Select scope, add note. Glow invalidates tests, builds retest queue, schedules notifications. Resolve when new pass is recorded.",
        benefits: [
          "Ready for TPO/product transitions",
          "Insurer-aligned audit trail",
          "No spreadsheet of who needs re-testing",
        ],
        marketingHooks: [
          "Changing adhesive? Glow flags every client who needs a new patch test.",
          "The TPO ban is coming. Glow is already built for it.",
        ],
        whereInApp: "Dashboard → Services → Product change · Retest queue",
      },
      {
        id: "product-batches",
        name: "Product batches & reaction tracing (Feature 4)",
        headline: "Know exactly which lot was on which client.",
        tagline: "Log products, batch/lot numbers, and link usage to appointments and reactions.",
        category: "Compliance",
        pain: "If there's a reaction, you can't remember which adhesive lot you used three weeks ago.",
        whatItIs:
          "Product library (adhesive, tint, lift, etc.) with batches (lot number, opened date, expiry). Log which batch was used on patch tests and appointments. Record adverse reactions linked to batches.",
        howItWorks:
          "Add products and batches on Services page. When recording a patch test or reaction, select the batch. Usage history lives on the client profile.",
        benefits: [
          "Traceability for insurance claims",
          "Batch-level reaction investigation",
          "Professional record keeping",
        ],
        marketingHooks: [
          "Which lot caused the reaction? Glow knows.",
          "Insurance wants records — not 'I think it was that one'.",
        ],
        whereInApp: "Dashboard → Services → Products & batches · Client profile",
      },
      {
        id: "evidence-pack",
        name: "Evidence pack PDF (Feature 6)",
        headline: "One click. Full client file for a claim.",
        tagline: "PDF export: patch tests, forms, reactions, batches, bookings, check-ins.",
        category: "Compliance",
        pain: "An insurer asks for records and you spend hours screenshotting profiles.",
        whatItIs:
          "Download a comprehensive PDF per client — patch test history, consultation answers, reactions, product usage, reaction check-ins, booking history, and photo count.",
        howItWorks:
          "Client profile → Evidence pack. PDF generates instantly with your branding and generation date.",
        benefits: [
          "Claims-ready documentation",
          "Saves hours in a stressful moment",
          "Everything in one file",
        ],
        marketingHooks: [
          "Claim lands? One click — full evidence pack.",
          "Your insurance paperwork — already done.",
        ],
        whereInApp: "Dashboard → Clients → Evidence pack",
      },
    ],
  },
  {
    id: "growth",
    title: "Growth, messaging & social selling",
    subtitle: "Turn DMs into bookings",
    intro:
      "Glow meets clients where they already are — Instagram, WhatsApp, TikTok — with messaging, quote links, and a booking page that closes the loop.",
    features: [
      {
        id: "client-messaging",
        name: "Client messaging",
        headline: "Client DMs — without giving out your personal number.",
        tagline: "Private inbox per client. They chat via a link — no app download.",
        category: "Growth",
        pain: "Booking enquiries scattered across IG, WhatsApp, and SMS with no history.",
        whatItIs:
          "In-dashboard messaging inbox. Each client gets a private /m/{token} link. Unread badge on mobile nav.",
        howItWorks:
          "Share the message link from the client profile or Messages. Conversations sync in the dashboard. Reply from your phone or desktop.",
        benefits: [
          "One inbox for client chat",
          "History attached to the client record",
          "Professional boundary from personal WhatsApp",
        ],
        marketingHooks: [
          "One inbox for every client conversation.",
          "They message you from a link — not your personal number.",
        ],
        whereInApp: "Dashboard → Messages · /m/{token}",
      },
      {
        id: "dm-quote",
        name: "DM quote links (Feature 12)",
        headline: "Quote in the DM. Book in one tap.",
        tagline: "Generate a price quote with copy for Instagram/WhatsApp — client taps to book.",
        category: "Growth",
        pain: "You quote in DMs, they ghost, and you re-type the same message tomorrow.",
        whatItIs:
          "Build a quote (service, add-ons, price, deposit, note). Glow generates a link and ready-to-paste IG/WhatsApp text. Client opens /q/{token} and taps Book now.",
        howItWorks:
          "Messages → DM quote panel (or client thread). Create quote → copy text → send. Client lands on quote page with pre-filled booking.",
        benefits: [
          "Faster DM-to-booking conversion",
          "Consistent pricing in writing",
          "Less re-typing the same quote",
        ],
        marketingHooks: [
          "Quote in the DM. Book in one tap.",
          "Stop re-typing your lash set prices in Instagram.",
        ],
        whereInApp: "Dashboard → Messages → DM quote · /q/{token}",
      },
      {
        id: "price-rise",
        name: "Price rise assistant (Feature 11)",
        headline: "Raising prices? Glow writes the announcement.",
        tagline: "Preview new prices, copy email/SMS/social text, bulk-apply rounded prices.",
        category: "Growth",
        pain: "Price rises are awkward to announce and tedious to update across every service.",
        whatItIs:
          "Enter % or £ increase, preview new prices (rounded to 50p), copy announcement for email/SMS/social, then bulk-apply to services.",
        howItWorks:
          "Services page → Price rise panel. Preview → copy templates → apply. Clients see new prices on the booking page immediately.",
        benefits: [
          "Confident price rise communication",
          "Bulk update saves time",
          "Professional announcement copy included",
        ],
        marketingHooks: [
          "Putting your prices up? Glow helps you say it — and apply it.",
          "Price rise email written for you.",
        ],
        whereInApp: "Dashboard → Services → Price rise assistant",
      },
      {
        id: "import",
        name: "Move to Glow — CSV import",
        headline: "Switching from Fresha? Don't start over.",
        tagline: "Import services, clients and appointments from Square, Booksy, Timely, Fresha.",
        category: "Growth",
        pain: "Fear of losing client history keeps techs on bad platforms.",
        whatItIs:
          "Three-step CSV import with preview before save. Platform-specific export guides in the dashboard.",
        howItWorks:
          "Dashboard → Move to Glow. Import services, then clients, then appointments. Preview shows what will be created vs skipped.",
        benefits: [
          "Low-friction migration",
          "Keep your client list and history",
          "Support can help if you're stuck",
        ],
        marketingHooks: [
          "Moving off Fresha? Import in three steps.",
          "Your data is yours — coming and going.",
        ],
        whereInApp: "Dashboard → Move to Glow",
        competitorAngle: "Glow imports from competitors; they don't import from Glow",
      },
      {
        id: "referrals",
        name: "Referral programme",
        headline: "Refer a tech. Get a free month.",
        tagline: "Personal signup link in Billing — credit when they subscribe.",
        category: "Growth",
        pain: "Word of mouth is how techs find tools — but there's no reward.",
        whatItIs:
          "Each tech gets a referral link. When a referred tech becomes a paying member, you get a free month credited.",
        howItWorks:
          "Share link from Dashboard → My plan. Attribution tracked on signup. Credit applied to your subscription.",
        benefits: [
          "Community-driven growth",
          "Reward for recommending Glow",
          "Helps other techs escape commission platforms",
        ],
        marketingHooks: [
          "Know a tech still paying commission? Refer them.",
          "Free month when your mate switches to Glow.",
        ],
        whereInApp: "Dashboard → My plan",
      },
    ],
  },
  {
    id: "ops",
    title: "Diary, calendar & day-to-day ops",
    subtitle: "Run the chair, not the spreadsheet",
    intro:
      "Everything you touch daily — calendar, manual bookings, Google sync, insights, and the tools that keep a busy day moving.",
    features: [
      {
        id: "calendar",
        name: "Calendar & booking management",
        headline: "Your whole diary in one place.",
        tagline: "Online and manual bookings — confirm, complete, cancel, no-show.",
        category: "Operations",
        pain: "Bookings split between paper diary, phone notes, and an app that doesn't sync.",
        whatItIs:
          "Full calendar view with booking detail, status changes, deposit/balance tracking, and manual booking creation.",
        howItWorks:
          "Dashboard → Calendar. Tap a booking for actions. Add manual bookings for walk-ins and phone bookings with the same rules and loyalty.",
        benefits: [
          "Single source of truth",
          "Manual + online in one diary",
          "Status changes trigger automations",
        ],
        marketingHooks: [
          "One calendar. Every booking. Every status.",
          "Phone booking? Add it in 30 seconds.",
        ],
        whereInApp: "Dashboard → Calendar",
      },
      {
        id: "google-calendar",
        name: "Google Calendar sync",
        headline: "Every booking in Google Calendar — automatically.",
        tagline: "Connect once. Create, update and cancel sync both ways.",
        category: "Operations",
        pain: "Copy-pasting appointments into Google Calendar doubles your admin.",
        whatItIs:
          "OAuth connection to Google Calendar. New bookings appear automatically; changes and cancellations sync.",
        howItWorks:
          "Settings → Connect Google Calendar → Allow. Also provides iCal feed URL for Apple Calendar subscribers.",
        benefits: [
          "One diary on your phone",
          "Partner/household can see your schedule",
          "No manual entry",
        ],
        marketingHooks: [
          "Connect Google Calendar once. Never copy-paste again.",
          "Your phone calendar and Glow — always in sync.",
        ],
        whereInApp: "Dashboard → Settings → Google Calendar",
      },
      {
        id: "client-profiles",
        name: "Client profiles & photos",
        headline: "Every client. Full history. One screen.",
        tagline: "Visits, patch tests, photos, notes, reactions, messages — all linked.",
        category: "Operations",
        pain: "Client history scattered across phones, paper forms, and Instagram DMs.",
        whatItIs:
          "Rich client profiles with visit history, patch tests, consultation answers, uploaded photos (with consent), reactions, VIP/block status, and message link.",
        howItWorks:
          "Clients are created on first booking or import. Everything they do accumulates on their profile. Photos stored securely with signed URLs.",
        benefits: [
          "Continuity of care",
          "Before/after photo record",
          "Risk visible before you accept",
        ],
        marketingHooks: [
          "Open their profile — see everything.",
          "Not digging through WhatsApp for 'what tint did we use?'",
        ],
        whereInApp: "Dashboard → Clients",
      },
      {
        id: "business-insights",
        name: "Business insights",
        headline: "Know when your diary needs attention.",
        tagline: "Smart prompts on Home — quiet week, outstanding balances, no-show risk.",
        category: "Operations",
        pain: "You only realise the diary is empty when it's too late to fill it.",
        whatItIs:
          "Contextual insight cards on the dashboard home — e.g. quiet next 7 days, money still owed, clients with no-shows, top performing service.",
        howItWorks:
          "Generated from live booking and payment data. Each insight links to the relevant dashboard area.",
        benefits: [
          "Proactive business management",
          "Actionable — not just charts",
          "Helps newer techs know what to do next",
        ],
        marketingHooks: [
          "Glow tells you when to share your link or chase a balance.",
          "Insights that actually mean something.",
        ],
        whereInApp: "Dashboard → Home",
      },
      {
        id: "tax-pack",
        name: "Self Assessment tax pack (Feature 10)",
        headline: "Tax year PDF — turnover, breakdowns, every transaction.",
        tagline: "UK tax year (6 Apr – 5 Apr) export for Self Assessment.",
        category: "Operations",
        pain: "HMRC wants numbers; you have Stripe, cash, and memory.",
        whatItIs:
          "Select tax year → download PDF with turnover, monthly income, income by service, and full payment transaction list.",
        howItWorks:
          "Income page → tax year selector → Tax pack PDF. Complements CSV export for accountants.",
        benefits: [
          "Structured summary for Self Assessment",
          "Transaction-level backup",
          "Saves accountant fees and stress",
        ],
        marketingHooks: [
          "Self Assessment tax pack — one PDF, whole year.",
          "January panic? Not this year.",
        ],
        whereInApp: "Dashboard → Income → Tax pack PDF",
      },
    ],
  },
];

/** Quick-reference poster themes — map to content campaigns */
export const CAMPAIGN_THEMES = [
  { theme: "Zero commission", features: ["stripe-connect", "branded-page"], sampleHeadline: "0% commission. Your clients. Your bank." },
  { theme: "No-shows", features: ["deposits-config", "risk-deposits"], sampleHeadline: "Another no-show? Not on Glow." },
  { theme: "Patch tests & insurance", features: ["patch-test-gating", "evidence-pack", "product-change"], sampleHeadline: "Stay insured. Prove it when it matters." },
  { theme: "Automations", features: ["confirmations-reminders", "running-late", "precare"], sampleHeadline: "The admin you stopped doing." },
  { theme: "Switching platforms", features: ["import", "branded-page"], sampleHeadline: "Move without starting over." },
  { theme: "DM → booking", features: ["dm-quote", "client-messaging", "branded-page"], sampleHeadline: "Quote in the DM. Book in one tap." },
  { theme: "Pricing", features: ["stripe-connect", "price-rise"], sampleHeadline: "£19/mo. Every feature. No commission." },
];
