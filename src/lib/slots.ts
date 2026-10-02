import { DateTime } from "luxon";
import type { DailyWindow, Granularity } from "./types";
import { getLang } from "./i18n";

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

/**
 * The day of a weekly meeting, e.g. "Wednesdays" or "每周三". Weekly polls are
 * stored on a reference week, so their dates mean nothing to people reading them.
 */
export function weeklyDay(dt: DateTime): string {
  return getLang() === "zh" ? `每${dt.setLocale("zh-CN").toFormat("ccc")}` : `${dt.toFormat("cccc")}s`;
}

/** Format a single slot instant in a given timezone (weekday only for weekly polls). */
export function formatSlot(ms: number, tz: string, weekly = false): string {
  const dt = DateTime.fromMillis(ms, { zone: tz });
  return weekly ? `${weeklyDay(dt)} · ${dt.toFormat("h:mm a")}` : dt.toFormat("ccc, LLL d · h:mm a");
}

/** Format a time range [startMs, endMs) in a given timezone (+ zone abbr). */
export function formatRange(startMs: number, endMs: number, tz: string, weekly = false): string {
  const s = DateTime.fromMillis(startMs, { zone: tz });
  const e = DateTime.fromMillis(endMs, { zone: tz });
  const sameDay = s.hasSame(e, "day");
  const left = weekly ? `${weeklyDay(s)} · ${s.toFormat("h:mm a")}` : s.toFormat("ccc, LLL d · h:mm a");
  const right = sameDay
    ? e.toFormat("h:mm a")
    : weekly
    ? `${weeklyDay(e)} · ${e.toFormat("h:mm a")}`
    : e.toFormat("ccc, LLL d · h:mm a");
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
  tz: string; // IANA id as given (may be a legacy alias), e.g. "Asia/Calcutta"
  key: string; // current IANA name, for de-duping and labels, e.g. "Asia/Kolkata"
  region: string; // continent prefix, e.g. "America"
  city: string; // human city, e.g. "Los Angeles" (Chinese when the UI is)
  abbr: string; // current zone code, e.g. "PDT" or "GMT+8"
  offsetMin: number; // current UTC offset in minutes (for sorting)
  offsetLabel: string; // e.g. "UTC−07:00"
  popular: boolean; // has a curated label (ranked first on ties)
  names: string[]; // normalized labels, words and aliases, for ranking
  abbrName: string; // normalized zone code, e.g. "cst" (ranks below an alias)
  search: string; // normalized haystack for fuzzy matching
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
 * Chrome (and other ICU/CLDR-based runtimes) still list some zones under
 * their old names, e.g. "Asia/Calcutta". The id itself works fine everywhere,
 * so we keep it as the value and only show and look up the current name.
 */
const RENAMED: Record<string, string> = {
  "Africa/Asmera": "Africa/Asmara",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Catamarca": "America/Argentina/Catamarca",
  "America/Coral_Harbour": "America/Atikokan",
  "America/Cordoba": "America/Argentina/Cordoba",
  "America/Godthab": "America/Nuuk",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Jujuy": "America/Argentina/Jujuy",
  "America/Louisville": "America/Kentucky/Louisville",
  "America/Mendoza": "America/Argentina/Mendoza",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Europe/Kiev": "Europe/Kyiv",
  "Pacific/Enderbury": "Pacific/Kanton",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Truk": "Pacific/Chuuk",
  "Etc/UTC": "UTC",
};

/** The current IANA name for `tz` (legacy aliases resolved). */
export function canonicalTz(tz: string): string {
  return RENAMED[tz] ?? tz;
}

/**
 * IANA collapses whole countries into a single zone — all of mainland China is
 * "Asia/Shanghai", all of India is "Asia/Kolkata", etc. — so the canonical city
 * often isn't what people look for. This map gives a friendlier display `label`
 * (English and Chinese) and extra search `terms` (local names, common
 * abbreviations) for the busiest zones, so "Beijing", "Mumbai", "IST", "Hawaii"
 * or "北京" all resolve to the right zone.
 */
const TZ_EXTRAS: Record<string, { label: string; zh: string; terms: string[] }> = {
  // ── Asia ──────────────────────────────────────────────────────────────
  "Asia/Shanghai": { label: "China · Beijing, Shanghai", zh: "中国 · 北京、上海", terms: ["china", "beijing", "shanghai", "shenzhen", "guangzhou", "chengdu", "chongqing", "wuhan", "hangzhou", "nanjing", "xian", "prc", "cst", "china standard time", "中国", "北京", "上海", "广州", "深圳", "成都", "重庆", "杭州", "南京", "武汉", "西安", "天津", "苏州", "北京时间"] },
  "Asia/Hong_Kong": { label: "Hong Kong", zh: "中国香港", terms: ["hong kong", "hongkong", "hk", "hkt", "香港"] },
  "Asia/Macau": { label: "Macau", zh: "中国澳门", terms: ["macau", "macao", "澳门", "澳門"] },
  "Asia/Taipei": { label: "Taipei · Taiwan", zh: "台北", terms: ["taiwan", "taipei", "台北", "台湾", "台灣"] },
  "Asia/Tokyo": { label: "Tokyo · Japan", zh: "日本 · 东京", terms: ["japan", "tokyo", "osaka", "kyoto", "jst", "日本", "东京", "東京", "大阪"] },
  "Asia/Seoul": { label: "Seoul · South Korea", zh: "韩国 · 首尔", terms: ["korea", "south korea", "seoul", "busan", "kst", "韩国", "首尔", "서울"] },
  "Asia/Kolkata": { label: "India · Mumbai, Delhi", zh: "印度 · 孟买、新德里", terms: ["india", "mumbai", "bombay", "delhi", "new delhi", "bangalore", "bengaluru", "chennai", "hyderabad", "pune", "kolkata", "calcutta", "ist", "india standard time", "印度", "孟买", "新德里", "班加罗尔"] },
  "Asia/Singapore": { label: "Singapore", zh: "新加坡", terms: ["singapore", "sgt", "新加坡"] },
  "Asia/Bangkok": { label: "Bangkok · Thailand", zh: "泰国 · 曼谷", terms: ["thailand", "bangkok", "ict", "泰国", "曼谷"] },
  "Asia/Jakarta": { label: "Jakarta · Indonesia", zh: "印尼 · 雅加达", terms: ["indonesia", "jakarta", "wib", "印尼", "印度尼西亚", "雅加达"] },
  "Asia/Ho_Chi_Minh": { label: "Ho Chi Minh City · Vietnam", zh: "越南 · 胡志明市", terms: ["vietnam", "viet nam", "saigon", "hanoi", "ho chi minh", "ict", "越南", "胡志明", "西贡", "河内"] },
  "Asia/Kuala_Lumpur": { label: "Kuala Lumpur · Malaysia", zh: "马来西亚 · 吉隆坡", terms: ["malaysia", "kuala lumpur", "kl", "myt", "马来西亚", "吉隆坡"] },
  "Asia/Manila": { label: "Manila · Philippines", zh: "菲律宾 · 马尼拉", terms: ["philippines", "manila", "pht", "菲律宾", "马尼拉"] },
  "Asia/Dubai": { label: "Dubai · UAE", zh: "阿联酋 · 迪拜", terms: ["uae", "dubai", "abu dhabi", "united arab emirates", "gst", "迪拜", "阿联酋", "阿布扎比"] },
  "Asia/Qatar": { label: "Doha · Qatar", zh: "卡塔尔 · 多哈", terms: ["qatar", "doha", "卡塔尔", "多哈"] },
  "Asia/Karachi": { label: "Karachi · Pakistan", zh: "巴基斯坦 · 卡拉奇", terms: ["pakistan", "karachi", "lahore", "islamabad", "pkt", "巴基斯坦", "卡拉奇"] },
  "Asia/Dhaka": { label: "Dhaka · Bangladesh", zh: "孟加拉国 · 达卡", terms: ["bangladesh", "dhaka", "孟加拉", "达卡"] },
  "Asia/Jerusalem": { label: "Jerusalem · Israel", zh: "以色列 · 耶路撒冷", terms: ["israel", "jerusalem", "tel aviv", "以色列", "耶路撒冷", "特拉维夫"] },
  "Asia/Riyadh": { label: "Riyadh · Saudi Arabia", zh: "沙特 · 利雅得", terms: ["saudi", "saudi arabia", "riyadh", "沙特", "利雅得"] },
  "Asia/Tehran": { label: "Tehran · Iran", zh: "伊朗 · 德黑兰", terms: ["iran", "tehran", "伊朗", "德黑兰"] },
  "Asia/Colombo": { label: "Colombo · Sri Lanka", zh: "斯里兰卡 · 科伦坡", terms: ["sri lanka", "colombo", "斯里兰卡", "科伦坡"] },
  "Asia/Kathmandu": { label: "Kathmandu · Nepal", zh: "尼泊尔 · 加德满都", terms: ["nepal", "kathmandu", "katmandu", "尼泊尔", "加德满都"] },
  "Asia/Yangon": { label: "Yangon · Myanmar", zh: "缅甸 · 仰光", terms: ["myanmar", "burma", "yangon", "rangoon", "缅甸", "仰光"] },
  "Asia/Ulaanbaatar": { label: "Ulaanbaatar · Mongolia", zh: "蒙古 · 乌兰巴托", terms: ["mongolia", "ulaanbaatar", "ulan bator", "蒙古", "乌兰巴托"] },
  "Asia/Almaty": { label: "Almaty · Kazakhstan", zh: "哈萨克斯坦 · 阿拉木图", terms: ["kazakhstan", "almaty", "哈萨克斯坦", "阿拉木图"] },
  // ── Europe ────────────────────────────────────────────────────────────
  "Europe/London": { label: "London · UK", zh: "英国 · 伦敦", terms: ["uk", "united kingdom", "britain", "great britain", "england", "scotland", "london", "manchester", "edinburgh", "gmt", "bst", "英国", "伦敦", "曼彻斯特", "爱丁堡"] },
  "Europe/Dublin": { label: "Dublin · Ireland", zh: "爱尔兰 · 都柏林", terms: ["ireland", "dublin", "爱尔兰", "都柏林"] },
  "Europe/Lisbon": { label: "Lisbon · Portugal", zh: "葡萄牙 · 里斯本", terms: ["portugal", "lisbon", "porto", "wet", "west", "葡萄牙", "里斯本"] },
  "Europe/Paris": { label: "Paris · France", zh: "法国 · 巴黎", terms: ["france", "paris", "lyon", "cet", "cest", "法国", "巴黎"] },
  "Europe/Berlin": { label: "Berlin · Germany", zh: "德国 · 柏林", terms: ["germany", "berlin", "munich", "frankfurt", "hamburg", "cet", "cest", "德国", "柏林", "慕尼黑", "法兰克福"] },
  "Europe/Madrid": { label: "Madrid · Spain", zh: "西班牙 · 马德里", terms: ["spain", "madrid", "barcelona", "cet", "cest", "西班牙", "马德里", "巴塞罗那"] },
  "Europe/Rome": { label: "Rome · Italy", zh: "意大利 · 罗马", terms: ["italy", "rome", "milan", "cet", "cest", "意大利", "罗马", "米兰"] },
  "Europe/Amsterdam": { label: "Amsterdam · Netherlands", zh: "荷兰 · 阿姆斯特丹", terms: ["netherlands", "holland", "amsterdam", "rotterdam", "cet", "cest", "荷兰", "阿姆斯特丹"] },
  "Europe/Brussels": { label: "Brussels · Belgium", zh: "比利时 · 布鲁塞尔", terms: ["belgium", "brussels", "cet", "cest", "比利时", "布鲁塞尔"] },
  "Europe/Zurich": { label: "Zurich · Switzerland", zh: "瑞士 · 苏黎世", terms: ["switzerland", "zurich", "zürich", "geneva", "bern", "cet", "cest", "瑞士", "苏黎世", "日内瓦"] },
  "Europe/Vienna": { label: "Vienna · Austria", zh: "奥地利 · 维也纳", terms: ["austria", "vienna", "wien", "cet", "cest", "奥地利", "维也纳"] },
  "Europe/Stockholm": { label: "Stockholm · Sweden", zh: "瑞典 · 斯德哥尔摩", terms: ["sweden", "stockholm", "cet", "cest", "瑞典", "斯德哥尔摩"] },
  "Europe/Oslo": { label: "Oslo · Norway", zh: "挪威 · 奥斯陆", terms: ["norway", "oslo", "cet", "cest", "挪威", "奥斯陆"] },
  "Europe/Copenhagen": { label: "Copenhagen · Denmark", zh: "丹麦 · 哥本哈根", terms: ["denmark", "copenhagen", "cet", "cest", "丹麦", "哥本哈根"] },
  "Europe/Warsaw": { label: "Warsaw · Poland", zh: "波兰 · 华沙", terms: ["poland", "warsaw", "krakow", "cet", "cest", "波兰", "华沙"] },
  "Europe/Prague": { label: "Prague · Czechia", zh: "捷克 · 布拉格", terms: ["czechia", "czech", "prague", "cet", "cest", "捷克", "布拉格"] },
  "Europe/Athens": { label: "Athens · Greece", zh: "希腊 · 雅典", terms: ["greece", "athens", "eet", "eest", "希腊", "雅典"] },
  "Europe/Helsinki": { label: "Helsinki · Finland", zh: "芬兰 · 赫尔辛基", terms: ["finland", "helsinki", "eet", "eest", "芬兰", "赫尔辛基"] },
  "Europe/Kyiv": { label: "Kyiv · Ukraine", zh: "乌克兰 · 基辅", terms: ["ukraine", "kyiv", "kiev", "eet", "eest", "乌克兰", "基辅"] },
  "Europe/Istanbul": { label: "Istanbul · Türkiye", zh: "土耳其 · 伊斯坦布尔", terms: ["turkey", "türkiye", "turkiye", "istanbul", "ankara", "trt", "土耳其", "伊斯坦布尔"] },
  "Europe/Moscow": { label: "Moscow · Russia", zh: "俄罗斯 · 莫斯科", terms: ["russia", "moscow", "st petersburg", "msk", "俄罗斯", "莫斯科"] },
  // ── Americas ──────────────────────────────────────────────────────────
  "America/New_York": { label: "New York · US Eastern", zh: "美东 · 纽约", terms: ["usa", "us", "us eastern", "eastern", "et", "est", "edt", "new york", "nyc", "boston", "washington", "dc", "philadelphia", "miami", "atlanta", "纽约", "美东", "美国东部", "波士顿", "华盛顿", "费城", "迈阿密", "亚特兰大"] },
  "America/Chicago": { label: "Chicago · US Central", zh: "美中 · 芝加哥", terms: ["us central", "central", "ct", "cst", "cdt", "chicago", "dallas", "houston", "austin", "texas", "minneapolis", "芝加哥", "美中", "美国中部", "休斯顿", "达拉斯", "奥斯汀", "德州"] },
  "America/Denver": { label: "Denver · US Mountain", zh: "美国山地 · 丹佛", terms: ["us mountain", "mountain", "mt", "mst", "mdt", "denver", "colorado", "salt lake city", "utah", "丹佛", "盐湖城"] },
  "America/Phoenix": { label: "Phoenix · Arizona", zh: "亚利桑那 · 凤凰城", terms: ["arizona", "phoenix", "tucson", "mst", "亚利桑那", "凤凰城"] },
  "America/Los_Angeles": { label: "Los Angeles · US Pacific", zh: "美西 · 洛杉矶", terms: ["us pacific", "pacific", "pt", "pst", "pdt", "los angeles", "la", "san francisco", "sf", "bay area", "silicon valley", "san diego", "seattle", "portland", "las vegas", "california", "洛杉矶", "美西", "美国西部", "旧金山", "湾区", "硅谷", "圣迭戈", "西雅图", "波特兰", "拉斯维加斯", "加州"] },
  "America/Anchorage": { label: "Anchorage · Alaska", zh: "阿拉斯加 · 安克雷奇", terms: ["alaska", "anchorage", "akst", "akdt", "阿拉斯加"] },
  "Pacific/Honolulu": { label: "Honolulu · Hawaii", zh: "夏威夷 · 檀香山", terms: ["hawaii", "honolulu", "hst", "夏威夷", "檀香山"] },
  "America/Toronto": { label: "Toronto · Canada", zh: "加拿大 · 多伦多", terms: ["canada", "toronto", "ottawa", "montreal", "加拿大", "多伦多", "渥太华", "蒙特利尔"] },
  "America/Vancouver": { label: "Vancouver · Canada", zh: "加拿大 · 温哥华", terms: ["vancouver", "british columbia", "bc", "温哥华"] },
  "America/Edmonton": { label: "Edmonton · Calgary", zh: "加拿大 · 埃德蒙顿、卡尔加里", terms: ["edmonton", "calgary", "alberta", "卡尔加里", "埃德蒙顿"] },
  "America/Mexico_City": { label: "Mexico City · Mexico", zh: "墨西哥 · 墨西哥城", terms: ["mexico", "mexico city", "墨西哥"] },
  "America/Bogota": { label: "Bogotá · Colombia", zh: "哥伦比亚 · 波哥大", terms: ["colombia", "bogota", "哥伦比亚", "波哥大"] },
  "America/Lima": { label: "Lima · Peru", zh: "秘鲁 · 利马", terms: ["peru", "lima", "秘鲁", "利马"] },
  "America/Santiago": { label: "Santiago · Chile", zh: "智利 · 圣地亚哥", terms: ["chile", "santiago", "智利"] },
  "America/Sao_Paulo": { label: "São Paulo · Brazil", zh: "巴西 · 圣保罗", terms: ["brazil", "sao paulo", "rio", "rio de janeiro", "brt", "巴西", "圣保罗", "里约"] },
  "America/Argentina/Buenos_Aires": { label: "Buenos Aires · Argentina", zh: "阿根廷 · 布宜诺斯艾利斯", terms: ["argentina", "buenos aires", "art", "阿根廷", "布宜诺斯艾利斯"] },
  // ── Oceania ───────────────────────────────────────────────────────────
  "Australia/Sydney": { label: "Sydney · Australia", zh: "澳大利亚 · 悉尼", terms: ["australia", "sydney", "canberra", "aest", "aedt", "澳大利亚", "澳洲", "悉尼", "堪培拉"] },
  "Australia/Melbourne": { label: "Melbourne · Australia", zh: "澳大利亚 · 墨尔本", terms: ["melbourne", "victoria", "aest", "aedt", "墨尔本"] },
  "Australia/Brisbane": { label: "Brisbane · Queensland", zh: "澳大利亚 · 布里斯班", terms: ["brisbane", "queensland", "aest", "布里斯班"] },
  "Australia/Perth": { label: "Perth · Western Australia", zh: "澳大利亚 · 珀斯", terms: ["perth", "western australia", "awst", "珀斯"] },
  "Australia/Adelaide": { label: "Adelaide · South Australia", zh: "澳大利亚 · 阿德莱德", terms: ["adelaide", "south australia", "acst", "acdt", "阿德莱德"] },
  "Pacific/Auckland": { label: "Auckland · New Zealand", zh: "新西兰 · 奥克兰", terms: ["new zealand", "nz", "auckland", "wellington", "nzst", "nzdt", "新西兰", "奥克兰", "惠灵顿"] },
  // ── Africa ────────────────────────────────────────────────────────────
  "Africa/Cairo": { label: "Cairo · Egypt", zh: "埃及 · 开罗", terms: ["egypt", "cairo", "eet", "eest", "埃及", "开罗"] },
  "Africa/Casablanca": { label: "Casablanca · Morocco", zh: "摩洛哥 · 卡萨布兰卡", terms: ["morocco", "casablanca", "摩洛哥", "卡萨布兰卡"] },
  "Africa/Johannesburg": { label: "Johannesburg · South Africa", zh: "南非 · 约翰内斯堡", terms: ["south africa", "johannesburg", "cape town", "sast", "南非", "约翰内斯堡", "开普敦"] },
  "Africa/Lagos": { label: "Lagos · Nigeria", zh: "尼日利亚 · 拉各斯", terms: ["nigeria", "lagos", "wat", "尼日利亚", "拉各斯"] },
  "Africa/Nairobi": { label: "Nairobi · Kenya", zh: "肯尼亚 · 内罗毕", terms: ["kenya", "nairobi", "eat", "肯尼亚", "内罗毕"] },
  // ── No region ─────────────────────────────────────────────────────────
  UTC: { label: "UTC", zh: "UTC（协调世界时）", terms: ["utc", "coordinated universal time", "universal", "zulu", "协调世界时", "世界时"] },
};

/** Lowercase and strip accents, so "são" matches "sao" and "Zürich" "zurich". */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/−/g, "-");
}

