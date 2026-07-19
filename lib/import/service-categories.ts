/**
 * Infer a sensible Glow category from a service name.
 * Used when the source export has no category column (e.g. Acuity appointment Types).
 */

/** Lookup keys for an inferred/existing category name (handles common typos). */
export function categoryLookupKeys(name: string): string[] {
  const key = name.trim().toLowerCase();
  if (!key) return [];
  if (key === "welding jewellery" || key === "welding jewelery") {
    return ["welding jewellery", "welding jewelery"];
  }
  return [key];
}

const PIERCING_NAMES =
  /^(anti tragus|conch|daith|earl\/?\s*bridge|eyebrow|flat|forward helix|helix\/?rim|labret|lobe(?:\s*pair)?|madonna\/?monroe|naval|nipple(?:\s*pair)?|nose|orbital|philtrum\/?\s*madusa|rook|scaffold\/?industrial|septum|smiley|snug|surface|tongue|tragus|transverse lobe|vertical labret)(\b|$)/i;

export function inferServiceCategory(rawName: string): string {
  const name = rawName.trim();
  if (!name) return "Other";
  const n = name.toLowerCase().replace(/\s+/g, " ");

  if (/^room out of use$/.test(n) || /^ashley$/.test(n)) return "Other";

  if (/\bcourse\b/.test(n)) return "Courses";

  if (/tooth\s*gem|butterfly\s*tooth/.test(n)) return "Tooth Gems";

  if (
    /welded\s*jewell?ery|bespoke\s*welded|^\s*re\s*weld\b/.test(n) ||
    /^welding\s*jewell?ery/.test(n)
  ) {
    return "Welding Jewellery";
  }

  if (
    /\bpiercing\b/.test(n) ||
    /jewell?ery\s*change/.test(n) ||
    PIERCING_NAMES.test(n)
  ) {
    return "Piercings";
  }

  if (/\blaser\b/.test(n)) return "Laser";

  if (/spray\s*tan/.test(n)) return "Tanning";

  if (
    /anti\s*wrinkle|lip\s*filler|no\s*needle\s*lip|skin\s*booster|vitamin\s*b12|b-?\s*complex\s*injection|nasolabial|plasma\s*eyelid/.test(
      n,
    )
  ) {
    return "Injectables";
  }

  if (
    /fat\s*dissolve|lipo\s*cavitation|thermogenesis|microneedling\s*for\s*body|blemish\s*removal/.test(
      n,
    )
  ) {
    return "Body Treatments";
  }

  if (/\bmassage\b/.test(n)) return "Massage";

  if (
    /\bhair\b|blow\s*dry|gents\s*cut|ladies\s*dry\s*trim|fringe\s*trim|full\s*head\s*(colour|foils)|t\s*section\s*foils|childrens?\s*trim|microneedling\s*for\s*hair/.test(
      n,
    )
  ) {
    return "Hair";
  }

  if (
    /\bfacial\b|dermaplaning|chemical\s*peel|biorepeel|micro-?dermabrasion|microneedling|high\s*frequency|galvanic|radio\s*frequency|back\s*cleanse|hopi\s*ear|aura\s*imaging/.test(
      n,
    )
  ) {
    return "Facials";
  }

  // Lashes before brows so "Lash & Brow" packages land under Lashes.
  // Both stay before wax so "Brow Wax" is Brows, not Waxing.
  if (/\blash\b|lashes\b/.test(n)) return "Lashes";

  if (
    /\bbrow\b|henna\s*brows|hi\s*def\s*brows|semi[-\s]*permanent\s*brows|yearly\s*semi[-\s]*permanent/.test(
      n,
    )
  ) {
    return "Brows";
  }

  if (/\bwax\b|waxing/.test(n)) return "Waxing";

  if (
    /\bpedicure\b|\btoes\b|gel\s*toes|file\s*&\s*paint\s*toes|children'?s?\s*file\s*and\s*paint\s*toes/.test(
      n,
    )
  ) {
    return "Toes";
  }

  if (
    /\bmanicure\b|\bacrylics?\b|\bbiab\b|builder\s*gel|\bgel\s*polish\b|\bgel\s*extensions?\b|\bgel\s*mani\b|nail\s*repair|\bnails\b|file\s*&\s*(paint|clip|polish)|file\s*and\s*paint|full\s*cover\s*tips|gel\s*or\s*acrylic|^\s*re\s*apply\b|children'?s?\s*file\s*and\s*paint\s*nails|glitter\s*tattoo/.test(
      n,
    )
  ) {
    return "Nails";
  }

  if (
    /\bconsultation\b|patch\s*test\s*&\s*skin|piercing\s*check|^patch\s*test\b/.test(n)
  ) {
    return "Consultations";
  }

  if (/chest\s*and\s*stomach/.test(n)) return "Body Treatments";

  return "Other";
}
