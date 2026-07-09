import { type ReactNode, type ComponentType } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Bare value — the current trial/step number, or a raw count/tally — that
 *  sits just left of a List row's action buttons. No bubble/background of
 *  its own (previously a filled circle) so it reads as plain text distinct
 *  from the buttons' own filled shapes, not another button-like shape among
 *  them. `weight` is "bold" where the number itself IS the recorded data
 *  (a Rate/Frequency tally) and "regular" where it's just a position marker
 *  (a trial/step/instance index) — same distinction Card mode's own large
 *  center numerals vs. small side numerals draw. */
export function ListActionBadge({
  value,
  weight = "regular",
}: {
  value: number | string;
  weight?: "bold" | "regular";
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center min-w-[1.25rem] h-7 tabular-nums",
        weight === "bold" ? "text-[15px] font-bold text-foreground" : "text-[11px] font-semibold text-foreground/60",
      )}
    >
      {/* The colon reads as "position N, of the data that follows" — only
          meaningful for a position marker (weight="regular"), not a bare
          tally that IS the data itself. */}
      {weight === "regular" ? `${value}:` : value}
    </span>
  );
}

const LIST_BUTTON_VARIANTS = {
  neutral: {
    classes: "border-stone-200 bg-white text-foreground/70 hover:bg-stone-50",
    selectedClasses: "bg-stone-600 border-stone-700 text-white",
  },
  red: {
    classes: "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
    selectedClasses: "bg-red-500 border-red-600 text-white",
  },
  amber: {
    classes: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
    selectedClasses: "bg-amber-500 border-amber-600 text-white",
  },
  green: {
    classes: "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
    selectedClasses: "bg-green-500 border-green-600 text-white",
  },
  blue: {
    classes: "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100",
    selectedClasses: "bg-blue-500 border-blue-600 text-white",
  },
  // Always filled/solid, never just outlined — for direct-action buttons
  // like Frequency/Rate's Increment that have no on/off "selected" state of
  // their own (they just fire), matching Card mode's own solid blue plus
  // button instead of reading as an unselected toggle.
  "blue-solid": {
    classes: "border-blue-600 bg-blue-500 text-white hover:bg-blue-600",
    selectedClasses: "bg-blue-500 border-blue-600 text-white",
  },
} as const;

/** Small circular icon-only button for a List row's floating action group —
 *  the same color language every full-size action button already uses
 *  (red=error, amber=neutral/prompted, green=correct, blue=increment),
 *  just icon-only at a size that fits a single-line row. `hasMenu` draws a
 *  tiny solid triangle at the bottom edge — the same "more choices below"
 *  cue for every button that opens a picker popup (prompt level, rating)
 *  instead of acting directly. */
export function ListActionButton({
  icon: Icon,
  variant,
  selected = false,
  disabled = false,
  hasMenu = false,
  ariaLabel,
  onClick,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  variant: keyof typeof LIST_BUTTON_VARIANTS;
  selected?: boolean;
  disabled?: boolean;
  hasMenu?: boolean;
  ariaLabel: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const { classes, selectedClasses } = LIST_BUTTON_VARIANTS[variant];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-haspopup={hasMenu || undefined}
      className={cn(
        "btn-bevel relative shrink-0 size-7 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
        classes,
        selected && cn("btn-bevel", selectedClasses),
      )}
    >
      {/* Nudged up a hair to leave room for the triangle below it, inside
          the button, rather than the icon sitting dead-center and pushing
          the triangle out past the button's own edge. */}
      <Icon className={cn("size-3.5", hasMenu && "-translate-y-0.5")} strokeWidth={3} />
      {hasMenu && (
        <span
          className="absolute bottom-1 left-1/2 -translate-x-1/2 size-0 border-l-[3px] border-r-[3px] border-t-[3.5px] border-l-transparent border-r-transparent border-t-current opacity-70"
          aria-hidden
        />
      )}
    </button>
  );
}

/** Wraps just a List row's value/badge (NOT its buttons) so advancing to a
 *  new trial/instance/step/tally reads as one continuous relay instead of
 *  the number just snapping to its new value in place: the old value slides
 *  up and out while the new one slides in from below, keyed by whatever
 *  identifies "which one" (trial index, instance index, step index, tally
 *  count). The buttons stay put as plain siblings outside this wrapper —
 *  same pattern Card mode's own action buttons already follow (their
 *  selected/disabled state just updates in place, never remounting the
 *  button itself). Deliberately NOT forced to position: absolute here —
 *  with mode="popLayout", Motion already pulls only the EXITING copy out of
 *  flow on its own, leaving the entering one in normal flow so its content
 *  still sizes this wrapper's (and the floating parent's) width; forcing
 *  both to absolute collapsed that width to 0, since neither copy was left
 *  to size anything.
 *  `direction` reverses which way it travels — 1 (the default) is "moved
 *  forward" (next trial, incremented count): new content rises in from the
 *  bottom, old content exits off the top. -1 is "moved backward"
 *  (decremented count, previous trial) and plays the same motion mirrored. */
export function ListActionSlide({
  actionKey,
  direction = 1,
  heightClassName = "h-7",
  children,
}: {
  actionKey: string | number;
  direction?: 1 | -1;
  heightClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden", heightClassName)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={actionKey}
          initial={{ y: direction > 0 ? "100%" : "-100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: direction > 0 ? "-100%" : "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="flex items-center justify-end gap-1"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
