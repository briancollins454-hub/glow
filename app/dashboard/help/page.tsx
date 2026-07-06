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
          <Step n={2}>Tap <B>Opening hours</B>. Set the days and times you work.</Step>
          <Step n={3}>Tap <B>My plan</B> and start your plan. This switches your booking page on.</Step>
          <Step n={4}>That&apos;s it. Your booking page is live at <B>{myLink}</B></Step>
        </Item>

        <Item title="How do clients find my booking page?">
          <P>You share one link: <B>{myLink}</B></P>
          <Step n={1}>Copy the link (it&apos;s at the top of your Home page).</Step>
          <Step n={2}>Paste it into your Instagram bio, TikTok bio, and WhatsApp.</Step>
          <Step n={3}>Done. Anyone who taps it can book you. You never need to send it again.</Step>
        </Item>

        <Item title="What happens when someone books me?">
          <Step n={1}>They pick a service and a time on your page.</Step>
          <Step n={2}>They pay the deposit by card (if you&apos;ve connected payments).</Step>
          <Step n={3}>You get an email. They get a confirmation email.</Step>
          <Step n={4}>The booking appears in your <B>Calendar</B> - and in your Google Calendar if you connected it.</Step>
          <P>You don&apos;t have to do anything. Reminders send themselves.</P>
        </Item>

        <Item title="What do I do after an appointment?">
          <Step n={1}>Open <B>Calendar</B> and tap the booking.</Step>
          <Step n={2}>Tap <B>Completed</B> if they came. This sends their aftercare email and asks them for a review.</Step>
          <Step n={3}>Tap <B>No-show</B> if they didn&apos;t come. They lose their deposit and get a strike on their record.</Step>
          <Step n={4}>Tap <B>Cancel</B> if they cancelled. Glow works out the deposit rules for you.</Step>
        </Item>

        <Item title="How do I get paid?">
          <P><B>Deposits and card payments:</B> go to <B>Get paid</B> and connect your bank once. Card money goes straight to your bank account. Glow takes 0%.</P>
          <P><B>The rest of the money:</B> clients can pay the balance from a link before they arrive, or pay you in person like normal (cash, card machine, bank transfer). Record it on the booking either way.</P>
        </Item>

        <Item title="What are patch tests and why does Glow block some bookings?">
          <P>Some treatments (like lash lifts and tints) need a skin test first, for insurance and safety.</P>
          <Step n={1}>When you do a patch test, open the client in <B>Clients</B> and record it (takes 10 seconds).</Step>
          <Step n={2}>Glow then lets them book those services online.</Step>
          <P>If a client can&apos;t book online, this is usually why - it&apos;s protecting you.</P>
        </Item>

        <Item title="Do I need to send reminders?">
          <P>No. Glow automatically sends:</P>
          <Step n={1}>A confirmation email the moment they book.</Step>
          <Step n={2}>A reminder the day before.</Step>
          <Step n={3}>A &ldquo;pay your balance&rdquo; link before the appointment.</Step>
          <Step n={4}>A &ldquo;time to rebook&rdquo; email if they haven&apos;t been back in a while.</Step>
          <P>You can see everything it sent in <B>Reminders</B>.</P>
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

        <Item title="I'm moving from another app (Fresha, Booksy, etc.)">
          <Step n={1}>Go to <B>Move to Glow</B> in the menu.</Step>
          <Step n={2}>Follow the three steps on that page - it tells you exactly where to download your files from your old app.</Step>
          <Step n={3}>Stuck? Email the file to us and we&apos;ll do it for you.</Step>
        </Item>

        <Item title="A client is messaging me - where?">
          <P>In <B>Messages</B>. Clients get a private link to chat with you - no app needed on their side. You&apos;ll see a red dot when there&apos;s something new.</P>
        </Item>

        <Item title="How do I block a problem client?">
          <Step n={1}>Open them in <B>Clients</B>.</Step>
          <Step n={2}>Tick <B>Block this client from booking online</B> and save.</Step>
          <P>They can no longer book you online. You can also add a private warning note only you can see.</P>
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
