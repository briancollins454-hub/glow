"use client";

import { LifeBuoy } from "lucide-react";
import { useDashboardAuth } from "@/hooks/use-dashboard-auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://glow-uk.com";

export default function HelpPage() {
  const { tech } = useDashboardAuth();
  if (!tech) return null;

  const myLink = `${APP_URL.replace(/^https?:\/\//, "")}/${tech.handle}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <LifeBuoy className="h-6 w-6 text-brand-400" /> How Glow works
        </h1>
        <p className="text-sm text-ink-soft">
          Everything below is written to be read once. Tap a question to open it.
        </p>
      </div>

      <div className="card divide-y divide-edge">
        <Item title="I'm brand new. What do I do first?" open>
          <Step n={1}>Tap <B>Services</B> in the menu. Add what you offer: the name, the price, and how long it takes.</Step>
          <Step n={2}>Tap <B>Opening hours</B>. Set the days and times you work (and any days off). If your roster changes each week, open <B>Team</B> → <B>Week rota</B> and set each person&apos;s real days for that week.</Step>
          <Step n={3}>Tap <B>Get paid</B> and connect your bank so you can take card deposits.</Step>
          <Step n={4}>Tap <B>My plan</B> and start your plan. This switches your booking page on.</Step>
          <Step n={5}>That&apos;s it. Your booking page is live at <B>{myLink}</B></Step>
        </Item>

        <Item title="How do clients find my booking page?">
          <P>You share one link: <B>{myLink}</B></P>
          <Step n={1}>Copy the link (it&apos;s at the top of your Home page).</Step>
          <Step n={2}>Paste it into your Instagram bio, TikTok bio, and WhatsApp.</Step>
          <Step n={3}>Done. Anyone who taps it can book you. You never need to send it again.</Step>
        </Item>

        <Item title="How do I make my page look like my brand?">
          <Step n={1}>Go to <B>Settings</B>.</Step>
          <Step n={2}>Upload a <B>banner image</B> (the wide photo at the top) and a <B>profile photo</B> (your logo or headshot). Big photos are resized automatically.</Step>
          <Step n={3}>Set your business name, tagline, brand colour, Instagram and location.</Step>
          <P>What you upload is what clients see - Glow never crops your banner or logo.</P>
        </Item>

        <Item title="What happens when someone books me?">
          <Step n={1}>They pick a service (or a few treatments in one visit) and a time on your page.</Step>
          <Step n={2}>They pay the deposit by card - or, if you use <B>card on file</B>, they save a card instead and pay nothing upfront (if you&apos;ve connected payments).</Step>
          <Step n={3}>You get an email. They get a confirmation email.</Step>
          <Step n={4}>The booking appears in your <B>Calendar</B> - and in your Google Calendar if you connected it.</Step>
          <P>You don&apos;t have to do anything. Reminders send themselves.</P>
        </Item>

        <Item title="What do I do after an appointment?">
          <Step n={1}>Open <B>Calendar</B> and tap the booking.</Step>
          <Step n={2}>Tap <B>Completed</B> if they came. This sends their aftercare email and asks them for a review.</Step>
          <Step n={3}>Tap <B>No-show</B> if they didn&apos;t come. They lose their deposit - or, if you use <B>card on file</B>, your no-show charge is taken from their saved card - and they get a strike on their record.</Step>
          <Step n={4}>Tap <B>Cancel</B> if they cancelled. Glow works out the deposit rules for you.</Step>
        </Item>

        <Item title="Do I have to take deposits?">
          <P>No. There are two ways Glow can protect you from no-shows - pick one in <B>Settings</B> under <B>Deposit &amp; no-show protection</B>:</P>
          <Step n={1}><B>Deposit upfront</B> (the usual way). Clients pay a deposit when they book. If they no-show, you keep it automatically.</Step>
          <Step n={2}><B>Card on file - no deposit</B>. Clients save a card when they book but pay nothing. If they no-show, tap <B>No-show</B> on the booking and your no-show charge is taken from their saved card.</Step>
          <P>Both need card payments connected in <B>Get paid</B>. One honest difference: a deposit is money you already have, while a card charge can occasionally be declined by the client&apos;s bank - Glow tells you straight away if that happens, so you can follow it up.</P>
          <P>You can also set <B>higher deposits for riskier clients</B> (new clients, repeat no-shows) in the same Settings section - trusted regulars keep paying your normal amount.</P>
        </Item>

        <Item title="How do I get paid?">
          <P><B>Deposits and card payments:</B> go to <B>Get paid</B> and connect your bank once. Card money goes straight to your bank account. Glow takes 0%.</P>
          <P><B>The rest of the money:</B> clients can pay the balance from a link before they arrive, or pay you in person like normal (cash, card machine, bank transfer). Record it on the booking either way.</P>
          <P><B>Income:</B> open <B>Income</B> for totals, month-by-month breakdowns, and a Self Assessment tax pack PDF when you need it.</P>
        </Item>

        <Item title="Can I approve bookings before they go ahead?">
          <P>Yes. In <B>Settings</B> under Booking approval:</P>
          <Step n={1}><B>Instant booking</B> - clients book and pay straight away (default).</Step>
          <Step n={2}><B>Manual approval</B> - every request waits for you. No deposit or card is taken until you approve.</Step>
          <Step n={3}><B>Rules</B> - trusted returning clients book instantly; new or riskier ones wait for you.</Step>
          <P>Approve or decline from <B>Calendar</B>. The client gets an email either way.</P>
        </Item>

        <Item title="What are patch tests and why does Glow block some bookings?">
          <P>Some treatments (like lash lifts and tints) need a skin test first, for insurance and safety.</P>
          <Step n={1}>When you do a patch test, open the client in <B>Clients</B> and record it (takes 10 seconds).</Step>
          <Step n={2}>Glow then lets them book those services online.</Step>
          <Step n={3}>Clients can also <B>book the patch test and treatment together</B> in one go - Glow spaces them the right number of hours apart.</Step>
          <P>If a client can&apos;t book online, this is usually why - it&apos;s protecting you.</P>
          <P>After a patch test, Glow can also send a <B>48-hour reaction check-in</B> so they confirm their skin was fine.</P>
        </Item>

        <Item title="How do infills work?">
          <P>Mark a service as an infill in <B>Services</B> and set how many days after a full set it&apos;s allowed. Glow only lets returning clients book it inside that window - everyone else is steered to a full set.</P>
          <P>Glow can also nudge clients to rebook an infill before their window closes (turn this on in <B>Settings</B>).</P>
        </Item>

        <Item title="Do I need to send reminders?">
          <P>No. Glow automatically sends:</P>
          <Step n={1}>A confirmation the moment they book.</Step>
          <Step n={2}>A reminder the day before (and optionally a 2-hour reminder by SMS).</Step>
          <Step n={3}>A &ldquo;pay your balance&rdquo; link before the appointment.</Step>
          <Step n={4}>Pre-care instructions they can confirm they&apos;ve read (turn on in <B>Settings</B>, write the text on each service).</Step>
          <Step n={5}>A &ldquo;time to rebook&rdquo; nudge if they haven&apos;t been back in a while.</Step>
          <P>You can see everything it sent in <B>Reminders</B>. SMS reminders can be toggled in <B>Settings</B> when the platform has SMS switched on.</P>
        </Item>

        <Item title="I'm running late - how do I tell the rest of the day?">
          <P>On <B>Home</B> or <B>Calendar</B>, tap <B>Running late?</B>. Glow messages every client still booked later today with how many minutes you&apos;re behind - in one go.</P>
        </Item>

        <Item title="How do reviews work?">
          <Step n={1}>When you tap <B>Completed</B> on a booking, the client gets asked for a star rating.</Step>
          <Step n={2}>New reviews appear in <B>Reviews</B> - they are private until you approve them.</Step>
          <Step n={3}>Tap <B>Show on my page</B> on the ones you like. They appear on your booking page.</Step>
        </Item>

        <Item title="How do I get my bookings in Google Calendar?">
          <Step n={1}>Go to <B>Settings</B>.</Step>
          <Step n={2}>Tap the big <B>Connect Google Calendar</B> button at the top.</Step>
          <Step n={3}>Tap <B>Allow</B> when Google asks.</Step>
          <P>Done - every booking now appears in your Google Calendar by itself, forever.</P>
        </Item>

        <Item title="I work with other people - can they have their own diary?">
          <P>Yes. Open <B>Team</B>, add each person, and choose which services they can do. Clients pick who they want (or &ldquo;any available&rdquo;) when they book. Each person keeps their own hours and diary.</P>
        </Item>

        <Item title="Our days change every week - how do we set a rota?">
          <P>Open <B>Team</B>, tap a person, then <B>Week rota</B>. Pick the week, tick the days they work, set the times, and save. You can copy the previous week forward. Weeks with a saved rota override the usual hours for online booking.</P>
          <P>Still useful as a fallback: in <B>Opening hours</B>, <B>My days change each week</B> offers a daily window when a week has no rota saved. Pair with <B>Booking approval</B> in Settings if you want to confirm requests by hand.</P>
        </Item>

        <Item title="Can I ask clients questions before they book?">
          <P>Yes. Open <B>Forms</B> and add consultation questions (yes/no, short text, or long text). They appear on the booking page and answers are saved on the client&apos;s profile.</P>
        </Item>

        <Item title="How does loyalty / VIP work?">
          <P>In <B>Settings</B>, set how many completed visits unlock a discount, and whether it&apos;s a % or a fixed £ off. Tick <B>VIP</B> on a client&apos;s profile and they always get the discount, even before they hit the visit count.</P>
        </Item>

        <Item title="What if I'm fully booked?">
          <P>Clients can join a <B>waitlist</B> on your booking page for a date. When you cancel a booking, Glow emails people on the waitlist for that day so they can grab the slot.</P>
        </Item>

        <Item title="Products, batches and evidence packs - what's that for?">
          <P>Built for insurance and compliance (especially lashes/tints):</P>
          <Step n={1}>In <B>Services</B>, add the products you use and their batch / lot numbers.</Step>
          <Step n={2}>When you complete a booking, pick which batch you used - it&apos;s logged against the client.</Step>
          <Step n={3}>If you change a product, Glow can put affected clients into a <B>retest queue</B> so they need a fresh patch test.</Step>
          <Step n={4}>From a client&apos;s profile, download an <B>evidence pack PDF</B> (patch tests, products used, reactions) if you ever need it for insurance.</Step>
        </Item>

        <Item title="How do I put prices up without the awkward DMs?">
          <P>In <B>Services</B>, open the <B>Price rise assistant</B>. It drafts a message you can send, then updates the prices when you&apos;re ready.</P>
        </Item>

        <Item title="A client is messaging me - where?">
          <P>In <B>Messages</B>. Clients get a private link to chat with you - no app needed on their side. You&apos;ll see a red dot when there&apos;s something new.</P>
          <P>From Messages you can also send a <B>DM quote link</B> - a one-tap booking link for a specific service and price, handy when someone DMs you on Instagram.</P>
        </Item>

        <Item title="How do I block a problem client?">
          <Step n={1}>Open them in <B>Clients</B>.</Step>
          <Step n={2}>Tick <B>Block this client from booking online</B> and save.</Step>
          <P>They can no longer book you online. You can also add a private warning note only you can see, and upload before/after photos with their consent.</P>
        </Item>

        <Item title="I'm moving from another app (Fresha, Booksy, etc.)">
          <Step n={1}>Go to <B>Move to Glow</B> in the menu.</Step>
          <Step n={2}>Follow the three steps on that page - it tells you exactly where to download your files from your old app.</Step>
          <Step n={3}>Stuck? Email the file to us and we&apos;ll do it for you.</Step>
        </Item>

        <Item title="Do you have a referral programme?">
          <P>Yes. In <B>My plan</B> you&apos;ll find your referral link. When a tech you refer becomes a paying member, a free month is credited to your bill - tracked automatically.</P>
        </Item>

        <Item title="Something looks broken or wrong">
          <P>Email <a className="text-brand-400" href="mailto:support@glow-uk.com">support@glow-uk.com</a> and tell us what you were doing when it happened. Screenshots help a lot.</P>
        </Item>
      </div>

      <p className="text-center text-xs text-ink-faint">
        Can&apos;t find your answer? Email support@glow-uk.com - a real person reads it.
      </p>
    </div>
  );
}

function Item({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group p-5">
      <summary className="cursor-pointer list-none font-medium marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          {title}
          <span className="shrink-0 text-ink-faint transition group-open:rotate-180">▾</span>
        </span>
      </summary>
      <div className="mt-3 space-y-2.5">{children}</div>
    </details>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="flex gap-3 text-sm text-ink-soft">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-300">{n}</span>
      <span className="pt-0.5">{children}</span>
    </p>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-soft">{children}</p>;
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}
