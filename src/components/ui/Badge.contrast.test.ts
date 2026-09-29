/**
 * Badge.contrast.test.ts (#49)
 *
 * WCAG AA (4.5:1) check for every status/difficulty badge text/background
 * pair, light and dark. Tailwind palette hexes are inlined; translucent dark
 * backgrounds (`/10`) are composited over the dark page background.
 */

const HEX = {
  white: "#ffffff",
  "slate-100": "#f1f5f9", "slate-300": "#cbd5e1", "slate-700": "#334155", "slate-800": "#1e293b",
  "sky-50": "#f0f9ff", "sky-300": "#7dd3fc", "sky-500": "#0ea5e9", "sky-800": "#075985",
  "amber-50": "#fffbeb", "amber-300": "#fcd34d", "amber-500": "#f59e0b", "amber-800": "#92400e",
  "indigo-50": "#eef2ff", "indigo-300": "#a5b4fc", "indigo-500": "#6366f1", "indigo-800": "#3730a3",
  "violet-50": "#f5f3ff", "violet-300": "#c4b5fd", "violet-500": "#8b5cf6", "violet-800": "#5b21b6",
  "emerald-50": "#ecfdf5", "emerald-300": "#6ee7b7", "emerald-500": "#10b981", "emerald-700": "#047857", "emerald-800": "#065f46", "emerald-950": "#022c22",
  "rose-50": "#fff1f2", "rose-300": "#fda4af", "rose-500": "#f43f5e", "rose-800": "#9f1239",
  "fuchsia-50": "#fdf4ff", "fuchsia-300": "#f0abfc", "fuchsia-500": "#d946ef", "fuchsia-800": "#86198f",
} as const;

type RGB = [number, number, number];
const rgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const over = (fg: RGB, a: number, bg: RGB): RGB => fg.map((c, i) => c * a + bg[i] * (1 - a)) as RGB;
const lum = ([r, g, b]: RGB) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const PAGE_DARK = rgb("#0a0a0f"); // globals.css dark background
const tint = (name: keyof typeof HEX) => over(rgb(HEX[name]), 0.1, PAGE_DARK);
const c = (name: keyof typeof HEX) => rgb(HEX[name]);

// [label, foreground, background]
const PAIRS: Array<[string, RGB, RGB]> = [
  ["open light", c("slate-700"), c("slate-100")],
  ["open dark", c("slate-300"), c("slate-800")],
  ["refunded light", c("slate-700"), c("slate-100")],
  ["refunded dark", c("slate-300"), c("slate-800")],
  ["paid light", c("white"), c("emerald-700")],
  ["paid dark", c("emerald-950"), c("emerald-500")],
  ...(["sky", "amber", "indigo", "violet", "rose", "fuchsia", "emerald"] as const).flatMap(
    (h): Array<[string, RGB, RGB]> => [
      [`${h} light`, c(`${h}-800` as keyof typeof HEX), c(`${h}-50` as keyof typeof HEX)],
      [`${h} dark`, c(`${h}-300` as keyof typeof HEX), tint(`${h}-500` as keyof typeof HEX)],
    ],
  ),
];

describe("badge colour contrast", () => {
  it.each(PAIRS)("%s meets WCAG AA", (_label, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
