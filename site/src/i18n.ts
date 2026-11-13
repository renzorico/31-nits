// All reader-facing text in English, Spanish and Catalan. Every string that
// quotes a number is a function, so numbers stay computed from the data.
// Rule texts (laws, dates, limits) come from src/config.py via meta.json.

export const LANGS = ["en", "es", "ca"] as const;
export type Lang = (typeof LANGS)[number];

const STORAGE_KEY = "lang";

function pickLang(): Lang {
  const fromUrl = new URLSearchParams(location.search).get("lang");
  if (fromUrl && (LANGS as readonly string[]).includes(fromUrl)) {
    try {
      localStorage.setItem(STORAGE_KEY, fromUrl);
    } catch {
      // storage can be blocked; the URL still decides
    }
    return fromUrl as Lang;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (LANGS as readonly string[]).includes(saved)) return saved as Lang;
  } catch {
    // ignore: fall through to the browser language
  }
  for (const pref of navigator.languages ?? [navigator.language]) {
    const code = pref.toLowerCase().slice(0, 2);
    if (code === "ca") return "ca";
    if (code === "es") return "es";
    if (code === "en") return "en";
  }
  return "en";
}

export const LANG: Lang = pickLang();
const LOCALE: Record<Lang, string> = { en: "en-GB", es: "es-ES", ca: "ca-ES" };

// ---------- number and date formats ----------
const intFormat = new Intl.NumberFormat(LOCALE[LANG]);
export const formatInt = (n: number): string => intFormat.format(n);
export function pct(value: number, digits = 1): string {
  const fixed = value.toFixed(digits);
  return LANG === "en" ? `${fixed}%` : `${fixed.replace(".", ",")} %`;
}
export const euro = (value: number): string => (LANG === "en" ? `€${formatInt(Math.round(value))}` : `${formatInt(Math.round(value))} €`);
export const decimal = (value: number, digits = 1): string => (LANG === "en" ? value.toFixed(digits) : value.toFixed(digits).replace(".", ","));
export const signedPct = (value: number): string => `${value > 0 ? "+" : value < 0 ? "−" : ""}${pct(Math.abs(value))}`;
export const signed = (value: number): string => `${value > 0 ? "+" : value < 0 ? "−" : ""}${decimal(Math.abs(value), Number.isInteger(value) ? 0 : 1)}`;

