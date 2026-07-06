import { DateTime } from "luxon";
import type { DailyWindow, Granularity } from "./types";

/**
 * Expand candidate dates + a daily window into an ordered list of absolute
 * slot start instants (UTC epoch-ms).
 *
 * Each date/time is interpreted in `tz`, so DST is handled correctly: a
 * "09:00 local" slot maps to the right instant on every date. Invalid local
 * times (e.g. the skipped hour on a spring-forward day) are dropped.
 */
export function buildSlots(
  dates: string[],
  window: DailyWindow,
  granularityMin: Granularity,
  tz: string
): number[] {
  const out: number[] = [];
  const startMin = window.startHour * 60;
  const endMin = window.endHour * 60; // exclusive
  for (const iso of dates) {
    const day = DateTime.fromISO(iso, { zone: tz });
    if (!day.isValid) continue;
    for (let m = startMin; m < endMin; m += granularityMin) {
      const dt = day.set({
        hour: Math.floor(m / 60),
        minute: m % 60,
        second: 0,
        millisecond: 0,
      });
      if (dt.isValid) out.push(dt.toMillis());
    }
  }
  // De-dup and sort — dates could overlap or be entered out of order.
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

/**
 * Resolve chosen weekdays (Luxon 1–7, Mon–Sun) to the next upcoming concrete
 * date for each, starting from "today" in `tz`. Used by weekly mode so slots
 * always resolve to real instants.
 */
export function nextDatesForWeekdays(weekdays: number[], tz: string): string[] {
  const today = DateTime.now().setZone(tz).startOf("day");
  const result: string[] = [];
  for (const wd of [...weekdays].sort((a, b) => a - b)) {
    // delta 0 keeps today; otherwise the next occurrence of that weekday.
    const delta = (wd - today.weekday + 7) % 7;
    const date = today.plus({ days: delta });
    result.push(date.toISODate()!);
  }
  return result;
}

/** All ISO dates from start to end inclusive (order-independent inputs). */
export function enumerateDateRange(startISO: string, endISO: string): string[] {
  const s = DateTime.fromISO(startISO);
  const e = DateTime.fromISO(endISO);
  if (!s.isValid || !e.isValid) return [];
  const [a, b] = s <= e ? [s, e] : [e, s];
  const out: string[] = [];
  let cur = a.startOf("day");
  const last = b.startOf("day");
  while (cur <= last) {
    out.push(cur.toISODate()!);
    cur = cur.plus({ days: 1 });
  }
  return out;
}

export interface GridColumn {
  key: string; // local ISO date
  label: string; // e.g. "Mon\nJul 7"
}
export interface GridRow {
  key: number; // minutes from local midnight
  label: string; // e.g. "9:00 AM"
  onHour: boolean; // starts exactly on the hour — the only rows that get a label
}
export interface GridModel {
  columns: GridColumn[];
  rows: GridRow[];
  /** `${colKey}|${rowKey}` -> slot epoch-ms, only where a slot exists. */
  cells: Map<string, number>;
  /** Time of the grid's bottom line (last slot's end), e.g. "5:00 PM". */
  endLabel: string;
}

/**
 * Project absolute slots into a (date × time-of-day) grid *in the viewer's tz*.
 * Because all slots sit on granularity boundaries and real UTC offsets are
 * multiples of 15 min, every slot lands cleanly on a local date + time-of-day.
 */
export function buildGridModel(
  slots: number[],
  tz: string,
  opts?: { weekdayOnly?: boolean }
): GridModel {
  const colSet = new Map<string, string>(); // dateKey -> label
  const rowSet = new Map<number, string>(); // minuteOfDay -> label
  const cells = new Map<string, number>();

  for (const ms of slots) {
    const dt = DateTime.fromMillis(ms, { zone: tz });
    const colKey = dt.toISODate()!;
    const rowKey = dt.hour * 60 + dt.minute;
    if (!colSet.has(colKey))
      colSet.set(colKey, opts?.weekdayOnly ? dt.toFormat("cccc") : dt.toFormat("ccc\nLLL d"));
    if (!rowSet.has(rowKey)) rowSet.set(rowKey, dt.toFormat("h:mm a"));
    cells.set(`${colKey}|${rowKey}`, ms);
  }

  const columns = Array.from(colSet.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, label]) => ({ key, label }));
  const rows = Array.from(rowSet.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([key, label]) => ({ key, label, onHour: key % 60 === 0 }));

  // Bottom-of-axis label: the end of the last slot. Infer the slot step from
  // the row spacing (30 min in this app) and add it to the last row's start.
  const step = rows.length >= 2 ? rows[1].key - rows[0].key : 30;
  const lastEndMin = rows.length ? rows[rows.length - 1].key + step : 0;
  const endLabel = DateTime.fromObject({ hour: 0, minute: 0 })
    .plus({ minutes: lastEndMin })
    .toFormat("h:mm a");

  return { columns, rows, cells, endLabel };
}

