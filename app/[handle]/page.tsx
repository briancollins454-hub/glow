import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseService } from "@/lib/supabase/service";
import {
  listBlockingBookingsInRange,
  listCategories,
  listQuestions,
  listServices,
  listTimeOff,
  listWorkingHours,
  listRotaHours,
  getCategory,
  addonsForService,
  listApprovedReviews,
  listClientPhotosForTech,
  getClientNameMap,
} from "@/lib/db/queries";
import { addDaysToDateStr, currentWeekStartLondon } from "@/lib/rota";
import { loadPublicTechByHandle } from "@/lib/booking/public-tech-load";
import { signedPhotoUrls } from "@/lib/storage";
import {
  availableDaysForDuration,
  basketDurationMin,
  blockedDurationMin,
  canOfferPairedPatchTest,
  findPatchTestService,
  bufferMapFromServices,
  flexibleHoursFromTech,
  intersectWeekdays,
  weekdaysForStaffBasket,
  withTechAvailability,
} from "@/lib/rules";
import { addableBasketServices, resolveBasketExtras } from "@/lib/booking/basket";
import {
  ANY_STAFF,
  capableStaff,
  rowsForStaff,
  staffCanPerform,
  unionDayOptions,
  workingHoursForStaff,
} from "@/lib/booking/staff";
import { timeOffAppliesToStaff } from "@/lib/booking/staff-day";
import { listStaff, staffServiceDayMap, staffServiceMap } from "@/lib/db/queries";
import type { Booking, StaffMember, WorkingHour } from "@/lib/db/types";
import { acceptsOnlineBookings, usesCardCapture } from "@/lib/subscriptions";
import { gbp } from "@/lib/format";
import type { ConsultationQuestion, Review, ServiceAddon } from "@/lib/db/types";
import { BookingStepInteractive } from "@/components/booking/booking-step-interactive";
import { PairedBookingStepInteractive } from "@/components/booking/paired-booking-step-interactive";
import { BookingHeader, BookingFlowHeader } from "@/components/booking/booking-header";
import { BookingBanner } from "@/components/booking/booking-banner";
import { BookingAbout } from "@/components/booking/booking-about";
import { ServiceGrid } from "@/components/booking/service-grid";
import { PortfolioGallery } from "@/components/booking/portfolio-gallery";
import { ReviewsSection } from "@/components/booking/reviews-section";
import { OpeningHours } from "@/components/booking/opening-hours";
import { TrustStrip } from "@/components/booking/trust-strip";
import { BookingFooterCta } from "@/components/booking/booking-footer-cta";
import { StickyBookCta } from "@/components/booking/sticky-book-cta";
import { RetestBookingNotice } from "@/components/booking/retest-booking-notice";
import { trackPageView } from "@/lib/page-views";
import { groupServicesForMenu } from "@/lib/booking/service-groups";
import type { ServiceNavGroup } from "@/components/booking/booking-header";

