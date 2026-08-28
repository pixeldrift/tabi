import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";

// Hex equivalents of the Tailwind palette shades actually referenced below —
// Tailwind v4 defines these as oklch internally, but the hex values are what
// the docs list for the same shade and read as visually identical; close
// enough for a reference census, not meant to be pixel-exact.
const FAMILY_HEX: Record<string, Record<number, string>> = {
  stone: {
    50: "#fafaf9",
    100: "#f5f5f4",
    200: "#e7e5e4",
    300: "#d6d3d1",
    400: "#a8a29e",
    500: "#78716c",
    600: "#57534e",
    700: "#44403c",
    800: "#292524",
    900: "#1c1917",
  },
  blue: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
  }, // "classic" Tailwind reference — see RECOLORED_FAMILIES note below
  red: {
    50: "#fef2f2",
    100: "#fee2e2",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
    700: "#b91c1c",
  },
  green: {
    50: "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
  },
  amber: {
    50: "#fffbeb",
    100: "#fef3c7",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
  },
  yellow: { 300: "#fde047", 400: "#facc15" },
  violet: { 50: "#f5f3ff", 300: "#c4b5fd", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9" },
  teal: { 50: "#f0fdfa", 300: "#5eead4", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e" },
  rose: { 50: "#fff1f2", 300: "#fda4af", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c" },
  orange: { 50: "#fff7ed", 300: "#fdba74", 500: "#f97316", 600: "#ea580c", 700: "#c2410c" },
  indigo: { 50: "#eef2ff", 300: "#a5b4fc", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca" },
  emerald: { 50: "#ecfdf5", 300: "#6ee7b7", 500: "#10b981", 600: "#059669", 700: "#047857" },
};

// Counted from every `bg-`/`text-`/`border-`/`ring-`/`fill-`/`stroke-`/etc.
// Tailwind color utility in src/ (a plain grep census, not exact to the
// pixel) — grouped into the app's two real neutral/accent palettes: the
// everyday one used throughout cards and controls, and the six
// notification-category hues that share one deliberate 50/300/500/600/700
// pattern (see NotificationBar.tsx's own NOTIFICATION_STYLES).
const CORE_PALETTE: { family: string; counts: Record<number, number> }[] = [
  {
    family: "stone",
    counts: {
      50: 15,
      100: 49,
      200: 37,
      300: 24,
      400: 42,
      500: 28,
      600: 29,
      700: 7,
      800: 14,
      900: 5,
    },
  },
  {
    family: "blue",
    counts: { 50: 41, 100: 15, 200: 5, 300: 25, 400: 58, 500: 118, 600: 138, 700: 43, 800: 3 },
  },
  { family: "red", counts: { 50: 27, 100: 10, 300: 21, 400: 7, 500: 27, 600: 26, 700: 25 } },
  { family: "green", counts: { 50: 15, 100: 8, 300: 12, 400: 3, 500: 17, 600: 15, 700: 21 } },
  { family: "amber", counts: { 50: 11, 100: 5, 300: 12, 400: 1, 500: 10, 600: 9, 700: 13 } },
  { family: "yellow", counts: { 300: 1, 400: 5 } },
];

// blue/amber/red/green are no longer literally themselves — styles.css's
// `:root` (see the "default" Sand & Sage theme) redefines each family's
// entire --color-{family}-{shade} scale to a hue-shifted substitute (blue
// -> Slate, amber -> Ochre/Mustard, red -> Rust, green -> Sage), and
// `[data-theme="alt"]` redefines them again back to something close to
// stock Tailwind. Every `bg-blue-500` etc. in the codebase still says
// "blue" — only the CSS variable backing that utility class actually
// changed — which is exactly the kind of change this census can't see
// without checking styles.css directly, unlike a brand new component
// import. stone/yellow (and the notification accents below) were never
// touched and stay literally stock in both themes.
const RECOLORED_FAMILIES = new Set(["blue", "amber", "red", "green"]);

const NOTIFICATION_ACCENTS: { family: string; category: string }[] = [
  { family: "blue", category: "default" },
  { family: "emerald", category: "message" },
  { family: "violet", category: "announcement" },
  { family: "teal", category: "appointment-new" },
  { family: "rose", category: "appointment-cancelled" },
  { family: "orange", category: "edit-request" },
  { family: "indigo", category: "edit-approved" },
];
const ACCENT_SHAPE = { 50: 1, 300: 1, 500: 2, 600: 1, 700: 2 };

/** One semantic design-system role — shown as its bg/fg pair so a
 *  contrast mismatch would actually be visible, not just its bg color. */
function TokenPair({
  name,
  bgVar,
  fgVar,
  note,
}: {
  name: string;
  bgVar: string;
  fgVar?: string;
  note?: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 w-16"
      title={`bg-${name}${fgVar ? ` / text-${name}-foreground` : ""}${note ? `  —  ${note}` : ""}`}
    >
      <div className="flex size-9 overflow-hidden rounded-md border border-black/10 shadow-sm">
        <div className="flex-1" style={{ backgroundColor: `var(${bgVar})` }} />
        {fgVar && (
          <div
            className="flex-1 grid place-items-center"
            style={{ backgroundColor: `var(${bgVar})` }}
          >
            <span className="text-[13px] font-semibold" style={{ color: `var(${fgVar})` }}>
              A
            </span>
          </div>
        )}
      </div>
      <span className="text-[10px] font-medium leading-none text-center">{name}</span>
      {note && <span className="text-[8px] leading-none text-amber-600 font-medium">{note}</span>}
    </div>
  );
}

function TokenSolo({ name, cssVar, note }: { name: string; cssVar: string; note?: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1 w-16"
      title={`--${name}${note ? `  —  ${note}` : ""}`}
    >
      <div
        className="size-9 rounded-md border border-black/10 shadow-sm"
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <span className="text-[10px] font-medium leading-none text-center">{name}</span>
      {note && <span className="text-[8px] leading-none text-amber-600 font-medium">{note}</span>}
    </div>
  );
}

/** Same idea as TokenSolo, for the two `--gradient-*` tokens — a flat
 *  backgroundColor can't render a linear-gradient() value, so this swaps
 *  in backgroundImage instead. */
function TokenGradient({ name, cssVar, note }: { name: string; cssVar: string; note?: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1 w-16"
      title={`--${name}${note ? `  —  ${note}` : ""}`}
    >
      <div
        className="size-9 rounded-md border border-black/10 shadow-sm"
        style={{ backgroundImage: `var(${cssVar})` }}
      />
      <span className="text-[10px] font-medium leading-none text-center">{name}</span>
      {note && <span className="text-[8px] leading-none text-amber-600 font-medium">{note}</span>}
    </div>
  );
}

function Swatch({ family, shade, count }: { family: string; shade: number; count: number }) {
  const hex = FAMILY_HEX[family]?.[shade];
  const recolored = RECOLORED_FAMILIES.has(family);
  return (
    <div
      className="relative flex flex-col items-center gap-0.5 w-14"
      title={`${family}-${shade}  ${
        recolored ? "live theme color" : hex
      }  ×${count}${recolored ? "  (classic Tailwind hex: " + hex + ")" : ""}`}
    >
      <div className="relative">
        {/* Reads the actual CSS variable the bg-{family}-{shade} utility
            resolves to, not a hardcoded hex — for stone/yellow (and the
            notification accents below) that's the same stock Tailwind
            value the hex label shows; for the recolored families it's
            whatever the active theme substitutes (see RECOLORED_FAMILIES),
            so the swatch itself always matches what's actually on screen. */}
        <div
          className="size-8 rounded-md border border-black/10 shadow-sm"
          style={{ backgroundColor: `var(--color-${family}-${shade})` }}
        />
        <span className="absolute -top-1.5 -right-1.5 rounded-full bg-white border border-stone-200 text-[8px] leading-none px-1 py-0.5 text-stone-500">
          {count}
        </span>
      </div>
      <span className="text-[10px] font-medium leading-none mt-0.5">{shade}</span>
      <span className="text-[8px] font-mono leading-none text-muted-foreground">
        {recolored ? `${hex}*` : hex}
      </span>
    </div>
  );
}

/** Reference census of every color value actually in play — the design
 *  system's own named tokens (which most components bypass in favor of
 *  literal Tailwind shades) plus a grep-counted tally of those literal
 *  shades, grouped by hue. Meant to surface near-duplicate or unused
 *  values worth consolidating, not to be a design tool itself. */
export function ColorPaletteShowcase() {
  const [open, setOpen] = useState(false);
  const totalSwatches =
    CORE_PALETTE.reduce((n, f) => n + Object.keys(f.counts).length, 0) +
    NOTIFICATION_ACCENTS.length * Object.keys(ACCENT_SHAPE).length;

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Colors
          </h3>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            Theme tokens + every color shade in use ({totalSwatches}), for reference.
          </p>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown className="size-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-6">
              {/* Semantic tokens — read live off the CSS vars in styles.css, so
                  they reflect the actual current theme (light/dark) rather
                  than a hardcoded guess. */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
                  Theme tokens
                </h4>
                <div className="flex flex-wrap gap-3">
                  <TokenPair name="background" bgVar="--background" fgVar="--foreground" />
                  <TokenPair name="card" bgVar="--card" fgVar="--card-foreground" />
                  <TokenPair
                    name="popover"
                    bgVar="--popover"
                    fgVar="--popover-foreground"
                    note="= card"
                  />
                  <TokenPair name="primary" bgVar="--primary" fgVar="--primary-foreground" />
                  <TokenPair name="secondary" bgVar="--secondary" fgVar="--secondary-foreground" />
                  <TokenPair name="muted" bgVar="--muted" fgVar="--muted-foreground" />
                  <TokenPair name="accent" bgVar="--accent" fgVar="--accent-foreground" />
                  <TokenPair
                    name="destructive"
                    bgVar="--destructive"
                    fgVar="--destructive-foreground"
                  />
                  <TokenSolo name="border" cssVar="--border" />
                  <TokenSolo name="input" cssVar="--input" />
                  <TokenSolo name="ring" cssVar="--ring" />
                  <TokenGradient
                    name="gradient-warm"
                    cssVar="--gradient-warm"
                    note="not used yet"
                  />
                  <TokenGradient
                    name="gradient-primary"
                    cssVar="--gradient-primary"
                    note="not used yet"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/70 mt-2">
                  Most cards/alerts reach for a literal Tailwind shade (below) instead of these.
                  "popover" now aliases "card" directly in styles.css rather than duplicating its
                  value — the two were never actually differentiated. The formerly-unused
                  "success"/"surface"/"surface-elevated" tokens have been removed outright: nothing
                  referenced them and there was no near-term plan that needed them kept as a spare.
                  The two gradient tokens above are the newest addition — defined (and their
                  matching <span className="font-mono">bg-gradient-warm</span>/
                  <span className="font-mono">bg-gradient-primary</span> utility classes already
                  wired up) but not yet reached for by any component.
                </p>
              </div>

              {/* Literal Tailwind shades, tallied by a grep across src/ —
                  counts are a rough census (total mentions of each
                  `family-shade` string), not a precise usage audit. */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
                  Palette shades in use
                </h4>
                <div className="space-y-3">
                  {CORE_PALETTE.map(({ family, counts }) => (
                    <div key={family} className="flex items-start gap-3">
                      <span className="w-12 shrink-0 text-[11px] font-medium capitalize pt-2">
                        {family}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(counts).map(([shade, count]) => (
                          <Swatch key={shade} family={family} shade={Number(shade)} count={count} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground/70 mt-3">
                  Neutral family is consistently "stone" — no stray gray/zinc/slate/neutral shades
                  found. Swatches render the live CSS variable each utility class actually resolves
                  to in the current theme; the hex below it is the classic Tailwind reference value
                  for that family/shade. <span className="font-mono">*</span> marks
                  blue/amber/red/green — the "Sand & Sage" default theme substitutes its own
                  Slate/Ochre/Rust/Sage scale for these (see styles.css's{" "}
                  <span className="font-mono">:root</span>/
                  <span className="font-mono">[data-theme=&quot;alt&quot;]</span> overrides), so the
                  swatch color and that reference hex intentionally diverge there.
                </p>
              </div>

              {/* The six notification-category accents — each following the
                  exact same shape (50/300/500/600/700), so shown together
                  rather than mixed into the general tally above. */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
                  Notification category accents
                </h4>
                <div className="space-y-3">
                  {NOTIFICATION_ACCENTS.map(({ family, category }) => (
                    <div key={family} className="flex items-start gap-3">
                      <span
                        className="w-32 shrink-0 text-[11px] font-medium pt-2 truncate"
                        title={category}
                      >
                        {category}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(ACCENT_SHAPE).map(([shade, count]) => (
                          <Swatch key={shade} family={family} shade={Number(shade)} count={count} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hardcoded hex outside any Tailwind class — SVG `fill` and
                  Framer Motion color-interpolation targets can't take a
                  class, so these are necessary, not sloppy; listed so it's
                  visible that they already match existing palette shades
                  rather than introducing new ones. */}
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
                  Hardcoded hex (SVG fills / animated colors)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    { hex: "#2563eb", matches: "blue-600" },
                    { hex: "#3b82f6", matches: "blue-500 (alt theme)" },
                    { hex: "#1d4ed8", matches: "blue-700 (alt theme)" },
                    { hex: "#a8a29e", matches: "stone-400" },
                    { hex: "#d6d3d1", matches: "stone-300" },
                    { hex: "#292524", matches: "stone-800" },
                    { hex: "#f0fdf4", matches: "green-50" },
                    { hex: "#eff6ff", matches: "blue-50" },
                    { hex: "#0a5351", matches: "no match — Sand & Sage's own blue-700" },
                    { hex: "#358987", matches: "no match — Sand & Sage's own blue-500" },
                  ].map(({ hex, matches }) => (
                    <div
                      key={hex}
                      className="flex flex-col items-center gap-0.5 w-16"
                      title={`matches ${matches}`}
                    >
                      <div
                        className="size-8 rounded-md border border-black/10 shadow-sm"
                        style={{ backgroundColor: hex }}
                      />
                      <span className="text-[8px] font-mono leading-none text-muted-foreground mt-0.5">
                        {hex}
                      </span>
                      <span className="text-[9px] leading-none text-center">{matches}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground/70 mt-2">
                  Most match an existing shade above (chevrons in IntervalCard/ScheduleView, the
                  synced-timer digit/border color morph in StatusBar) — the two "no match" entries
                  are the default theme's own recolored blue-700/blue-500 (actionColors.ts's
                  TIMER_MORPH_*_FULL), needed as literal hex because Framer Motion's color
                  interpolation can't resolve a theme-dependent{" "}
                  <span className="font-mono">var(--color-blue-700)</span> mid-tween the way static
                  CSS can. The static error-page fallback (error-page.ts) has its own separate
                  hardcoded gray/white/black — intentionally standalone since it must render without
                  the app's own CSS.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