/** Build display + search metadata for one IANA zone (offset as of `ref`). */
export function tzInfo(tz: string, ref?: DateTime): TzInfo {
  const key = canonicalTz(tz);
  const dt = (ref ?? DateTime.now()).setZone(tz);
  const offsetMin = dt.isValid ? dt.offset : 0;
  const abbr = dt.isValid ? dt.toFormat("ZZZZ") : "";
  const slash = key.indexOf("/");
  let region = slash === -1 ? "Other" : key.slice(0, slash);
  if (region === "Etc") region = "Other";
  const derivedCity = (slash === -1 ? key : key.slice(slash + 1))
    .replace(/_/g, " ")
    .replace(/\//g, " · ");
  const extra = TZ_EXTRAS[key];
  const city = extra ? (getLang() === "zh" ? extra.zh : extra.label) : derivedCity;
  const offsetLabel = formatOffset(offsetMin);
  const labels = [derivedCity, ...(extra ? [extra.label, extra.zh, ...extra.terms] : [])].map(norm);
  const words = labels.flatMap((l) => l.split(/[\s·,、()（）]+/)).filter(Boolean);
  const names = Array.from(new Set([...labels, ...words]));
  // Keep the raw ids too (old and new), so "calcutta" or "kolkata" both match.
  const abbrName = norm(abbr);
  const search = norm(`${tz} ${key} ${region} ${abbr} ${labels.join(" ")}`);
  return { tz, key, region, city, abbr, offsetMin, offsetLabel, popular: !!extra, names, abbrName, search };
}

/**
 * Parse an offset query such as "utc+8", "gmt-5", "+5:30" or "utc+0530".
 * Returns the sign, hours and (possibly partial) minutes typed, or null.
 */
function parseOffset(term: string): { min: number; hours: number; minutes: string } | null {
  const m = term.match(/^(?:utc|gmt)?([+-])(\d{1,2})(?::?(\d{0,2}))?$/);
  if (!m) return null;
  return { min: m[1] === "-" ? -1 : 1, hours: Number(m[2]), minutes: m[3] ?? "" };
}

/**
 * How well `info` matches `query`: 0 is best, null means no match. Words are
 * matched separately ("new york"); an exact name or alias beats a prefix,
 * which beats a match anywhere. Offsets ("utc+1") match the hour exactly, so
 * they don't also pull in +10, +11 or +12.
 */
export function matchTz(info: TzInfo, query: string): number | null {
  const q = norm(query).trim();
  if (!q) return 0;
  let score = 0;
  for (const term of q.split(/\s+/)) {
    const off = parseOffset(term);
    if (off) {
      const sign = info.offsetMin < 0 ? -1 : 1;
      const abs = Math.abs(info.offsetMin);
      const h = Math.floor(abs / 60);
      const mm = String(abs % 60).padStart(2, "0");
      const sameSign = sign === off.min || info.offsetMin === 0;
      if (!sameSign || h !== off.hours || !mm.startsWith(off.minutes)) return null;
      score += abs % 60 === 0 ? 1 : 2;
      continue;
    }
    if (term === "utc" || term === "gmt") {
      // A bare "UTC" / "GMT": the UTC zone itself, then zones at UTC+0 now.
      if (info.key === "UTC") continue;
      if (info.offsetMin !== 0) return null;
      score += 1;
      continue;
    }
    if (/^(utc|gmt)[+-]?$/.test(term)) {
      score += 2; // still typing an offset: keep everything for now
      continue;
    }
    if (info.names.includes(term)) continue;
    // "CST" is Mexico City's code too, but people typing it mean Chicago or China.
    if (info.abbrName === term) score += 0.5;
    else if (info.names.some((n) => n.startsWith(term))) score += 1;
    else if (info.search.includes(term)) score += 2;
    else return null;
  }
  return score;
}

/** Zones matching `query`, best first (then popular, then by offset). */
export function searchTimeZones(zones: TzInfo[], query: string): TzInfo[] {
  const scored: { info: TzInfo; score: number }[] = [];
  for (const info of zones) {
    const score = matchTz(info, query);
    if (score !== null) scored.push({ info, score });
  }
  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        Number(b.info.popular) - Number(a.info.popular) ||
        a.info.offsetMin - b.info.offsetMin ||
        a.info.city.localeCompare(b.info.city)
    )
    .map((s) => s.info);
}

/**
 * All IANA zone ids the runtime knows (plus UTC), one per current name, or the
 * curated shortlist as fallback.
 */
export function allTzNames(): string[] {
  let names: string[] = COMMON_TZS;
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (supported && supported.length) names = [...supported, "UTC"];
  } catch {
    /* older runtime — fall through */
  }
  const seen = new Set<string>();
  return names.filter((tz) => {
    const key = canonicalTz(tz);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