type DayOption = { dateStr: string; slots: string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const tech = await loadPublicTechByHandle(handle);
  if (!tech) return { robots: { index: false, follow: false } };
  const title = `${tech.businessName} - book online`;
  const description =
    tech.tagline?.trim() ||
    tech.bio ||
    `Book ${tech.businessName} online. ${
      usesCardCapture(tech) ? "No deposit needed to book." : "Secure your slot with a deposit."
    } Powered by Glow.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export const revalidate = 60;

function hhmm(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function buildOpeningHours(hours: Awaited<ReturnType<typeof listWorkingHours>>) {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
    // Salon mode can have one row per staff member per weekday: the business
    // is "open" from the earliest start to the latest finish of anyone working.
    const rows = hours.filter((h) => h.weekday === weekday && h.enabled);
    if (rows.length === 0) {
      return { label: dayNames[weekday], value: "Closed" };
    }
    const start = Math.min(...rows.map((r) => r.startMinutes));
    const end = Math.max(...rows.map((r) => r.endMinutes));
    return { label: dayNames[weekday], value: `${hhmm(start)} - ${hhmm(end)}` };
  });
}

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ service?: string; also?: string; staff?: string; date?: string; slot?: string; patchSlot?: string; pair?: string; err?: string; wl?: string; retest?: string }>;
}) {
  const { handle } = await params;
  const sp = await searchParams;
  const sb = supabaseService();
  // Existence is validated in layout (outside loading.tsx) so missing
  // handles return a real HTTP 404 instead of a streamed soft-404.
  const tech = await loadPublicTechByHandle(handle);
  if (!tech) notFound();

  trackPageView({ techId: tech.id, path: `/${handle}` });

  const [categories, allServices] = await Promise.all([
    listCategories(sb, tech.id),
    listServices(sb, tech.id, { activeOnly: true }),
  ]);
  // Card capture mode: nothing is paid upfront (a card is saved at checkout
  // instead), so the page must not advertise deposits. Zeroing them here keeps
  // every deposit chip/amount downstream consistent; the booking actions
  // re-read the DB and apply their own card-capture override.
  const services = usesCardCapture(tech)
    ? allServices.map((s) => ({ ...s, depositType: "none" as const, depositValue: 0 }))
    : allServices;
  const selected = sp.service ? services.find((s) => s.id === sp.service) ?? null : null;
  const patchTestService =
    selected && canOfferPairedPatchTest(selected, services)
      ? findPatchTestService(services, selected.categoryId)
      : null;
  const usePairedFlow =
    !!selected &&
    !!patchTestService &&
    (sp.pair === "1" || (!!sp.retest && sp.retest === selected.categoryId));

  const live = acceptsOnlineBookings(tech);
  // Basket: extra treatments chained onto this booking (not in the paired flow).
  const basketExtras =
    selected && !usePairedFlow ? resolveBasketExtras(services, selected.id, sp.also) : [];
  const addable =
    selected && !usePairedFlow ? addableBasketServices(services, selected.id, basketExtras) : [];

  let days: DayOption[] = [];
  let patchTestDays: DayOption[] = [];
  let minLeadHours = 24;
  let questions: ConsultationQuestion[] = [];
  let addons: ServiceAddon[] = [];
  // Salon mode: who can take this visit, and who did the client pick?
  let staffOptions: { id: string; name: string }[] = [];
  let selectedStaff = ANY_STAFF;
  let pairStaffId: string | null = null;
  let addableForStaff = addable;
  if (selected && live) {
    const rangeEnd = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const rotaFrom = currentWeekStartLondon();
    const rotaTo = addDaysToDateStr(rotaFrom, 7 * 12);
    const [workingHours, timeOff, bookings, qs, adds, category, staffList, rotaHours] =
      await Promise.all([
        listWorkingHours(sb, tech.id),
        listTimeOff(sb, tech.id),
        listBlockingBookingsInRange(sb, tech.id, new Date().toISOString(), rangeEnd),
        listQuestions(sb, tech.id, { activeOnly: true }),
        addonsForService(sb, selected.id, { activeOnly: true }),
        getCategory(sb, selected.categoryId),
        listStaff(sb, tech.id, { activeOnly: true }).catch(() => [] as StaffMember[]),
        listRotaHours(sb, tech.id, { fromWeek: rotaFrom, toWeek: rotaTo }),
      ]);
    minLeadHours = category?.patchTestMinLeadHours ?? 24;
    questions = qs;
    addons = adds;

    const restrictions = staffList.length
      ? await staffServiceMap(sb, staffList.map((s) => s.id)).catch(
          () => ({}) as Record<string, string[]>,
        )
      : ({} as Record<string, string[]>);
    const dayRulesByStaff = staffList.length
      ? await staffServiceDayMap(sb, staffList.map((s) => s.id)).catch(
          () => ({}) as Record<string, Record<string, number[] | null>>,
        )
      : ({} as Record<string, Record<string, number[] | null>>);

    const basketServices = usePairedFlow ? [selected] : [selected, ...basketExtras];
    const basketIds = usePairedFlow && patchTestService
      ? [selected.id, patchTestService.id]
      : basketServices.map((s) => s.id);
    const capable = capableStaff(staffList, restrictions, basketIds);

    const bufferByServiceId = bufferMapFromServices(services);
    const owner = staffList.find((s) => s.role === "owner") ?? null;
    // Availability context per person (legacy rows with no staffId belong to
    // the owner). Staff with no personal hours inherit salon/owner hours.
    const ctxFor = (staff: StaffMember) => ({
      ...withTechAvailability(
        {
          workingHours: workingHoursForStaff(
            workingHours as WorkingHour[],
            staff,
            owner?.id,
          ),
          timeOff: timeOffAppliesToStaff(timeOff, staff.id),
          bookings: rowsForStaff(bookings as Booking[], staff),
        },
        tech,
      ),
      rotaHours: rowsForStaff(rotaHours, staff),
      bufferByServiceId,
    });
    const legacyCtx = {
      ...withTechAvailability({ workingHours, timeOff, bookings }, tech),
      rotaHours,
      bufferByServiceId,
    };
    const daysForStaff = (staff: StaffMember, servicesForDays: typeof basketServices) =>
      weekdaysForStaffBasket(servicesForDays, dayRulesByStaff[staff.id]);

    if (capable.length > 1) {
      staffOptions = capable.map((s) => ({ id: s.id, name: s.name }));
      if (sp.staff && capable.some((s) => s.id === sp.staff)) selectedStaff = sp.staff;
    }

    if (usePairedFlow && patchTestService) {
      // Paired bookings (patch test + treatment) stay with ONE person.
      const pairStaff =
        capable.find((s) => s.id === selectedStaff) ?? capable[0] ?? null;
      pairStaffId = pairStaff?.id ?? null;
      const pairDays = pairStaff
        ? daysForStaff(pairStaff, [patchTestService])
        : intersectWeekdays([patchTestService]);
      patchTestDays = availableDaysForDuration(
        blockedDurationMin(patchTestService),
        {
          ...(pairStaff ? ctxFor(pairStaff) : legacyCtx),
          allowedWeekdays: pairDays,
        },
        14,
      );
    } else {
      const duration = basketDurationMin(basketServices);
      const withDays = (ctx: typeof legacyCtx, allowedWeekdays: number[] | null) => ({
        ...ctx,
        allowedWeekdays,
      });
      if (capable.length === 0) {
        // Pre-migration or no active staff: book against the whole diary.
        days = availableDaysForDuration(
          duration,
          withDays(legacyCtx, intersectWeekdays(basketServices)),
          14,
        );
      } else if (selectedStaff !== ANY_STAFF) {
        const staff = capable.find((s) => s.id === selectedStaff)!;
        days = availableDaysForDuration(
          duration,
          withDays(ctxFor(staff), daysForStaff(staff, basketServices)),
          14,
        );
      } else {
        // "Any available": union of everyone who can do the whole visit.
        days = unionDayOptions(
          capable.map((s) =>
            availableDaysForDuration(
              duration,
              withDays(ctxFor(s), daysForStaff(s, basketServices)),
              60,
            ),
          ),
          14,
        );
      }

      // Only offer basket additions someone can actually perform in this visit.
      if (staffList.length > 0) {
        addableForStaff = addable.filter((svc) => {
          const ids = [...basketIds, svc.id];
          if (selectedStaff !== ANY_STAFF) {
            return staffCanPerform(restrictions, selectedStaff, ids);
          }
          return capableStaff(staffList, restrictions, ids).length > 0;
        });
      }
    }
  }

  const photoUrls = new Map<string, string>();
  let openingHours: { label: string; value: string }[] = [];
  let reviews: { review: Review; clientLabel: string }[] = [];
  let ratingAvg = 0;
  let ratingCount = 0;
  let portfolio: { id: string; url: string; kind: string }[] = [];
  let selectedPhotoUrl: string | undefined;
  let coverUrl: string | undefined;
  let profileUrl: string | undefined;

  const brandPaths = [tech.coverPhotoPath, tech.profilePhotoPath].filter(Boolean) as string[];

  if (!selected) {
    const [hours, approvedReviews, allPhotos] = await Promise.all([
      listWorkingHours(sb, tech.id),
      listApprovedReviews(sb, tech.id).catch(() => []),
      listClientPhotosForTech(sb, tech.id).catch(() => []),
    ]);

    const consented = allPhotos.filter((p) => p.consent && p.kind !== "other").slice(0, 12);
    const photoPaths = [
      ...brandPaths,
      ...services.filter((s) => s.photoPath).map((s) => s.photoPath!),
      ...consented.map((p) => p.path),
    ];
    const signed = await signedPhotoUrls(photoPaths);

    if (tech.coverPhotoPath) coverUrl = signed.get(tech.coverPhotoPath);
    if (tech.profilePhotoPath) profileUrl = signed.get(tech.profilePhotoPath);

    for (const s of services) {
      if (s.photoPath) {
        const url = signed.get(s.photoPath);
        if (url) photoUrls.set(s.id, url);
      }
    }

    const clientById = await getClientNameMap(
      sb,
      approvedReviews.map((r) => r.clientId),
    );
    ratingCount = approvedReviews.length;
    ratingAvg = ratingCount
      ? approvedReviews.reduce((s, r) => s + r.rating, 0) / ratingCount
      : 0;
    reviews = approvedReviews.slice(0, 6).map((review) => {
      const name = clientById.get(review.clientId) ?? "";
      const [first = "", last = ""] = name.split(" ");
      return { review, clientLabel: last ? `${first} ${last[0]}.` : first || "A client" };
    });

    portfolio = consented
      .map((p) => {
        const url = signed.get(p.path);
        return url ? { id: p.id, url, kind: p.kind } : null;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const flexible = flexibleHoursFromTech(tech);
    if (flexible) {
      openingHours = [
        {
          label: "Hours",
          value: `Vary by week · usually ${hhmm(flexible.startMinutes)} - ${hhmm(flexible.endMinutes)}`,
        },
      ];
    } else {
      openingHours = buildOpeningHours(hours);
    }
  } else {
    const paths = [
      ...brandPaths,
      ...(selected.photoPath ? [selected.photoPath] : []),
    ];
    const signed = await signedPhotoUrls(paths);
    if (selected.photoPath) selectedPhotoUrl = signed.get(selected.photoPath);
    if (tech.coverPhotoPath) coverUrl = signed.get(tech.coverPhotoPath);
    if (tech.profilePhotoPath) profileUrl = signed.get(tech.profilePhotoPath);
  }

  const brand = tech.brandColor || "#db2777";
  const minPrice = services.length ? Math.min(...services.map((s) => s.pricePennies)) : 0;
  const serviceNavGroups: ServiceNavGroup[] = groupServicesForMenu(categories, services).map(
    (group) => ({
      id: group.id,
      title: group.title,
      services: group.services.map((s) => ({ id: s.id, name: s.name })),
    }),
  );

  if (selected) {
    return (
      <div className="min-h-screen bg-cream">
        <BookingFlowHeader businessName={tech.businessName} handle={tech.handle} />
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          {usePairedFlow && patchTestService ? (
            <PairedBookingStepInteractive
              tech={tech}
              treatmentService={selected}
              patchTestService={patchTestService}
              brand={brand}
              patchTestDays={patchTestDays}
              minLeadHours={minLeadHours}
              live={live}
              questions={questions}
              addons={addons}
              err={sp.err}
              wl={sp.wl}
              initialPatchSlot={sp.patchSlot}
              initialTreatmentSlot={sp.slot}
              photoUrl={selectedPhotoUrl}
              staffId={pairStaffId}
            />
          ) : (
            <BookingStepInteractive
              tech={tech}
              service={selected}
              brand={brand}
              days={days}
              live={live}
              questions={questions}
              addons={addons}
              err={sp.err}
              wl={sp.wl}
              initialDate={sp.date}
              initialSlot={sp.slot}
              photoUrl={selectedPhotoUrl}
              pairBookingUrl={
                patchTestService ? `/${tech.handle}?service=${selected.id}&pair=1` : undefined
              }
              basketExtras={basketExtras}
              addableServices={addableForStaff}
              staffOptions={staffOptions}
              selectedStaff={selectedStaff}
            />
          )}
        </main>
        <footer className="mx-auto max-w-3xl px-4 pb-8 text-center text-xs text-ink-faint">
          <p>
            Powered by{" "}
            <Link href="/" className="font-medium text-brand-400 hover:text-brand-300">
              Glow
            </Link>
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-24 lg:pb-16">
      <BookingHeader
        businessName={tech.businessName}
        brand={brand}
        profileUrl={profileUrl}
        hasServices={services.length > 0}
        serviceGroups={serviceNavGroups}
      />

      <BookingBanner
        businessName={tech.businessName}
        tagline={tech.tagline}
        brand={brand}
        coverUrl={coverUrl}
        hasServices={services.length > 0}
      />

      <main className="mx-auto max-w-5xl space-y-14 px-4 py-10 sm:px-6 sm:py-14">
        {sp.retest && !selected && (
          <RetestBookingNotice
            businessName={tech.businessName}
            bookUrl={(() => {
              const treatment = services.find(
                (s) =>
                  s.requiresPatchTest &&
                  !s.isPatchTestService &&
                  s.categoryId === sp.retest &&
                  canOfferPairedPatchTest(s, services),
              );
              return treatment
                ? `/${tech.handle}?service=${treatment.id}&pair=1&retest=${sp.retest}`
                : undefined;
            })()}
          />
        )}

        <BookingAbout
          bio={tech.bio}
          location={tech.location || undefined}
          instagram={tech.instagram || undefined}
          tiktok={tech.tiktok || undefined}
          ratingAvg={ratingAvg}
          ratingCount={ratingCount}
        />

        <ServiceGrid
          categories={categories}
          services={services}
          handle={tech.handle}
          brand={brand}
          photoUrls={photoUrls}
        />

        <PortfolioGallery items={portfolio} />

        <ReviewsSection reviews={reviews} ratingAvg={ratingAvg} ratingCount={ratingCount} />

        {openingHours.length > 0 && <OpeningHours hours={openingHours} />}

        <TrustStrip secureLabel={usesCardCapture(tech) ? "Secure card payments" : "Secure deposit"} />

        <BookingFooterCta
          brand={brand}
          minPriceLabel={gbp(minPrice)}
          serviceCount={services.length}
        />
      </main>

      <footer className="mx-auto max-w-5xl border-t border-edge px-4 py-8 text-center text-xs text-ink-faint sm:px-6">
        <p>
          Secure online booking · deposits shown upfront · powered by{" "}
          <Link href="/" className="font-medium text-brand-400 hover:text-brand-300">
            Glow
          </Link>
        </p>
      </footer>

      <StickyBookCta
        minPriceLabel={gbp(minPrice)}
        brand={brand}
        serviceCount={services.length}
      />
    </div>
  );
}