/** Format a single slot instant in a given timezone. */
export function formatSlot(ms: number, tz: string): string {
  return DateTime.fromMillis(ms, { zone: tz }).toFormat("ccc, LLL d · h:mm a");
}

/** Format a time range [startMs, endMs) in a given timezone (+ zone abbr). */
export function formatRange(startMs: number, endMs: number, tz: string): string {
  const s = DateTime.fromMillis(startMs, { zone: tz });
  const e = DateTime.fromMillis(endMs, { zone: tz });
  const sameDay = s.hasSame(e, "day");
  const left = s.toFormat("ccc, LLL d · h:mm a");
  const right = sameDay ? e.toFormat("h:mm a") : e.toFormat("ccc, LLL d · h:mm a");
  return `${left} – ${right} ${s.toFormat("ZZZZ")}`;
}

export function detectTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Rich metadata for a single IANA zone, used by the timezone picker. */
export interface TzInfo {
  tz: string; // IANA id, e.g. "America/Los_Angeles"
  region: string; // continent prefix, e.g. "America"
  city: string; // human city, e.g. "Los Angeles"
  abbr: string; // current zone code, e.g. "PDT" or "GMT+8"
  offsetMin: number; // current UTC offset in minutes (for sorting)
  offsetLabel: string; // e.g. "UTC−07:00"
  search: string; // lowercased haystack for fuzzy matching
}

/** Region grouping for the picker: sensible order, then anything else. */
const REGION_ORDER = [
  "America",
  "Europe",
  "Africa",
  "Asia",
  "Australia",
  "Pacific",
  "Atlantic",
  "Indian",
  "Antarctica",
  "Arctic",
  "Other",
];
const REGION_LABELS: Record<string, string> = {
  America: "Americas",
  Europe: "Europe",
  Africa: "Africa",
  Asia: "Asia",
  Australia: "Australia",
  Pacific: "Pacific",
  Atlantic: "Atlantic",
  Indian: "Indian Ocean",
  Antarctica: "Antarctica",
  Arctic: "Arctic",
  Other: "Other",
};

