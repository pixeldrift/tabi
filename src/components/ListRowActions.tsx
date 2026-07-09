import { type ReactNode, type ComponentType } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Small round value badge — the current trial/step number, or a raw
 *  count/tally — that sits just left of a List row's action buttons. Same
 *  visual language as TrialCard's own expanded-list per-row number. */
export function ListActionBadge({ value }: { value: number | string }) {
  return (
    <span className="grid shrink-0 place-items-center size-6 rounded-full bg-stone-100 text-[11px] font-semibold text-foreground/70 tabular-nums">
      {value}
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
      <Icon className="size-3.5" strokeWidth={3} />
      {hasMenu && (
        <span
          className="absolute -bottom-[3px] left-1/2 -translate-x-1/2 size-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-current opacity-70"
          aria-hidden
        />
      )}
    </button>
  );
}

/** Wraps a List row's whole floating action cluster (badge + buttons) so
 *  advancing to a new trial/instance/step reads as one continuous relay
 *  instead of the numbers and button states just snapping to their new
 *  values in place: the old cluster slides up and out while the new one
 *  slides in from below, keyed by whatever identifies "which one" (trial
 *  index, instance index, step index). Deliberately NOT forced to
 *  position: absolute here — with mode="popLayout", Motion already pulls
 *  only the EXITING copy out of flow on its own, leaving the entering one
 *  in normal flow so its content still sizes this wrapper's (and the
 *  floating parent's) width; forcing both to absolute collapsed that
 *  width to 0, since neither copy was left to size anything.
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