const MONTHS_SHORT: Record<Lang, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."],
  ca: ["gen.", "febr.", "març", "abr.", "maig", "juny", "jul.", "ag.", "set.", "oct.", "nov.", "des."],
};
const MONTHS_FULL: Record<Lang, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  ca: ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"],
};
const parse = (iso: string): Date => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
/** "de " before a month, elided to "d'" before a vowel in Catalan (d'abril, d'octubre). */
const ofMonth = (month: string): string => (LANG === "ca" && /^[aeiou]/.test(month) ? `d'${month}` : `de ${month}`);
/** Prose: "Dec 2025" / "diciembre de 2025" / "desembre de 2025". */
export const monthYear = (iso: string): string => {
  const d = parse(iso);
  if (LANG === "en") return `${MONTHS_SHORT.en[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return `${MONTHS_FULL[LANG][d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
};
/** Chart labels, where space is tight: "Dec 2025" / "dic. 2025" / "des. 2025". */
export const monthShort = (iso: string): string => {
  const d = parse(iso);
  return `${MONTHS_SHORT[LANG][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
/** "12 Nov 2026" / "12 de noviembre de 2026" / "12 de novembre de 2026". */
export const dayMonthYear = (iso: string): string => {
  const d = parse(iso);
  if (LANG === "en") return `${d.getUTCDate()} ${MONTHS_SHORT.en[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return `${d.getUTCDate()} ${ofMonth(MONTHS_FULL[LANG][d.getUTCMonth()] ?? "")} de ${d.getUTCFullYear()}`;
};
/** "2026-01-01" -> "Q1 2026" / "T1 2026" */
export const quarterOf = (iso: string): string => {
  const d = parse(iso);
  return `${LANG === "en" ? "Q" : "T"}${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
};
/** register codes like "2026_3T" -> "Q3 2026" / "T3 2026" */
export const registerQuarter = (code: string): string => {
  const [year, q] = code.split("_");
  return `${LANG === "en" ? "Q" : "T"}${(q ?? "").replace("T", "")} ${year}`;
};

/** "a, b and c" in the reader's language */
export function list(items: string[]): string {
  const and = { en: "and", es: "y", ca: "i" }[LANG];
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${and} ${items.at(-1)}`;
}

/** A translated field of a config record (lever or later development), English as fallback. */
export function leverText<F extends string, R extends { i18n?: Partial<Record<"es" | "ca", Partial<Record<F, string | string[]>>>> } & Record<F, unknown>>(
  record: R,
  field: F,
): R[F] {
  const translated = LANG === "en" ? undefined : record.i18n?.[LANG]?.[field];
  return (translated ?? record[field]) as R[F];
}

// ---------- the strings ----------
type Band = "under_31" | "exactly_31" | "over_31";

interface Strings {
  htmlTitle: string;
  skip: string;
  banner: (from: string, to: string) => string;
  how: string;
  scroll: string;
  eyebrow: string;
  language: string;
  band: (band: Band, line: number) => string;
  nights: (n: number) => string;
  nightsOrMore: (n: number) => string;
  minimum: (nightsText: string) => string;
  noPrice: string;
  askingPrice: (price: string) => string;
  listingsOf: (n: string, p: string, total: string) => string;
  listingsN: (n: string) => string;
  byline: (author: string, published: string, dataTo: string, url: string) => string;

  hero: {
    title: (inTen: number) => string;
    lede: (line: number, round: string, bcn: string, lo: string, hi: string, cities: string) => string;
    statListings: (round: string) => string;
    statShare: (line: number) => string;
    statOthers: string;
    statRegister: string;
  };
  wall: {
    title: (one: string, line: number, near: string) => string;
    sub: (line: number, n31: string, n32: string) => string;
    how: (snapshot: string, line: number, folded: number) => string;
    lineWide: (line: number) => string;
    lineNarrow: (line: number) => string;
    askPlus: (p: string, line: number) => string;
    oneNight: string;
    aria: (one: string, near: string, line: number, others: string) => string;
    otherAria: (city: string, p: string, line: number) => string;
  };
  price: {
    title: (line: number, one: string, after: string) => string;
    sub: (ratio: string, between: string, lo: number, hi: number) => string;
    how: (snapshot: string, line: number, min: number) => string;
    label: (nightsText: string, price: string) => string;
    tip: (price: string, n: string) => string;
    aria: (one: string, line: number, after: string) => string;
  };
  map: {
    title: (high: string, highPct: string, line: number, low: string, lowPct: string) => string;
    sub: (dots: [string, string, string], line: number) => string;
    how: string;
    aria: string;
    snapshot: string;
    attribution: string;
    failed: string;
    room: (room: string) => string;
  };
  flows: {
    title: (from: string, n: string, gone: string, to: string, shortGone: string) => string;
    sub: (from: string, to: string, switched: string, gone: string) => string;
    how: string;
    inactive: string;
    gone: string;
    inactiveShort: string;
    goneShort: string;
    tip: (fromLabel: string, toLabel: string, n: string, p: string, from: string) => string;
    aria: (from: string, to: string, gone: string, total: string, shortGone: string, shortTotal: string) => string;
  };
  gap: {
    title: (more: number, total: number, distinct: string | null) => string;
    sub: (from: string, to: string, mp: string, sh: string, clear: number, line: number) => string;
    how: (lo: string, hi: string) => string;
    monthPlus: (line: number) => string;
    shorter: (line: number) => string;
    axis: string;
    apart: (points: string) => string;
    tip: (city: string, mp: string, nmp: string, sh: string, nsh: string, points: string, lo: string, hi: string, contrast: string) => string;
    contrast: (city: string, diff: string, lo: string, hi: string) => string;
    aria: (rows: string) => string;
  };
  licences: {
    groups: Record<"tourist_flat" | "hotel" | "exempt_seasonal" | "other" | "missing", string>;
    title: (firstMissing: string, firstMonth: string, lastMissing: string, lastMonth: string, seasonal: string) => string;
    sub: (seasonalFirst: string, before: string | null) => string;
    how: string;
    row: (month: string, n: string) => string;
    tip: (label: string, n: string, total: string, p: string, month: string) => string;
    aria: string;
  };
  register: {
    title: (p: string, all: string) => string;
    sub: (first: string, firstQ: string, last: string, lastQ: string, numbers: string, deadline: string | null, days: string | null) => string;
    how: (quarter: string, snapshot: string, found: string) => string;
    vs: (quarter: string) => string;
    vsWord: string;
    tip: (month: string, n: string, all: string, quarter: string, p: string) => string;
    aria: (values: string) => string;
  };
  hosts: {
    title: (overall: string, min: number, hood: string, hoodPct: string) => string;
    sub: (others: string[], top1: string) => string;
    how: (round: string, min: number, minListings: number) => string;
    rampLabel: (min: number) => string;
    tip: (district: string, p: string, n: string, min: number) => string;
    aria: (p: string, min: number) => string;
  };
  atlas: {
    title: (high: string, highPct: string, line: number, low: string, lowPct: string) => string;
    sub: (line: number, min: number) => string;
    how: string;
    explore: string;
    masked: (min: number) => string;
    tooFew: (n: string, min: number) => string;
    rampLabel: (line: number) => string;
    tip: (district: string, p: string, n: string, line: number) => string;
    aria: (line: number) => string;
  };
  rents: {
    title: (q: string, rent: string, p: string, fewer: boolean, q0: string) => string;
    sub: (r0: string, q0: string, peak: string, qp: string, r1: string, q1: string, n0: string, n1: string) => string;
    how: (rules: string) => string;
    legendRent: string;
    legendLeases: string;
    axisLeases: string;
    tip: (q: string, rent: string, yoy: string | null, n: string) => string;
    aria: (r0: string, q0: string, r1: string, q1: string, n0: string, n1: string) => string;
  };
  rules: {
    title: (n: number, year: number) => string;
    sub: (checked: string, from: string, to: string) => string;
    says: string;
    shows: string;
    cannot: string;
    from: (date: string) => string;
    checked: (date: string) => string;
    snapshots: string;
    snapshotsNarrow: string;
    today: string;
    since: (year: number) => string;
    deadlineTitle: string;
    deadlineLabel: string;
    laterShows: string;
    showsLicence: (min: string, max: string) => string;
    showsRent: (before: string, qb: string, low: string, ql: string, latest: string, qn: string) => string;
    showsSeasonal: (a: string, ma: string, b: string, mb: string, c: string, mc: string, n: number, cities: string) => string;
    showsOwners: string;
    aria: (events: string) => string;
  };
  method: {
    title: string;
    sub: string;
    steps: (snapshots: number, cities: number, line: number) => [string, string][];
    all: string;
    sizes: (round: string, sizes: string) => string;
    dataAsOf: (month: string, checked: string) => string;
    code: string;
    credits: string;
    loadFailed: string;
  };
}

const en: Strings = {
  htmlTitle: "31 nits: Barcelona's Airbnb listings and the housing rules",
  skip: "Skip to the content",
  banner: (from, to) => `<b>31 nits</b> · Airbnb in Barcelona and four Spanish cities, ${from} – ${to}`,
  how: "How is this made?",
  scroll: "Scroll ↓",
  eyebrow: "Short-term rentals · housing rules · open data",
  language: "Language",
  band: (b, line) => (b === "under_31" ? `Under ${line} nights` : b === "exactly_31" ? `Exactly ${line}` : `Over ${line}`),
  nights: (n) => `${n} night${n === 1 ? "" : "s"}`,
  nightsOrMore: (n) => `${n} or more nights`,
  minimum: (t) => `${t} minimum`,
  noPrice: "no price data",
  askingPrice: (p) => `median asking price ${p} a night`,
  listingsOf: (n, p, total) => `${n} listings, ${p} of ${total}`,
  listingsN: (n) => `${n} listings`,
  byline: (a, p, d, url) => `By <b>${a}</b> · Published ${p} · Data to ${d} · <a href="${url}" target="_blank" rel="noopener">Code and corrections</a>`,

  hero: {
    title: (k) => `<em>${k} in 10</em> Barcelona Airbnb listings ask guests to stay a month or more.`,
    lede: (line, round, bcn, lo, hi, cities) =>
      `In Catalonia a tourist stay is legally ${line} days or fewer. In ${round}, ${bcn} of Barcelona's Airbnb listings with open dates asked for a minimum of ${line} nights or more. In ${cities}, between ${lo} and ${hi} did. What that shows about the housing rules, and what it cannot.`,
    statListings: (r) => `Barcelona listings with open dates, ${r}`,
    statShare: (line) => `ask for ${line}+ nights`,
    statOthers: "the same share in Madrid, Valencia, Málaga, Sevilla",
    statRegister: "tourist flats on the city's official register",
  },
  wall: {
    title: (one, line, near) => `Barcelona's listings split in two: one night (${one}) or ${line}–${line + 1} nights (${near}).`,
    sub: (line, n31, n32) =>
      `Each bar is the share of a city's Airbnb listings with open dates that ask for that minimum stay. In Catalonia a tourist stay is ${line} days or fewer, and ${n31} Barcelona listings ask exactly ${line} nights while ${n32} ask ${line + 1}. The four other cities, drawn on the same scale, have no such wall.`,
    how: (snapshot, line, folded) =>
      `Latest snapshot per city (Barcelona ${snapshot}). A minimum stay is a setting the host chooses: it is not how long guests stay, and not a legal finding. Whether a ${line}-night booking counts as "${line} days or fewer" is ambiguous, so exactly ${line} has its own colour. Minimum stays of ${folded} nights or more are grouped in the last bar. Outside Catalonia ${line} nights has no legal meaning and is only a common yardstick.`,
    lineWide: (line) => `Catalan tourist-stay limit: ${line} days or fewer`,
    lineNarrow: (line) => `tourist stay: ${line} days or fewer`,
    askPlus: (p, line) => `${p} ask ${line}+`,
    oneNight: "1 night",
    aria: (one, near, line, others) => `Bar charts of minimum stays. Barcelona: ${one} ask 1 night and ${near} ask ${line} or ${line + 1}. ${others}`,
    otherAria: (city, p, line) => `${city}: ${p} ask ${line} or more`,
  },
  price: {
    title: (line, one, after) => `A one-night listing asks ${one} a night; a ${line + 1}-night listing asks ${after}.`,
    sub: (ratio, between, lo, hi) =>
      `Same city, same platform, ${ratio} times apart. Each stem is a minimum stay at the median nightly price its listings ask. Only ${between} of listings ask for a minimum between ${lo} and ${hi} nights.`,
    how: (snapshot, line, min) =>
      `Barcelona, snapshot ${snapshot}. Prices are what hosts ask per night, before fees and before any weekly or monthly discount, so they are not what guests paid, and a month at the ${line + 1}-night price is not a monthly rent. Only minimum stays asked by at least ${min} listings are shown.`,
    label: (t, p) => `${t}: ${p}`,
    tip: (p, n) => `median asking price ${p} a night<br>${n} listings`,
    aria: (one, line, after) => `Lollipop chart: median asking price per night by minimum stay in Barcelona. 1 night: ${one}; ${line + 1} nights: ${after}.`,
  },
  map: {
    title: (h, hp, line, l, lp) => `In ${h}, ${hp} of listings ask for ${line} nights or more; in ${l}, ${lp}.`,
    sub: ([a, b, c], line) =>
      `Every dot is one Airbnb listing with open dates: ${a}under ${line} nights, ${b}exactly ${line}, ${c}over ${line}. Hide a group or switch the quarter with the buttons below; tap a dot for its details.`,
    how: "Inside Airbnb, an independent project, publishes scraped Airbnb listings. It offsets each point by up to 150 m to protect hosts' privacy, so a dot is never an address. No host or listing is identified on this page. District shares are computed from the neighbourhood figures the map export also uses.",
    aria: "Map of Barcelona's Airbnb listings with open dates, coloured by minimum stay",
    snapshot: "Snapshot",
    attribution: "Listings: Inside Airbnb (CC BY 4.0)",
    failed: "The map could not load. The figures above do not depend on it.",
    room: (r) => r,
  },
  flows: {
    title: (from, n, gone, to, s) => `Of the ${n} listings asking a month or more in ${from}, ${gone} had vanished from Airbnb by ${to}. Of shorter stays, ${s}.`,
    sub: (from, to, switched, gone) =>
      `Each listing can be followed from ${from} to ${to} by its id. Almost none of the month-long listings switched to short stays (${switched}), while ${gone} disappeared. Catalonia extended its rent limit to seasonal lets on 1 January 2026, in between. Only the two flows that carry this story are in colour.`,
    how: "Absent means withdrawn, re-listed under a new id, or missed by the scraper: the file cannot say which. Listed without open dates can mean fully booked, blocked or paused. Listings that first appeared after the first snapshot are not in this diagram.",
    inactive: "Listed, no open dates",
    gone: "Absent from the scrape",
    inactiveShort: "No open dates",
    goneShort: "Absent",
    tip: (a, b, n, p, from) => `<b>${a} → ${b.toLowerCase()}</b>${n} listings, ${p} of the ${a.toLowerCase()} group in ${from}`,
    aria: (from, to, g, t, sg, st) => `Flow diagram, Barcelona ${from} to ${to}: ${g} of ${t} month-plus listings and ${sg} of ${st} shorter-stay listings were absent from the later scrape.`,
  },
  gap: {
    title: (n, total, distinct) =>
      `In ${n === total ? `all ${total}` : `${n} of ${total}`} cities, listings asking a month or more disappeared more often than shorter stays. ${distinct ? `Barcelona's difference stands apart from ${distinct}'s.` : "Barcelona does not stand out."}`,
    sub: (from, to, mp, sh, clear, line) =>
      `Each row takes the listings a city had with open dates in ${from} and counts how many were gone from Airbnb by ${to}. In Barcelona, ${mp} of those asking ${line} nights or more were gone, against ${sh} of the rest. The difference is clearly above zero in ${clear} of 5 cities. Only Barcelona is under the Catalan rule that extended the rent limit to seasonal lets in January 2026.`,
    how: (lo, hi) =>
      `“Gone” means absent from the later snapshot: withdrawn, re-listed under a new id, or missed by the scraper; the files cannot say which. Listings that first appeared after the first snapshot are not counted. The distance between the two dots has a 95% interval from resampling whole host accounts, because one operator can withdraw many listings at once (Barcelona: ${lo} to ${hi} points). A city is called different from Barcelona only when the interval of the difference between the two excludes zero. The other cities have two snapshots each, about nine months apart.`,
    monthPlus: (line) => `Asking ${line} nights or more`,
    shorter: (line) => `Asking under ${line} nights`,
    axis: "share of listings gone by the later snapshot →",
    apart: (p) => `${p} points`,
    tip: (c, mp, nmp, sh, nsh, p, lo, hi, contrast) =>
      `<b>${c}</b>${mp} of ${nmp} listings asking a month or more were gone<br>${sh} of ${nsh} shorter-stay listings were gone<br>Difference: ${p} points (95% interval ${lo} to ${hi})${contrast}`,
    contrast: (c, d, lo, hi) => `<br>Barcelona minus ${c}: ${d} points (${lo} to ${hi})`,
    aria: (rows) => `Dot chart, share of listings gone by the later snapshot, month-plus against shorter stays: ${rows}`,
  },
  licences: {
    groups: {
      tourist_flat: "Tourist-flat licence (HUT)",
      hotel: "Hotel or hostel",
      exempt_seasonal: "“Exempt: seasonal rental”",
      other: "Other exemption or code",
      missing: "Nothing shown",
    },
    title: (fm, fmo, lm, lmo, seasonal) => `Listings showing no licence number fell from ${fm} to ${lm} between ${fmo} and ${lmo}; ${seasonal} now say “exempt: seasonal rental”.`,
    sub: (first, before) =>
      `Airbnb asks Barcelona hosts for a licence number. Each bar splits one quarter's listings with open dates by what that field shows. The “exempt: seasonal rental” answer first appears in ${first}${before ? `; it was not in the ${before} data, so its rise is partly a change in Airbnb's form` : ""}.`,
    how: "The field is filled in by hosts and is not checked against any register here; the next screen does that for tourist-flat numbers. A missing or unmatched number is not proof that a listing breaks a rule, and seasonal lets need no tourist licence.",
    row: (m, n) => `${m} · ${n} listings`,
    tip: (l, n, t, p, m) => `<b>${l}</b>${n} of ${t} listings (${p}), ${m}`,
    aria: "Stacked bars per quarter of what Barcelona listings show in the licence field.",
  },
  register: {
    title: (p, all) => `${p} of Barcelona's ${all} tourist-flat licence numbers appear on an Airbnb listing with open dates.`,
    sub: (f, fq, l, lq, numbers, deadline, days) =>
      `The city's register has barely moved: ${f} records in ${fq}, ${l} in ${lq} (${numbers} distinct licence numbers).${deadline ? ` Under a 2023 Catalan decree these flats need an urban-planning licence by ${deadline} or must stop operating as tourist flats${days ? `: ${days} days from today` : ""}.` : ""}`,
    how: (q, s, found) =>
      `Each bar compares one snapshot with the nearest published register quarter (latest: ${s} against ${q}). The green part is the share of the register's licence numbers shown on at least one listing with open dates. ${found} of the numbers listings display exist in the register. A match shows the number exists; it does not show the listing is that flat. A number not shown is not an empty flat: it may let on other platforms, directly, or not at all. Owners can ask for one extension of up to five years. The council has said (June 2024 press reports) that it does not plan to grant the new licences; that is a stated policy, not a legal text.`,
    vs: (q) => `register ${q}`,
    vsWord: "register",
    tip: (m, n, all, q, p) => `<b>${m}</b>${n} of ${all} licence numbers in the ${q} register (${p}) are shown on a listing with open dates`,
    aria: (v) => `Bar chart: share of the register's licence numbers shown on Airbnb, by snapshot: ${v}.`,
  },
  hosts: {
    title: (o, min, hood, hp) => `${o} of Barcelona's listings belong to accounts with ${min} or more listings; in ${hood}, ${hp}.`,
    sub: (others, top1) =>
      `Each neighbourhood is coloured by the share of its listings run by an account with 5 or more listings. In the other cities: ${list(others)}. The largest 1% of accounts alone run ${top1} of Barcelona's listings.`,
    how: (r, min, ml) =>
      `${r} snapshot, listings with open dates. Account size is counted per snapshot. An account is not a person or a company: one firm can run several accounts, and one account can manage flats for many owners. Neighbourhoods with fewer than ${ml} listings are hatched. ${min} or more listings is a working definition of a professional host, not a legal one.`,
    rampLabel: (min) => `Share of listings in accounts with ${min}+ listings`,
    tip: (d, p, n, min) => `${d}<br>${p} of ${n} listings are in accounts with ${min}+ listings`,
    aria: (p, min) => `Map of Barcelona's neighbourhoods coloured by the share of listings in accounts with ${min} or more listings; citywide ${p}.`,
  },
  atlas: {
    title: (h, hp, line, l, lp) => `In ${h}, ${hp} of listings ask for ${line} nights or more; in ${l}, ${lp}.`,
    sub: (line, min) => `Each neighbourhood is coloured by the share of its Airbnb listings with open dates that ask for ${line} nights or more. Hatched neighbourhoods have fewer than ${min} listings, too few for a share.`,
    how: "Neighbourhood figures are computed from Inside Airbnb, an independent project that publishes scraped Airbnb listings, and its neighbourhood boundaries. District figures in the title weight each neighbourhood by its listings. The explorer below shows each listing as a dot, offset by up to 150 m to protect hosts' privacy, so a dot is never an address.",
    explore: "Explore every listing on a map",
    masked: (min) => `fewer than ${min} listings`,
    tooFew: (n, min) => `only ${n} listings: fewer than ${min}, too few for a share`,
    rampLabel: (line) => `Share asking ${line}+ nights`,
    tip: (d, p, n, line) => `${d}<br>${p} of ${n} listings ask ${line}+ nights`,
    aria: (line) => `Map of Barcelona's neighbourhoods coloured by the share of listings asking ${line} nights or more.`,
  },
  rents: {
    title: (q, rent, p, fewer, q0) => `In ${q} new leases averaged ${rent} a month, and ${p} ${fewer ? "fewer" : "more"} were lodged than in ${q0}.`,
    sub: (r0, q0, peak, qp, r1, q1, n0, n1) =>
      `The average rent of a new lease rose from ${r0} a month (${q0}) to a peak of ${peak} (${qp}) and was ${r1} a month in ${q1}. New leases lodged went from ${n0} to ${n1} a quarter. The dashed lines mark when the two rent rules began.`,
    how: (rules) =>
      `From the deposits landlords must lodge with the Catalan housing agency (Incasòl), Barcelona city, euros of each year (not adjusted for inflation). The timing is shown; the cause is not. Interest rates, wages, supply and the mix of flats rented all move the average, and a lease that is never lodged is not counted. Rule dates: ${rules}.`,
    legendRent: "Average monthly rent, new leases",
    legendLeases: "New leases lodged per quarter",
    axisLeases: "new leases a quarter",
    tip: (q, r, yoy, n) => `<b>${q}</b>average rent ${r} a month${yoy ? ` (${yoy} on a year earlier)` : ""}<br>${n} new leases lodged`,
    aria: (r0, q0, r1, q1, n0, n1) => `Line chart: average rent of new leases from ${r0} in ${q0} to ${r1} in ${q1}; bars: new leases from ${n0} to ${n1} a quarter.`,
  },
  rules: {
    title: (n, y) => `${n} rules from Catalan and Spanish law, and a deadline in ${y}.`,
    sub: (c, f, t) => `Not every rule in force: the ones this data can say something about, checked against the official gazettes on ${c}. The shaded band is when the snapshots were taken (${f} – ${t}). Select a rule to read it.`,
    says: "What it says",
    shows: "What the data shows",
    cannot: "What it cannot show",
    from: (d) => `from ${d}`,
    checked: (d) => `Checked ${d}.`,
    snapshots: "snapshots",
    snapshotsNarrow: "data",
    today: "today",
    since: (y) => `← since ${y}: `,
    deadlineTitle: "End of the tourist-flat transition",
    deadlineLabel: "Licence deadline",
    laterShows: "Nothing yet: it was published after every snapshot used here, so it cannot explain any change in this data.",
    showsLicence: (a, b) => `The register holds ${a}–${b} records in every published quarter: no decline yet. A stable register before a deadline says nothing about what happens after it.`,
    showsRent: (b, qb, l, ql, n, qn) => `New-lease rents were rising ${b} a year just before the limit (${qb}), fell to ${l} (${ql}), and were ${n} in ${qn}.`,
    showsSeasonal: (a, ma, b, mb, c, mc, n, cities) =>
      `Listings asking over 31 nights: ${a} (${ma}), ${b} (${mb}), ${c} (${mc}). Month-plus listings left the scrape more often than shorter ones in ${n} of 5 cities (${cities}), and Barcelona's difference cannot be told apart from any other city's.`,
    showsOwners: "No direct measure. This rule acts building by building, and listing data cannot see it.",
    aria: (e) => `Timeline of rules: ${e}`,
  },
  method: {
    title: "How this was made, and what it cannot show.",
    sub: "Every number on this page is computed from public files by an open Python pipeline, with its numerator and denominator in the published data. The data shows settings, counts and timing. It does not show causes, how long guests actually stay, or whether any listing breaks a rule.",
    steps: (s, c, line) => [
      ["Download", `${s} Inside Airbnb snapshots for ${c} cities, the city's tourist-flat register, and official rents.`],
      ["Count", "Only listings with at least one open date in the next year, so dormant ones do not inflate the totals."],
      ["Classify", `Each listing by the minimum stay it asks: under ${line}, exactly ${line}, or over. Never by legality.`],
      ["Match", "Licence numbers shown on listings against the register, as numbers, never as addresses."],
      ["Compare", "Cities with intervals that resample whole host accounts, so one large operator cannot fake a pattern."],
      ["Publish", "Tests check that no host, listing or address can be identified in the published data."],
    ],
    all: "All caveats and sources",
    sizes: (r, s) => `Listings with open dates in the ${r} snapshots: ${s}. A minimum stay is a setting, not a stay; a missing licence number is not proof of a breach; comparisons show timing and differences, not causes.`,
    dataAsOf: (m, c) => `Data as of ${m}; rules checked ${c}.`,
    code: "Code, notebooks and corrections:",
    credits: "Data: Inside Airbnb, Ajuntament de Barcelona, Generalitat de Catalunya (CC BY 4.0)",
    loadFailed: "The data could not load. Please reload the page.",
  },
};

const es: Strings = {
  htmlTitle: "31 nits: los anuncios de Airbnb en Barcelona y las normas de vivienda",
  skip: "Saltar al contenido",
  banner: (from, to) => `<b>31 nits</b> · Airbnb en Barcelona y otras cuatro ciudades españolas, ${from} – ${to}`,
  how: "¿Cómo se ha hecho?",
  scroll: "Desliza ↓",
  eyebrow: "Alquiler de corta estancia · normas de vivienda · datos abiertos",
  language: "Idioma",
  band: (b, line) => (b === "under_31" ? `Menos de ${line} noches` : b === "exactly_31" ? `Exactamente ${line}` : `Más de ${line}`),
  nights: (n) => `${n} noche${n === 1 ? "" : "s"}`,
  nightsOrMore: (n) => `${n} noches o más`,
  minimum: (t) => `mínimo ${t}`,
  noPrice: "sin datos de precio",
  askingPrice: (p) => `precio mediano pedido: ${p} por noche`,
  listingsOf: (n, p, total) => `${n} anuncios, ${p} de ${total}`,
  listingsN: (n) => `${n} anuncios`,
  byline: (a, p, d, url) => `Por <b>${a}</b> · Publicado el ${p} · Datos hasta ${d} · <a href="${url}" target="_blank" rel="noopener">Código y correcciones</a>`,

  hero: {
    title: (k) => `<em>${k} de cada 10</em> anuncios de Airbnb en Barcelona piden quedarse un mes o más.`,
    lede: (line, round, bcn, lo, hi, cities) =>
      `En Cataluña, una estancia turística es por ley de ${line} días o menos. En ${round}, el ${bcn} de los anuncios de Airbnb en Barcelona con fechas disponibles pedía una estancia mínima de ${line} noches o más. En ${cities}, entre el ${lo} y el ${hi}. Qué dice esto sobre las normas de vivienda, y qué no puede decir.`,
    statListings: (r) => `anuncios en Barcelona con fechas disponibles, ${r}`,
    statShare: (line) => `piden ${line} noches o más`,
    statOthers: "la misma cifra en Madrid, Valencia, Málaga y Sevilla",
    statRegister: "viviendas de uso turístico en el registro oficial de la ciudad",
  },
  wall: {
    title: (one, line, near) => `Los anuncios de Barcelona se parten en dos: una noche (${one}) o ${line}–${line + 1} noches (${near}).`,
    sub: (line, n31, n32) =>
      `Cada barra es la proporción de anuncios de Airbnb con fechas disponibles que piden esa estancia mínima. En Cataluña una estancia turística es de ${line} días o menos, y ${n31} anuncios de Barcelona piden exactamente ${line} noches, mientras que ${n32} piden ${line + 1}. Las otras cuatro ciudades, a la misma escala, no tienen ese muro.`,
    how: (snapshot, line, folded) =>
      `Última captura de cada ciudad (Barcelona: ${snapshot}). La estancia mínima es un ajuste que elige el anfitrión: no es lo que duran las estancias ni una valoración legal. No está claro si una reserva de ${line} noches cuenta como «${line} días o menos», por eso «exactamente ${line}» tiene su propio color. Las estancias mínimas de ${folded} noches o más se agrupan en la última barra. Fuera de Cataluña, ${line} noches no tiene significado legal y se usa solo como referencia común.`,
    lineWide: (line) => `Límite catalán de estancia turística: ${line} días o menos`,
    lineNarrow: (line) => `estancia turística: ${line} días o menos`,
    askPlus: (p, line) => `${p} piden ${line}+`,
    oneNight: "1 noche",
    aria: (one, near, line, others) => `Gráficos de barras de estancias mínimas. Barcelona: el ${one} pide 1 noche y el ${near} pide ${line} o ${line + 1}. ${others}`,
    otherAria: (city, p, line) => `${city}: el ${p} pide ${line} o más`,
  },
  price: {
    title: (line, one, after) => `Un anuncio de una noche pide ${one} por noche; uno de ${line + 1} noches, ${after}.`,
    sub: (ratio, between, lo, hi) =>
      `Misma ciudad, misma plataforma: ${ratio} veces más. Cada barra es una estancia mínima, a la altura del precio mediano por noche que piden sus anuncios. Solo el ${between} de los anuncios pide un mínimo de entre ${lo} y ${hi} noches.`,
    how: (snapshot, line, min) =>
      `Barcelona, captura del ${snapshot}. Son precios pedidos por noche, sin tasas ni descuentos semanales o mensuales: no son lo que pagaron los huéspedes, y un mes al precio de ${line + 1} noches no es un alquiler mensual. Solo se muestran las estancias mínimas que piden al menos ${min} anuncios.`,
    label: (t, p) => `${t}: ${p}`,
    tip: (p, n) => `precio mediano pedido: ${p} por noche<br>${n} anuncios`,
    aria: (one, line, after) => `Gráfico de piruletas: precio mediano pedido por noche según la estancia mínima en Barcelona. 1 noche: ${one}; ${line + 1} noches: ${after}.`,
  },
  map: {
    title: (h, hp, line, l, lp) => `En ${h}, el ${hp} de los anuncios pide ${line} noches o más; en ${l}, el ${lp}.`,
    sub: ([a, b, c], line) =>
      `Cada punto es un anuncio de Airbnb con fechas disponibles: ${a}menos de ${line} noches, ${b}exactamente ${line}, ${c}más de ${line}. Oculta un grupo o cambia de trimestre con los botones; toca un punto para ver sus datos.`,
    how: "Inside Airbnb, un proyecto independiente, publica anuncios de Airbnb extraídos de la web. Desplaza cada punto hasta 150 m para proteger la privacidad de los anfitriones, así que un punto nunca es una dirección. En esta página no se identifica a ningún anfitrión ni anuncio. Las cifras por distrito se calculan a partir de los datos por barrio que usa también el mapa.",
    aria: "Mapa de los anuncios de Airbnb con fechas disponibles en Barcelona, coloreados por estancia mínima",
    snapshot: "Captura",
    attribution: "Anuncios: Inside Airbnb (CC BY 4.0)",
    failed: "No se ha podido cargar el mapa. Las cifras anteriores no dependen de él.",
    room: (r) => ({ "Entire home/apt": "Vivienda entera", "Private room": "Habitación privada", "Shared room": "Habitación compartida", "Hotel room": "Habitación de hotel" })[r] ?? r,
  },
  flows: {
    title: (from, n, gone, to, s) => `De los ${n} anuncios que pedían un mes o más en ${from}, el ${gone} había desaparecido de Airbnb en ${to}. De los de estancia más corta, el ${s}.`,
    sub: (from, to, switched, gone) =>
      `Cada anuncio se puede seguir de ${from} a ${to} por su identificador. Casi ningún anuncio de un mes o más pasó a estancias cortas (${switched}), mientras que ${gone} desaparecieron. Entre ambas fechas, el 1 de enero de 2026, Cataluña extendió el límite del alquiler a los alquileres de temporada. Solo están en color los dos flujos que cuentan esta historia.`,
    how: "Ausente significa retirado, vuelto a publicar con otro identificador o no captado por el rastreador: el archivo no permite saber cuál. Publicado sin fechas disponibles puede ser completo, bloqueado o en pausa. Los anuncios que aparecieron después de la primera captura no están en este diagrama.",
    inactive: "Publicado, sin fechas",
    gone: "Ausente de la captura",
    inactiveShort: "Sin fechas",
    goneShort: "Ausente",
    tip: (a, b, n, p, from) => `<b>${a} → ${b.toLowerCase()}</b>${n} anuncios, el ${p} del grupo «${a.toLowerCase()}» en ${from}`,
    aria: (from, to, g, t, sg, st) => `Diagrama de flujos, Barcelona ${from} a ${to}: ${g} de ${t} anuncios de un mes o más y ${sg} de ${st} de estancia más corta estaban ausentes de la captura posterior.`,
  },
  gap: {
    title: (n, total, distinct) =>
      `En ${n === total ? `las ${total}` : `${n} de ${total}`} ciudades, los anuncios que pedían un mes o más desaparecieron más a menudo que los de estancia más corta. ${distinct ? `La diferencia de Barcelona se distingue de la de ${distinct}.` : "Barcelona no destaca."}`,
    sub: (from, to, mp, sh, clear, line) =>
      `Cada fila toma los anuncios con fechas disponibles que tenía una ciudad en ${from} y cuenta cuántos habían desaparecido de Airbnb en ${to}. En Barcelona desapareció el ${mp} de los que pedían ${line} noches o más, frente al ${sh} del resto. La diferencia es claramente mayor que cero en ${clear} de 5 ciudades. Solo Barcelona está bajo la norma catalana que extendió el límite del alquiler a los alquileres de temporada en enero de 2026.`,
    how: (lo, hi) =>
      `«Desaparecido» significa ausente de la captura posterior: retirado, vuelto a publicar con otro identificador o no captado por el rastreador; los archivos no permiten saber cuál. Los anuncios que aparecieron después de la primera captura no se cuentan. La distancia entre los dos puntos tiene un intervalo del 95 % obtenido remuestreando cuentas de anfitrión enteras, porque un solo operador puede retirar muchos anuncios a la vez (Barcelona: de ${lo} a ${hi} puntos). Una ciudad solo se considera distinta de Barcelona cuando el intervalo de la diferencia entre ambas excluye el cero. Las otras ciudades tienen dos capturas cada una, separadas unos nueve meses.`,
    monthPlus: (line) => `Piden ${line} noches o más`,
    shorter: (line) => `Piden menos de ${line} noches`,
    axis: "proporción de anuncios desaparecidos en la captura posterior →",
    apart: (p) => `${p} puntos`,
    tip: (c, mp, nmp, sh, nsh, p, lo, hi, contrast) =>
      `<b>${c}</b>Desapareció el ${mp} de ${nmp} anuncios de un mes o más<br>y el ${sh} de ${nsh} anuncios de estancia más corta<br>Diferencia: ${p} puntos (intervalo del 95 %: de ${lo} a ${hi})${contrast}`,
    contrast: (c, d, lo, hi) => `<br>Barcelona menos ${c}: ${d} puntos (de ${lo} a ${hi})`,
    aria: (rows) => `Gráfico de puntos, proporción de anuncios desaparecidos en la captura posterior, de un mes o más frente a estancias más cortas: ${rows}`,
  },
  licences: {
    groups: {
      tourist_flat: "Licencia de vivienda turística (HUT)",
      hotel: "Hotel o albergue",
      exempt_seasonal: "«Exento: alquiler de temporada»",
      other: "Otra exención o código",
      missing: "Nada indicado",
    },
    title: (fm, fmo, lm, lmo, seasonal) => `Los anuncios sin número de licencia bajaron del ${fm} al ${lm} entre ${fmo} y ${lmo}; el ${seasonal} dice ahora «exento: alquiler de temporada».`,
    sub: (first, before) =>
      `Airbnb pide a los anfitriones de Barcelona un número de licencia. Cada barra reparte los anuncios con fechas disponibles de un trimestre según lo que muestra ese campo. La respuesta «exento: alquiler de temporada» aparece por primera vez en ${first}${before ? `; no estaba en los datos de ${before}, así que su aumento se debe en parte a un cambio en el formulario de Airbnb` : ""}.`,
    how: "El campo lo rellenan los anfitriones y aquí no se contrasta con ningún registro; la siguiente pantalla lo hace con los números de vivienda turística. Un número ausente o que no coincide no prueba que un anuncio incumpla ninguna norma, y los alquileres de temporada no necesitan licencia turística.",
    row: (m, n) => `${m} · ${n} anuncios`,
    tip: (l, n, t, p, m) => `<b>${l}</b>${n} de ${t} anuncios (${p}), ${m}`,
    aria: "Barras apiladas por trimestre de lo que muestran los anuncios de Barcelona en el campo de licencia.",
  },
  register: {
    title: (p, all) => `El ${p} de los ${all} números de licencia de vivienda turística de Barcelona aparece en un anuncio de Airbnb con fechas disponibles.`,
    sub: (f, fq, l, lq, numbers, deadline, days) =>
      `El registro de la ciudad apenas se ha movido: ${f} registros en el ${fq} y ${l} en el ${lq} (${numbers} números de licencia distintos).${deadline ? ` Según un decreto catalán de 2023, estas viviendas necesitan una licencia urbanística antes del ${deadline} o deben dejar de funcionar como viviendas turísticas${days ? `: quedan ${days} días` : ""}.` : ""}`,
    how: (q, s, found) =>
      `Cada barra compara una captura con el trimestre del registro publicado más cercano (la última: ${s} con el ${q}). La parte verde es la proporción de números de licencia del registro que aparecen en al menos un anuncio con fechas disponibles. El ${found} de los números que muestran los anuncios existe en el registro. Una coincidencia muestra que el número existe, no que el anuncio sea esa vivienda. Un número que no aparece no es un piso vacío: puede alquilarse en otras plataformas, directamente o no alquilarse. Los propietarios pueden pedir una única prórroga de hasta cinco años. El Ayuntamiento ha dicho (prensa de junio de 2024) que no prevé conceder las nuevas licencias; es una política anunciada, no un texto legal.`,
    vs: (q) => `registro ${q}`,
    vsWord: "registro",
    tip: (m, n, all, q, p) => `<b>${m}</b>${n} de ${all} números de licencia del registro del ${q} (${p}) aparecen en un anuncio con fechas disponibles`,
    aria: (v) => `Gráfico de barras: proporción de números de licencia del registro que aparecen en Airbnb, por captura: ${v}.`,
  },
  hosts: {
    title: (o, min, hood, hp) => `El ${o} de los anuncios de Barcelona pertenece a cuentas con ${min} anuncios o más; en ${hood}, el ${hp}.`,
    sub: (others, top1) =>
      `Cada barrio está coloreado según la proporción de sus anuncios gestionados por una cuenta con 5 anuncios o más. En las otras ciudades: ${list(others)}. El 1 % de cuentas más grandes gestiona por sí solo el ${top1} de los anuncios de Barcelona.`,
    how: (r, min, ml) =>
      `Captura de ${r}, anuncios con fechas disponibles. El tamaño de la cuenta se cuenta en cada captura. Una cuenta no es una persona ni una empresa: una empresa puede tener varias cuentas, y una cuenta puede gestionar pisos de muchos propietarios. Los barrios con menos de ${ml} anuncios aparecen rayados. ${min} anuncios o más es una definición práctica de anfitrión profesional, no una definición legal.`,
    rampLabel: (min) => `Proporción de anuncios en cuentas con ${min}+ anuncios`,
    tip: (d, p, n, min) => `${d}<br>el ${p} de ${n} anuncios está en cuentas con ${min}+ anuncios`,
    aria: (p, min) => `Mapa de los barrios de Barcelona coloreados según la proporción de anuncios en cuentas con ${min} anuncios o más; en toda la ciudad, el ${p}.`,
  },
  atlas: {
    title: (h, hp, line, l, lp) => `En ${h}, el ${hp} de los anuncios pide ${line} noches o más; en ${l}, el ${lp}.`,
    sub: (line, min) => `Cada barrio está coloreado según la proporción de sus anuncios de Airbnb con fechas disponibles que piden ${line} noches o más. Los barrios rayados tienen menos de ${min} anuncios, demasiado pocos para dar una proporción.`,
    how: "Las cifras por barrio se calculan con Inside Airbnb, un proyecto independiente que publica anuncios de Airbnb extraídos de la web, y sus límites de barrio. Las cifras por distrito del título ponderan cada barrio por sus anuncios. El explorador de abajo muestra cada anuncio como un punto, desplazado hasta 150 m para proteger la privacidad de los anfitriones, así que un punto nunca es una dirección.",
    explore: "Explora cada anuncio en un mapa",
    masked: (min) => `menos de ${min} anuncios`,
    tooFew: (n, min) => `solo ${n} anuncios: menos de ${min}, demasiado pocos para dar una proporción`,
    rampLabel: (line) => `Proporción que pide ${line}+ noches`,
    tip: (d, p, n, line) => `${d}<br>el ${p} de ${n} anuncios pide ${line}+ noches`,
    aria: (line) => `Mapa de los barrios de Barcelona coloreados según la proporción de anuncios que piden ${line} noches o más.`,
  },
  rents: {
    title: (q, rent, p, fewer, q0) => `En el ${q}, los contratos nuevos tuvieron un alquiler medio de ${rent} al mes, y se registraron un ${p} ${fewer ? "menos" : "más"} que en el ${q0}.`,
    sub: (r0, q0, peak, qp, r1, q1, n0, n1) =>
      `El alquiler medio de un contrato nuevo pasó de ${r0} al mes (${q0}) a un máximo de ${peak} (${qp}) y fue de ${r1} al mes en el ${q1}. Los contratos nuevos registrados pasaron de ${n0} a ${n1} por trimestre. Las líneas discontinuas marcan cuándo empezaron las dos normas sobre el alquiler.`,
    how: (rules) =>
      `A partir de las fianzas que los arrendadores deben depositar en el Incasòl, ciudad de Barcelona, euros de cada año (sin ajustar por inflación). Se muestra el momento, no la causa. Los tipos de interés, los salarios, la oferta y el tipo de pisos alquilados mueven la media, y un contrato cuya fianza no se deposita no se cuenta. Fechas de las normas: ${rules}.`,
    legendRent: "Alquiler medio mensual, contratos nuevos",
    legendLeases: "Contratos nuevos registrados por trimestre",
    axisLeases: "contratos nuevos por trimestre",
    tip: (q, r, yoy, n) => `<b>${q}</b>alquiler medio ${r} al mes${yoy ? ` (${yoy} interanual)` : ""}<br>${n} contratos nuevos registrados`,
    aria: (r0, q0, r1, q1, n0, n1) => `Gráfico de líneas: alquiler medio de contratos nuevos de ${r0} en el ${q0} a ${r1} en el ${q1}; barras: contratos nuevos de ${n0} a ${n1} por trimestre.`,
  },
  rules: {
    title: (n, y) => `${n} normas de la legislación catalana y española, y una fecha límite en ${y}.`,
    sub: (c, f, t) => `No son todas las normas vigentes: son las que estos datos pueden iluminar, contrastadas con los boletines oficiales el ${c}. La franja sombreada marca cuándo se tomaron las capturas (${f} – ${t}). Selecciona una norma para leerla.`,
    says: "Qué dice",
    shows: "Qué muestran los datos",
    cannot: "Qué no pueden mostrar",
    from: (d) => `desde el ${d}`,
    checked: (d) => `Comprobado el ${d}.`,
    snapshots: "capturas",
    snapshotsNarrow: "datos",
    today: "hoy",
    since: (y) => `← desde ${y}: `,
    deadlineTitle: "Fin de la transición de las viviendas turísticas",
    deadlineLabel: "Fecha límite de licencias",
    laterShows: "Nada todavía: se publicó después de todas las capturas usadas aquí, así que no puede explicar ningún cambio en estos datos.",
    showsLicence: (a, b) => `El registro tiene entre ${a} y ${b} registros en cada trimestre publicado: todavía no hay descenso. Un registro estable antes de una fecha límite no dice nada de lo que pasará después.`,
    showsRent: (b, qb, l, ql, n, qn) => `Los alquileres de contratos nuevos subían un ${b} interanual justo antes del límite (${qb}), bajaron a ${l} (${ql}) y estaban en ${n} en el ${qn}.`,
    showsSeasonal: (a, ma, b, mb, c, mc, n, cities) =>
      `Anuncios que piden más de 31 noches: ${a} (${ma}), ${b} (${mb}), ${c} (${mc}). Los anuncios de un mes o más salieron de la captura más a menudo que los de estancia corta en ${n} de 5 ciudades (${cities}), y la diferencia de Barcelona no se distingue de la de ninguna otra ciudad.`,
    showsOwners: "No hay medida directa. Esta norma actúa edificio por edificio y los datos de anuncios no la ven.",
    aria: (e) => `Línea de tiempo de normas: ${e}`,
  },
  method: {
    title: "Cómo se ha hecho y qué no puede mostrar.",
    sub: "Cada cifra de esta página se calcula a partir de archivos públicos con un proceso abierto en Python, con su numerador y su denominador en los datos publicados. Los datos muestran ajustes, recuentos y momentos. No muestran causas, cuánto se quedan realmente los huéspedes ni si un anuncio incumple alguna norma.",
    steps: (s, c, line) => [
      ["Descargar", `${s} capturas de Inside Airbnb de ${c} ciudades, el registro de viviendas turísticas de la ciudad y los alquileres oficiales.`],
      ["Contar", "Solo anuncios con al menos una fecha disponible en el año siguiente, para que los inactivos no inflen los totales."],
      ["Clasificar", `Cada anuncio según la estancia mínima que pide: menos de ${line}, exactamente ${line} o más. Nunca según su legalidad.`],
      ["Cruzar", "Los números de licencia de los anuncios con el registro, como números, nunca como direcciones."],
      ["Comparar", "Ciudades con intervalos que remuestrean cuentas de anfitrión enteras, para que un gran operador no fabrique un patrón."],
      ["Publicar", "Unas pruebas comprueban que en los datos publicados no se pueda identificar a ningún anfitrión, anuncio ni dirección."],
    ],
    all: "Todas las advertencias y fuentes",
    sizes: (r, s) => `Anuncios con fechas disponibles en las capturas de ${r}: ${s}. La estancia mínima es un ajuste, no una estancia; un número de licencia ausente no prueba un incumplimiento; las comparaciones muestran momentos y diferencias, no causas.`,
    dataAsOf: (m, c) => `Datos hasta ${m}; normas comprobadas el ${c}.`,
    code: "Código, notebooks y correcciones:",
    credits: "Datos: Inside Airbnb, Ajuntament de Barcelona, Generalitat de Catalunya (CC BY 4.0)",
    loadFailed: "No se han podido cargar los datos. Vuelve a cargar la página.",
  },
};

const ca: Strings = {
  htmlTitle: "31 nits: els anuncis d'Airbnb a Barcelona i les normes d'habitatge",
  skip: "Salta al contingut",
  banner: (from, to) => `<b>31 nits</b> · Airbnb a Barcelona i quatre ciutats espanyoles més, ${from} – ${to}`,
  how: "Com s'ha fet?",
  scroll: "Llisca ↓",
  eyebrow: "Lloguer de curta durada · normes d'habitatge · dades obertes",
  language: "Llengua",
  band: (b, line) => (b === "under_31" ? `Menys de ${line} nits` : b === "exactly_31" ? `Exactament ${line}` : `Més de ${line}`),
  nights: (n) => `${n} nit${n === 1 ? "" : "s"}`,
  nightsOrMore: (n) => `${n} nits o més`,
  minimum: (t) => `mínim ${t}`,
  noPrice: "sense dades de preu",
  askingPrice: (p) => `mediana del preu demanat: ${p} per nit`,
  listingsOf: (n, p, total) => `${n} anuncis, ${p} de ${total}`,
  listingsN: (n) => `${n} anuncis`,
  byline: (a, p, d, url) => `Per <b>${a}</b> · Publicat el ${p} · Dades fins al ${d} · <a href="${url}" target="_blank" rel="noopener">Codi i correccions</a>`,

  hero: {
    title: (k) => `<em>${k} de cada 10</em> anuncis d'Airbnb a Barcelona demanen quedar-se un mes o més.`,
    lede: (line, round, bcn, lo, hi, cities) =>
      `A Catalunya, una estada turística és per llei de ${line} dies o menys. Al ${round}, el ${bcn} dels anuncis d'Airbnb a Barcelona amb dates disponibles demanava una estada mínima de ${line} nits o més. A ${cities}, entre el ${lo} i el ${hi}. Què diu això sobre les normes d'habitatge, i què no pot dir.`,
    statListings: (r) => `anuncis a Barcelona amb dates disponibles, ${r}`,
    statShare: (line) => `demanen ${line} nits o més`,
    statOthers: "la mateixa xifra a Madrid, València, Màlaga i Sevilla",
    statRegister: "habitatges d'ús turístic al registre oficial de la ciutat",
  },
  wall: {
    title: (one, line, near) => `Els anuncis de Barcelona es parteixen en dos: una nit (${one}) o ${line}–${line + 1} nits (${near}).`,
    sub: (line, n31, n32) =>
      `Cada barra és la proporció d'anuncis d'Airbnb amb dates disponibles que demanen aquella estada mínima. A Catalunya una estada turística és de ${line} dies o menys, i ${n31} anuncis de Barcelona demanen exactament ${line} nits, mentre que ${n32} en demanen ${line + 1}. Les altres quatre ciutats, a la mateixa escala, no tenen aquest mur.`,
    how: (snapshot, line, folded) =>
      `Darrera captura de cada ciutat (Barcelona: ${snapshot}). L'estada mínima és un ajust que tria l'amfitrió: no és el que duren les estades ni una valoració legal. No és clar si una reserva de ${line} nits compta com a «${line} dies o menys», per això «exactament ${line}» té un color propi. Les estades mínimes de ${folded} nits o més s'agrupen a l'última barra. Fora de Catalunya, ${line} nits no té cap significat legal i s'usa només com a referència comuna.`,
    lineWide: (line) => `Límit català d'estada turística: ${line} dies o menys`,
    lineNarrow: (line) => `estada turística: ${line} dies o menys`,
    askPlus: (p, line) => `${p} en demanen ${line}+`,
    oneNight: "1 nit",
    aria: (one, near, line, others) => `Gràfics de barres d'estades mínimes. Barcelona: el ${one} demana 1 nit i el ${near} en demana ${line} o ${line + 1}. ${others}`,
    otherAria: (city, p, line) => `${city}: el ${p} en demana ${line} o més`,
  },
  price: {
    title: (line, one, after) => `Un anunci d'una nit demana ${one} per nit; un de ${line + 1} nits, ${after}.`,
    sub: (ratio, between, lo, hi) =>
      `Mateixa ciutat, mateixa plataforma: ${ratio} vegades més. Cada barra és una estada mínima, a l'altura de la mediana del preu per nit que demanen els seus anuncis. Només el ${between} dels anuncis demana un mínim d'entre ${lo} i ${hi} nits.`,
    how: (snapshot, line, min) =>
      `Barcelona, captura del ${snapshot}. Són preus demanats per nit, sense taxes ni descomptes setmanals o mensuals: no són el que van pagar els hostes, i un mes al preu de ${line + 1} nits no és un lloguer mensual. Només es mostren les estades mínimes que demanen almenys ${min} anuncis.`,
    label: (t, p) => `${t}: ${p}`,
    tip: (p, n) => `mediana del preu demanat: ${p} per nit<br>${n} anuncis`,
    aria: (one, line, after) => `Gràfic de piruletes: mediana del preu demanat per nit segons l'estada mínima a Barcelona. 1 nit: ${one}; ${line + 1} nits: ${after}.`,
  },
  map: {
    title: (h, hp, line, l, lp) => `A ${h}, el ${hp} dels anuncis demana ${line} nits o més; a ${l}, el ${lp}.`,
    sub: ([a, b, c], line) =>
      `Cada punt és un anunci d'Airbnb amb dates disponibles: ${a}menys de ${line} nits, ${b}exactament ${line}, ${c}més de ${line}. Amaga un grup o canvia de trimestre amb els botons; toca un punt per veure'n les dades.`,
    how: "Inside Airbnb, un projecte independent, publica anuncis d'Airbnb extrets del web. Desplaça cada punt fins a 150 m per protegir la privacitat dels amfitrions, de manera que un punt mai no és una adreça. En aquesta pàgina no s'identifica cap amfitrió ni cap anunci. Les xifres per districte es calculen a partir de les dades per barri que també fa servir el mapa.",
    aria: "Mapa dels anuncis d'Airbnb amb dates disponibles a Barcelona, acolorits per estada mínima",
    snapshot: "Captura",
    attribution: "Anuncis: Inside Airbnb (CC BY 4.0)",
    failed: "No s'ha pogut carregar el mapa. Les xifres anteriors no en depenen.",
    room: (r) => ({ "Entire home/apt": "Habitatge sencer", "Private room": "Habitació privada", "Shared room": "Habitació compartida", "Hotel room": "Habitació d'hotel" })[r] ?? r,
  },
  flows: {
    title: (from, n, gone, to, s) => `Dels ${n} anuncis que demanaven un mes o més el ${from}, el ${gone} havia desaparegut d'Airbnb el ${to}. Dels d'estada més curta, el ${s}.`,
    sub: (from, to, switched, gone) =>
      `Cada anunci es pot seguir del ${from} al ${to} pel seu identificador. Gairebé cap anunci d'un mes o més no va passar a estades curtes (${switched}), mentre que ${gone} van desaparèixer. Entre les dues dates, l'1 de gener de 2026, Catalunya va estendre el límit del lloguer als lloguers de temporada. Només són en color els dos fluxos que expliquen aquesta història.`,
    how: "Absent vol dir retirat, tornat a publicar amb un altre identificador o no captat pel rastrejador: el fitxer no permet saber quin és el cas. Publicat sense dates disponibles pot voler dir ple, bloquejat o en pausa. Els anuncis que van aparèixer després de la primera captura no són en aquest diagrama.",
    inactive: "Publicat, sense dates",
    gone: "Absent de la captura",
    inactiveShort: "Sense dates",
    goneShort: "Absent",
    tip: (a, b, n, p, from) => `<b>${a} → ${b.toLowerCase()}</b>${n} anuncis, el ${p} del grup «${a.toLowerCase()}» el ${from}`,
    aria: (from, to, g, t, sg, st) => `Diagrama de fluxos, Barcelona del ${from} al ${to}: ${g} de ${t} anuncis d'un mes o més i ${sg} de ${st} d'estada més curta eren absents de la captura posterior.`,
  },
  gap: {
    title: (n, total, distinct) =>
      `A ${n === total ? `les ${total}` : `${n} de ${total}`} ciutats, els anuncis que demanaven un mes o més van desaparèixer més sovint que els d'estada més curta. ${distinct ? `La diferència de Barcelona es distingeix de la de ${distinct}.` : "Barcelona no destaca."}`,
    sub: (from, to, mp, sh, clear, line) =>
      `Cada fila pren els anuncis amb dates disponibles que tenia una ciutat el ${from} i compta quants havien desaparegut d'Airbnb el ${to}. A Barcelona va desaparèixer el ${mp} dels que demanaven ${line} nits o més, davant del ${sh} de la resta. La diferència és clarament més gran que zero en ${clear} de 5 ciutats. Només Barcelona està sota la norma catalana que va estendre el límit del lloguer als lloguers de temporada el gener de 2026.`,
    how: (lo, hi) =>
      `«Desaparegut» vol dir absent de la captura posterior: retirat, tornat a publicar amb un altre identificador o no captat pel rastrejador; els fitxers no permeten saber quin és el cas. Els anuncis que van aparèixer després de la primera captura no es compten. La distància entre els dos punts té un interval del 95 % obtingut remostrejant comptes d'amfitrió sencers, perquè un sol operador pot retirar molts anuncis alhora (Barcelona: de ${lo} a ${hi} punts). Una ciutat només es considera diferent de Barcelona quan l'interval de la diferència entre totes dues exclou el zero. Les altres ciutats tenen dues captures cadascuna, separades uns nou mesos.`,
    monthPlus: (line) => `Demanen ${line} nits o més`,
    shorter: (line) => `Demanen menys de ${line} nits`,
    axis: "proporció d'anuncis desapareguts a la captura posterior →",
    apart: (p) => `${p} punts`,
    tip: (c, mp, nmp, sh, nsh, p, lo, hi, contrast) =>
      `<b>${c}</b>Va desaparèixer el ${mp} de ${nmp} anuncis d'un mes o més<br>i el ${sh} de ${nsh} anuncis d'estada més curta<br>Diferència: ${p} punts (interval del 95 %: de ${lo} a ${hi})${contrast}`,
    contrast: (c, d, lo, hi) => `<br>Barcelona menys ${c}: ${d} punts (de ${lo} a ${hi})`,
    aria: (rows) => `Gràfic de punts, proporció d'anuncis desapareguts a la captura posterior, d'un mes o més davant d'estades més curtes: ${rows}`,
  },
  licences: {
    groups: {
      tourist_flat: "Llicència d'habitatge d'ús turístic (HUT)",
      hotel: "Hotel o alberg",
      exempt_seasonal: "«Exempt: lloguer de temporada»",
      other: "Una altra exempció o codi",
      missing: "No hi consta res",
    },
    title: (fm, fmo, lm, lmo, seasonal) => `Els anuncis sense número de llicència van baixar del ${fm} al ${lm} entre el ${fmo} i el ${lmo}; el ${seasonal} diu ara «exempt: lloguer de temporada».`,
    sub: (first, before) =>
      `Airbnb demana als amfitrions de Barcelona un número de llicència. Cada barra reparteix els anuncis amb dates disponibles d'un trimestre segons el que mostra aquest camp. La resposta «exempt: lloguer de temporada» apareix per primer cop el ${first}${before ? `; no era a les dades del ${before}, de manera que el seu augment es deu en part a un canvi al formulari d'Airbnb` : ""}.`,
    how: "El camp l'omplen els amfitrions i aquí no es contrasta amb cap registre; la pantalla següent ho fa amb els números d'habitatge d'ús turístic. Un número absent o que no coincideix no prova que un anunci incompleixi cap norma, i els lloguers de temporada no necessiten llicència turística.",
    row: (m, n) => `${m} · ${n} anuncis`,
    tip: (l, n, t, p, m) => `<b>${l}</b>${n} de ${t} anuncis (${p}), ${m}`,
    aria: "Barres apilades per trimestre del que mostren els anuncis de Barcelona al camp de llicència.",
  },
  register: {
    title: (p, all) => `El ${p} dels ${all} números de llicència d'habitatge d'ús turístic de Barcelona apareix en un anunci d'Airbnb amb dates disponibles.`,
    sub: (f, fq, l, lq, numbers, deadline, days) =>
      `El registre de la ciutat gairebé no s'ha mogut: ${f} registres el ${fq} i ${l} el ${lq} (${numbers} números de llicència diferents).${deadline ? ` Segons un decret català del 2023, aquests habitatges necessiten una llicència urbanística abans del ${deadline} o han de deixar de funcionar com a habitatges d'ús turístic${days ? `: en queden ${days} dies` : ""}.` : ""}`,
    how: (q, s, found) =>
      `Cada barra compara una captura amb el trimestre del registre publicat més proper (la darrera: ${s} amb el ${q}). La part verda és la proporció de números de llicència del registre que apareixen en almenys un anunci amb dates disponibles. El ${found} dels números que mostren els anuncis existeix al registre. Una coincidència mostra que el número existeix, no que l'anunci sigui aquell habitatge. Un número que no apareix no és un pis buit: es pot llogar en altres plataformes, directament o no llogar-se. Els propietaris poden demanar una única pròrroga de fins a cinc anys. L'Ajuntament ha dit (premsa del juny del 2024) que no preveu concedir les noves llicències; és una política anunciada, no un text legal.`,
    vs: (q) => `registre ${q}`,
    vsWord: "registre",
    tip: (m, n, all, q, p) => `<b>${m}</b>${n} de ${all} números de llicència del registre del ${q} (${p}) apareixen en un anunci amb dates disponibles`,
    aria: (v) => `Gràfic de barres: proporció de números de llicència del registre que apareixen a Airbnb, per captura: ${v}.`,
  },
  hosts: {
    title: (o, min, hood, hp) => `El ${o} dels anuncis de Barcelona pertany a comptes amb ${min} anuncis o més; a ${hood}, el ${hp}.`,
    sub: (others, top1) =>
      `Cada barri està acolorit segons la proporció dels seus anuncis gestionats per un compte amb 5 anuncis o més. A les altres ciutats: ${list(others)}. L'1 % de comptes més grans gestiona tot sol el ${top1} dels anuncis de Barcelona.`,
    how: (r, min, ml) =>
      `Captura del ${r}, anuncis amb dates disponibles. La mida del compte es compta a cada captura. Un compte no és una persona ni una empresa: una empresa pot tenir diversos comptes, i un compte pot gestionar pisos de molts propietaris. Els barris amb menys de ${ml} anuncis apareixen ratllats. ${min} anuncis o més és una definició pràctica d'amfitrió professional, no una definició legal.`,
    rampLabel: (min) => `Proporció d'anuncis en comptes amb ${min}+ anuncis`,
    tip: (d, p, n, min) => `${d}<br>el ${p} de ${n} anuncis és en comptes amb ${min}+ anuncis`,
    aria: (p, min) => `Mapa dels barris de Barcelona acolorits segons la proporció d'anuncis en comptes amb ${min} anuncis o més; a tota la ciutat, el ${p}.`,
  },
  atlas: {
    title: (h, hp, line, l, lp) => `A ${h}, el ${hp} dels anuncis demana ${line} nits o més; a ${l}, el ${lp}.`,
    sub: (line, min) => `Cada barri està acolorit segons la proporció dels seus anuncis d'Airbnb amb dates disponibles que demanen ${line} nits o més. Els barris ratllats tenen menys de ${min} anuncis, massa pocs per donar una proporció.`,
    how: "Les xifres per barri es calculen amb Inside Airbnb, un projecte independent que publica anuncis d'Airbnb extrets del web, i els seus límits de barri. Les xifres per districte del títol ponderen cada barri pels seus anuncis. L'explorador de sota mostra cada anunci com un punt, desplaçat fins a 150 m per protegir la privacitat dels amfitrions, de manera que un punt mai no és una adreça.",
    explore: "Explora cada anunci en un mapa",
    masked: (min) => `menys de ${min} anuncis`,
    tooFew: (n, min) => `només ${n} anuncis: menys de ${min}, massa pocs per donar una proporció`,
    rampLabel: (line) => `Proporció que demana ${line}+ nits`,
    tip: (d, p, n, line) => `${d}<br>el ${p} de ${n} anuncis demana ${line}+ nits`,
    aria: (line) => `Mapa dels barris de Barcelona acolorits segons la proporció d'anuncis que demanen ${line} nits o més.`,
  },
  rents: {
    title: (q, rent, p, fewer, q0) => `El ${q}, els contractes nous van tenir un lloguer mitjà de ${rent} al mes, i se'n van registrar un ${p} ${fewer ? "menys" : "més"} que el ${q0}.`,
    sub: (r0, q0, peak, qp, r1, q1, n0, n1) =>
      `El lloguer mitjà d'un contracte nou va passar de ${r0} al mes (${q0}) a un màxim de ${peak} (${qp}) i va ser de ${r1} al mes el ${q1}. Els contractes nous registrats van passar de ${n0} a ${n1} per trimestre. Les línies discontínues marquen quan van començar les dues normes sobre el lloguer.`,
    how: (rules) =>
      `A partir de les fiances que els arrendadors han de dipositar a l'Incasòl, ciutat de Barcelona, euros de cada any (sense ajustar per inflació). Es mostra el moment, no la causa. Els tipus d'interès, els salaris, l'oferta i el tipus de pisos llogats mouen la mitjana, i un contracte la fiança del qual no es diposita no es compta. Dates de les normes: ${rules}.`,
    legendRent: "Lloguer mitjà mensual, contractes nous",
    legendLeases: "Contractes nous registrats per trimestre",
    axisLeases: "contractes nous per trimestre",
    tip: (q, r, yoy, n) => `<b>${q}</b>lloguer mitjà ${r} al mes${yoy ? ` (${yoy} interanual)` : ""}<br>${n} contractes nous registrats`,
    aria: (r0, q0, r1, q1, n0, n1) => `Gràfic de línies: lloguer mitjà de contractes nous de ${r0} el ${q0} a ${r1} el ${q1}; barres: contractes nous de ${n0} a ${n1} per trimestre.`,
  },
  rules: {
    title: (n, y) => `${n} normes de la legislació catalana i espanyola, i una data límit el ${y}.`,
    sub: (c, f, t) => `No són totes les normes vigents: són les que aquestes dades poden il·luminar, contrastades amb els butlletins oficials el ${c}. La franja ombrejada marca quan es van fer les captures (${f} – ${t}). Selecciona una norma per llegir-la.`,
    says: "Què diu",
    shows: "Què mostren les dades",
    cannot: "Què no poden mostrar",
    from: (d) => `des del ${d}`,
    checked: (d) => `Comprovat el ${d}.`,
    snapshots: "captures",
    snapshotsNarrow: "dades",
    today: "avui",
    since: (y) => `← des del ${y}: `,
    deadlineTitle: "Final de la transició dels habitatges d'ús turístic",
    deadlineLabel: "Data límit de llicències",
    laterShows: "Res encara: es va publicar després de totes les captures que s'usen aquí, de manera que no pot explicar cap canvi en aquestes dades.",
    showsLicence: (a, b) => `El registre té entre ${a} i ${b} registres a cada trimestre publicat: encara no hi ha descens. Un registre estable abans d'una data límit no diu res del que passarà després.`,
    showsRent: (b, qb, l, ql, n, qn) => `Els lloguers dels contractes nous pujaven un ${b} interanual just abans del límit (${qb}), van baixar a ${l} (${ql}) i eren a ${n} el ${qn}.`,
    showsSeasonal: (a, ma, b, mb, c, mc, n, cities) =>
      `Anuncis que demanen més de 31 nits: ${a} (${ma}), ${b} (${mb}), ${c} (${mc}). Els anuncis d'un mes o més van sortir de la captura més sovint que els d'estada curta en ${n} de 5 ciutats (${cities}), i la diferència de Barcelona no es distingeix de la de cap altra ciutat.`,
    showsOwners: "No hi ha cap mesura directa. Aquesta norma actua edifici per edifici i les dades d'anuncis no la veuen.",
    aria: (e) => `Línia de temps de normes: ${e}`,
  },
  method: {
    title: "Com s'ha fet i què no pot mostrar.",
    sub: "Cada xifra d'aquesta pàgina es calcula a partir de fitxers públics amb un procés obert en Python, amb el numerador i el denominador a les dades publicades. Les dades mostren ajustos, recomptes i moments. No mostren causes, quant es queden realment els hostes ni si un anunci incompleix cap norma.",
    steps: (s, c, line) => [
      ["Descarregar", `${s} captures d'Inside Airbnb de ${c} ciutats, el registre d'habitatges d'ús turístic de la ciutat i els lloguers oficials.`],
      ["Comptar", "Només anuncis amb almenys una data disponible l'any següent, perquè els inactius no inflin els totals."],
      ["Classificar", `Cada anunci segons l'estada mínima que demana: menys de ${line}, exactament ${line} o més. Mai segons la seva legalitat.`],
      ["Creuar", "Els números de llicència dels anuncis amb el registre, com a números, mai com a adreces."],
      ["Comparar", "Ciutats amb intervals que remostregen comptes d'amfitrió senceres, perquè un gran operador no fabriqui un patró."],
      ["Publicar", "Unes proves comproven que a les dades publicades no es pugui identificar cap amfitrió, anunci ni adreça."],
    ],
    all: "Totes les advertències i fonts",
    sizes: (r, s) => `Anuncis amb dates disponibles a les captures del ${r}: ${s}. L'estada mínima és un ajust, no una estada; un número de llicència absent no prova cap incompliment; les comparacions mostren moments i diferències, no causes.`,
    dataAsOf: (m, c) => `Dades fins al ${m}; normes comprovades el ${c}.`,
    code: "Codi, notebooks i correccions:",
    credits: "Dades: Inside Airbnb, Ajuntament de Barcelona, Generalitat de Catalunya (CC BY 4.0)",
    loadFailed: "No s'han pogut carregar les dades. Torna a carregar la pàgina.",
  },
};

export const T: Strings = { en, es, ca }[LANG];

/** City names: Spanish and Catalan exonyms differ (València, Màlaga). */
export function cityName(city: string): string {
  const names: Record<Lang, Record<string, string>> = {
    en: { barcelona: "Barcelona", madrid: "Madrid", valencia: "Valencia", malaga: "Málaga", sevilla: "Sevilla" },
    es: { barcelona: "Barcelona", madrid: "Madrid", valencia: "Valencia", malaga: "Málaga", sevilla: "Sevilla" },
    ca: { barcelona: "Barcelona", madrid: "Madrid", valencia: "València", malaga: "Màlaga", sevilla: "Sevilla" },
  };
  return names[LANG][city] ?? city;
}