/** "UTC±HH:MM" from an offset in minutes (uses a real minus sign). */
function formatOffset(min: number): string {
  const sign = min < 0 ? "−" : "+";
  const abs = Math.abs(min);
  const h = String(Math.floor(abs / 60)).padStart(2, "0");
  const m = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${h}:${m}`;
}

/**
 * IANA collapses whole countries into a single zone — all of mainland China is
 * "Asia/Shanghai", all of India is "Asia/Kolkata", etc. — so the canonical city
 * often isn't what people look for. This map gives a friendlier display `label`
 * and extra search `terms` (English + local names) for the busiest zones, so
 * "Beijing", "Mumbai", "Saigon" or "北京" all resolve to the right zone.
 */
const TZ_EXTRAS: Record<string, { label: string; terms: string[] }> = {
  // ── Asia ──────────────────────────────────────────────────────────────
  "Asia/Shanghai": { label: "China · Beijing, Shanghai", terms: ["china", "beijing", "shanghai", "shenzhen", "guangzhou", "chengdu", "chongqing", "wuhan", "hangzhou", "prc", "中国", "北京", "上海", "广州", "深圳"] },
  "Asia/Hong_Kong": { label: "Hong Kong", terms: ["hong kong", "hongkong", "hk", "香港"] },
  "Asia/Taipei": { label: "Taipei · Taiwan", terms: ["taiwan", "taipei", "台北", "台湾", "台灣"] },
  "Asia/Tokyo": { label: "Tokyo · Japan", terms: ["japan", "tokyo", "osaka", "kyoto", "日本", "东京", "東京"] },
  "Asia/Seoul": { label: "Seoul · South Korea", terms: ["korea", "south korea", "seoul", "busan", "韩国", "首尔", "서울"] },
  "Asia/Kolkata": { label: "India · Mumbai, Delhi", terms: ["india", "mumbai", "delhi", "new delhi", "bangalore", "bengaluru", "chennai", "hyderabad", "kolkata", "calcutta", "印度", "孟买", "新德里"] },
  "Asia/Singapore": { label: "Singapore", terms: ["singapore", "新加坡"] },
  "Asia/Bangkok": { label: "Bangkok · Thailand", terms: ["thailand", "bangkok", "泰国", "曼谷"] },
  "Asia/Jakarta": { label: "Jakarta · Indonesia", terms: ["indonesia", "jakarta", "印尼", "雅加达"] },
  "Asia/Ho_Chi_Minh": { label: "Ho Chi Minh City · Vietnam", terms: ["vietnam", "saigon", "hanoi", "ho chi minh", "越南", "胡志明", "西贡"] },
  "Asia/Kuala_Lumpur": { label: "Kuala Lumpur · Malaysia", terms: ["malaysia", "kuala lumpur", "kl", "马来西亚", "吉隆坡"] },
  "Asia/Manila": { label: "Manila · Philippines", terms: ["philippines", "manila", "菲律宾", "马尼拉"] },
  "Asia/Dubai": { label: "Dubai · UAE", terms: ["uae", "dubai", "abu dhabi", "united arab emirates", "迪拜", "阿联酋"] },
  "Asia/Karachi": { label: "Karachi · Pakistan", terms: ["pakistan", "karachi", "lahore", "islamabad", "巴基斯坦"] },
  "Asia/Dhaka": { label: "Dhaka · Bangladesh", terms: ["bangladesh", "dhaka", "孟加拉"] },
  "Asia/Jerusalem": { label: "Jerusalem · Israel", terms: ["israel", "jerusalem", "tel aviv", "以色列"] },
  "Asia/Riyadh": { label: "Riyadh · Saudi Arabia", terms: ["saudi", "saudi arabia", "riyadh", "沙特", "利雅得"] },
  "Asia/Tehran": { label: "Tehran · Iran", terms: ["iran", "tehran", "伊朗", "德黑兰"] },
  "Asia/Colombo": { label: "Colombo · Sri Lanka", terms: ["sri lanka", "colombo"] },
  "Asia/Kathmandu": { label: "Kathmandu · Nepal", terms: ["nepal", "kathmandu", "尼泊尔"] },
  "Asia/Yangon": { label: "Yangon · Myanmar", terms: ["myanmar", "burma", "yangon", "rangoon", "缅甸"] },
  // ── Europe ────────────────────────────────────────────────────────────
  "Europe/London": { label: "London · UK", terms: ["uk", "united kingdom", "britain", "england", "london", "英国", "伦敦"] },
  "Europe/Paris": { label: "Paris · France", terms: ["france", "paris", "法国", "巴黎"] },
  "Europe/Berlin": { label: "Berlin · Germany", terms: ["germany", "berlin", "munich", "frankfurt", "德国", "柏林"] },
  "Europe/Madrid": { label: "Madrid · Spain", terms: ["spain", "madrid", "barcelona", "西班牙"] },
  "Europe/Rome": { label: "Rome · Italy", terms: ["italy", "rome", "milan", "意大利", "罗马"] },
  "Europe/Amsterdam": { label: "Amsterdam · Netherlands", terms: ["netherlands", "holland", "amsterdam", "荷兰"] },
  "Europe/Moscow": { label: "Moscow · Russia", terms: ["russia", "moscow", "俄罗斯", "莫斯科"] },
  "Europe/Zurich": { label: "Zurich · Switzerland", terms: ["switzerland", "zurich", "geneva", "瑞士"] },
  // ── Americas ──────────────────────────────────────────────────────────
  "America/New_York": { label: "New York · US Eastern", terms: ["usa", "us", "eastern", "et", "est", "edt", "new york", "nyc", "boston", "washington", "dc", "miami", "atlanta", "纽约", "美东"] },
  "America/Chicago": { label: "Chicago · US Central", terms: ["central", "ct", "cst", "cdt", "chicago", "dallas", "houston", "芝加哥", "美中"] },
  "America/Denver": { label: "Denver · US Mountain", terms: ["mountain", "mt", "mst", "mdt", "denver", "phoenix"] },
  "America/Los_Angeles": { label: "Los Angeles · US Pacific", terms: ["pacific", "pt", "pst", "pdt", "los angeles", "la", "san francisco", "sf", "seattle", "california", "洛杉矶", "美西", "旧金山"] },
  "America/Toronto": { label: "Toronto · Canada", terms: ["canada", "toronto", "ottawa", "加拿大", "多伦多"] },
  "America/Mexico_City": { label: "Mexico City · Mexico", terms: ["mexico", "mexico city", "墨西哥"] },
  "America/Sao_Paulo": { label: "São Paulo · Brazil", terms: ["brazil", "sao paulo", "são paulo", "rio", "巴西", "圣保罗"] },
  "America/Argentina/Buenos_Aires": { label: "Buenos Aires · Argentina", terms: ["argentina", "buenos aires", "阿根廷"] },
  // ── Oceania / Africa ──────────────────────────────────────────────────
  "Australia/Sydney": { label: "Sydney · Australia", terms: ["australia", "sydney", "melbourne", "canberra", "澳大利亚", "悉尼"] },
  "Pacific/Auckland": { label: "Auckland · New Zealand", terms: ["new zealand", "nz", "auckland", "wellington", "新西兰", "奥克兰"] },
  "Africa/Cairo": { label: "Cairo · Egypt", terms: ["egypt", "cairo", "埃及", "开罗"] },
  "Africa/Johannesburg": { label: "Johannesburg · South Africa", terms: ["south africa", "johannesburg", "cape town", "南非"] },
  "Africa/Lagos": { label: "Lagos · Nigeria", terms: ["nigeria", "lagos", "尼日利亚"] },
  "Africa/Nairobi": { label: "Nairobi · Kenya", terms: ["kenya", "nairobi", "肯尼亚"] },
};

/** Build display + search metadata for one IANA zone (offset as of `ref`). */
export function tzInfo(tz: string, ref?: DateTime): TzInfo {
  const dt = (ref ?? DateTime.now()).setZone(tz);
  const offsetMin = dt.isValid ? dt.offset : 0;
  const abbr = dt.isValid ? dt.toFormat("ZZZZ") : "";
  const slash = tz.indexOf("/");
  let region = slash === -1 ? "Other" : tz.slice(0, slash);
  if (region === "Etc") region = "Other";
  const derivedCity = (slash === -1 ? tz : tz.slice(slash + 1))
    .replace(/_/g, " ")
    .replace(/\//g, " · ");
  const extra = TZ_EXTRAS[tz];
  const city = extra?.label ?? derivedCity;
  const offsetLabel = formatOffset(offsetMin);
  // Compact offset forms so queries like "utc+8" / "gmt+8" also match.
  const cH = Math.floor(Math.abs(offsetMin) / 60);
  const cM = Math.abs(offsetMin) % 60;
  const cSign = offsetMin < 0 ? "-" : "+";
  const compact = `utc${cSign}${cH}${cM ? ":" + cM : ""} gmt${cSign}${cH}`;
  const aliasStr = extra ? ` ${extra.terms.join(" ")}` : "";
  // Keep the raw city too, so "shanghai" still matches even under a label.
  const search =
    `${tz} ${derivedCity} ${city} ${abbr} ${region} ${offsetLabel} ${compact}${aliasStr}`.toLowerCase();
  return { tz, region, city, abbr, offsetMin, offsetLabel, search };
}

/** All IANA zone ids the runtime knows, or the curated shortlist as fallback. */
export function allTzNames(): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (supported && supported.length) return supported;
  } catch {
    /* older runtime — fall through */
  }
  return COMMON_TZS;
}

export interface TzGroup {
  region: string;
  label: string;
  zones: TzInfo[];
}

/**
 * Group zones by region (地域分类) and sort each group by UTC offset (时区排序).
 * Regions follow REGION_ORDER, then any unknowns alphabetically.
 */
export function groupTimeZones(names: string[]): TzGroup[] {
  const ref = DateTime.now();
  const byRegion = new Map<string, TzInfo[]>();
  for (const tz of names) {
    const info = tzInfo(tz, ref);
    const arr = byRegion.get(info.region);
    if (arr) arr.push(info);
    else byRegion.set(info.region, [info]);
  }
  const regions = Array.from(byRegion.keys()).sort((a, b) => {
    const ia = REGION_ORDER.indexOf(a);
    const ib = REGION_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a < b ? -1 : 1;
  });
  return regions.map((region) => ({
    region,
    label: REGION_LABELS[region] ?? region,
    zones: byRegion
      .get(region)!
      .sort((a, b) => a.offsetMin - b.offsetMin || a.city.localeCompare(b.city)),
  }));
}

/** A curated shortlist of common IANA zones for the timezone picker. */
export const COMMON_TZS: string[] = [
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Athens",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];
