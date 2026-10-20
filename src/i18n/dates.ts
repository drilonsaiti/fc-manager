/**
 * Day and month names written out for the three supported languages, so dates read correctly
 * on every device (browsers differ in how much locale data they ship).
 */
type L = "en" | "sq" | "mk" | "de" | "it" | "tr";

const DAYS_LONG: Record<L, string[]> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  sq: ["e diel", "e hënë", "e martë", "e mërkurë", "e enjte", "e premte", "e shtunë"],
  mk: ["недела", "понеделник", "вторник", "среда", "четврток", "петок", "сабота"],
  de: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
  it: ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"],
  tr: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
};
const DAYS_SHORT: Record<L, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  sq: ["die", "hën", "mar", "mër", "enj", "pre", "sht"],
  mk: ["нед", "пон", "вто", "сре", "чет", "пет", "саб"],
  de: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
  it: ["dom", "lun", "mar", "mer", "gio", "ven", "sab"],
  tr: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"],
};
const MONTHS_LONG: Record<L, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  sq: ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"],
  mk: ["јануари", "февруари", "март", "април", "мај", "јуни", "јули", "август", "септември", "октомври", "ноември", "декември"],
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  it: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
  tr: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
};
const MONTHS_SHORT: Record<L, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  sq: ["jan", "shk", "mar", "pri", "maj", "qer", "kor", "gus", "sht", "tet", "nën", "dhj"],
  mk: ["јан", "фев", "мар", "апр", "мај", "јун", "јул", "авг", "сеп", "окт", "ное", "дек"],
  de: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
  it: ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"],
  tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
};

const langOf = (locale: string): L => {
  const prefix = locale.toLowerCase().split("-")[0];
  return prefix === "sq" || prefix === "mk" || prefix === "de" || prefix === "it" || prefix === "tr" ? prefix : "en";
};
const pad = (n: number) => String(n).padStart(2, "0");

export interface DateStyle { weekday?: "short" | "long"; month?: "short" | "long"; year?: boolean }

/** "Tue, 6 Oct" · "Tuesday 6 October 2026" · "e martë 6 tetor". */
export function formatDay(d: Date, locale: string, style: DateStyle = {}): string {
  const l = langOf(locale);
  const { weekday = "short", month = "short", year = false } = style;
  const wd = weekday === "long" ? DAYS_LONG[l][d.getDay()] : DAYS_SHORT[l][d.getDay()];
  const mo = month === "long" ? MONTHS_LONG[l][d.getMonth()] : MONTHS_SHORT[l][d.getMonth()];
  const sep = weekday === "long" ? " " : ", ";
  return `${wd}${sep}${d.getDate()} ${mo}${year ? ` ${d.getFullYear()}` : ""}`;
}

/** 24-hour "16:00", the same everywhere. */
export const formatTime = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Numeric date for compact lists: 06.10.2026. */
export const formatNumericDate = (d: Date): string => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
