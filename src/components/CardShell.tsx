import { type ReactNode } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DetailsIcon } from "./icons/DetailsIcon";
import { TimeChevronIcon } from "./icons/TimeChevronIcon";
import { cn } from "@/lib/utils";

export interface CardShellProps {
  title: string;
  phase?: string;
  dataType?: string;
  /** Small outline icon shown to the left of the dataType label. */
  dataTypeIcon?: ReactNode;
  description?: string;
  isActive?: boolean;
  onActivate?: () => void;
  /** 0–100 progress. Pass null/undefined to hide the progress bar entirely. */
  progress?: number | null;
  isComplete?: boolean;
  helperText?: ReactNode;
  details?: ReactNode;
  editing?: boolean;
  /**
   * When both are provided, a twirl-down caret appears before the title
   * (same resting-right / rotate-on-open chevron as the Select dropdowns).
   * `children` is the standard view; `expandedView` swaps in when expanded,
   * with the standard view's height collapsing away entirely rather than
   * the two stacking.
   */
  expanded?: boolean;
  onToggleExpanded?: () => void;
  expandedView?: ReactNode;
  children: ReactNode;
}

export function CardShell({
  title,
  phase = "Intervention",
  dataType,
  dataTypeIcon,
  description,
  isActive = true,
  onActivate,
  progress,
  isComplete = false,
  helperText,
  details,
  editing = false,
  expanded = false,
  onToggleExpanded,
  expandedView,
  children,
}: CardShellProps) {
  const hasExpandedView = Boolean(onToggleExpanded && expandedView);
  const showProgress = typeof progress === "number";
  const pct = showProgress ? Math.min(100, Math.max(0, progress!)) : 0;
  const barBg = isComplete
    ? "bg-green-500/30"
    : pct >= 50
      ? "bg-yellow-400/30"
      : "bg-blue-400/30";

  return (
    <article
      onClick={onActivate}
      className={cn(
        "relative w-full max-w-md rounded-xl overflow-hidden bg-card text-card-foreground border-2 transition-all duration-200",
        isActive
          ? editing
            ? "border-stone-200 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
            : "border-blue-400/80 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
          : "border-stone-200 opacity-80 hover:opacity-95",
      )}
    >
      <header className="flex items-start gap-1 pl-5 pr-9 pt-2 pb-0">
        {hasExpandedView && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded?.();
            }}
            aria-expanded={expanded}
            aria-label={expanded ? "Show standard view" : "Show all"}
            className="-ml-1.5 mt-0.5 shrink-0 grid place-items-center rounded-md p-0.5 text-blue-500 transition-colors hover:bg-blue-50 hover:text-blue-600"
          >
            <TimeChevronIcon
              className={cn(
                "size-4 transition-transform duration-200",
                expanded && "translate-y-0.5 rotate-90",
              )}
            />
          </button>
        )}
        <h2 className="font-display text-base leading-[1.05] flex-1 mr-auto mt-0.5">{title}</h2>
        <div className="text-right leading-tight mt-0.5">
          <div className="text-xs font-medium italic text-muted-foreground">{phase}</div>
          {dataType && (
            <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
              {dataTypeIcon && (
                <span className="shrink-0 [&>svg]:size-3">{dataTypeIcon}</span>
              )}
              <span>{dataType}</span>
            </div>
          )}
        </div>
      </header>

      {/* Universal header/body divider — present in every card and both
          the standard and expanded views, not just faded in while expanded. */}
      <div className="mx-[18px] mt-2.5 border-t border-dashed border-stone-200" />

      {/* Positioned so the circle's center sits at the card's own corner-radius
          center (rounded-xl = 20px), rather than in the header's flex flow. */}
      <Sheet>
        <SheetTrigger asChild>
          <button
            aria-label="Card details"
            className="absolute top-2 right-2 grid size-6 place-items-center rounded-full border border-current text-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <DetailsIcon className="size-4" strokeWidth={1.5} />
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[88%] sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display">{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          {details && <div className="mt-6 px-4 text-sm">{details}</div>}
        </SheetContent>
      </Sheet>

      {hasExpandedView ? (
        <>
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-out",
              expanded ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
            )}
          >
            <div className="overflow-hidden">{children}</div>
          </div>
          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-out",
              expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="overflow-hidden">{expandedView}</div>
          </div>
        </>
      ) : (
        children
      )}

      {showProgress && (
        <div className="relative mt-3">
          <div className="relative h-5">
            <div className="absolute inset-0 bg-stone-200">
              <motion.div
                className={cn("absolute inset-y-0 left-0", barBg)}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 180, damping: 26 }}
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center px-5 text-[11px] text-foreground/75 leading-none pointer-events-none">
              {helperText}
            </div>
          </div>
          {isComplete && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <Starburst />
            </div>
          )}
        </div>
      )}

    </article>
  );
}

function Starburst() {
  const rays = Array.from({ length: 8 });
  return (
    <span className="absolute inset-0 pointer-events-none">
      {rays.map((_, i) => {
        const angle = (i / rays.length) * Math.PI * 2;
        const x = Math.cos(angle) * 22;
        const y = Math.sin(angle) * 22;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{ x, y, opacity: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.1, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 -ml-1 -mt-1 size-2 rounded-full bg-yellow-300"
          />
        );
      })}
      <motion.span
        initial={{ scale: 0, opacity: 0.8 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ duration: 0.7 }}
        className="absolute inset-0 grid place-items-center text-yellow-400"
      >
        <Sparkles className="size-6" />
      </motion.span>
    </span>
  );
}
