import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Delete, Plus, Check, X } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useSlidingArrowOffset } from "@/hooks/useSlidingArrowOffset";
import { cn } from "@/lib/utils";

export interface TimeKeypadProps {
  /** Current committed value, in milliseconds. */
  valueMs: number;
  /** Called when user commits via "Update". Receives new value in ms. */
  onReplace: (nextMs: number) => void;
  /** Called when user commits via "Add". Receives delta in ms. */
  onAdd: (deltaMs: number) => void;
  /** Optional callback when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Renders the trigger. */
  children: (state: { isEditing: boolean; open: () => void }) => React.ReactNode;
}

const MAX_DIGITS = 6;
const UNIT_HINTS = ["hh", "mm", "ss"];

function pendingToMs(pending: string) {
  const padded = pending.padStart(MAX_DIGITS, "0");
  const h = parseInt(padded.slice(0, 2), 10);
  const m = parseInt(padded.slice(2, 4), 10);
  const s = parseInt(padded.slice(4, 6), 10);
  return (h * 3600 + m * 60 + s) * 1000;
}

export function TimeKeypad({ valueMs, onReplace, onAdd, onOpenChange, children }: TimeKeypadProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState("");
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const arrowLeft = useSlidingArrowOffset(open, anchorRef, contentRef);

  const setOpenWithCallback = useCallback(
    (next: boolean) => {
      if (!next) setPending("");
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const openKeypad = useCallback(() => {
    setPending("");
    setOpenWithCallback(true);
  }, [setOpenWithCallback]);

  const handleOpenChange = (next: boolean) => {
    setOpenWithCallback(next);
  };

  const applyDigit = useCallback((digit: string) => {
    setPending((prev) => (prev + digit).slice(-MAX_DIGITS));
  }, []);

  const backspace = useCallback(() => {
    setPending((prev) => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => setPending(""), []);

  const hasPending = pending !== "";
  const pendingMs = pendingToMs(pending);

  const commitReplace = () => {
    if (!hasPending) return;
    onReplace(pendingMs);
    setOpenWithCallback(false);
  };
  const commitAdd = () => {
    if (!hasPending) return;
    onAdd(pendingMs);
    setOpenWithCallback(false);
  };

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => hiddenInputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // Render the HH:MM:SS display with dimmed placeholders for unentered
  // digits, plus a small "hh mm ss" unit hint centered under each digit
  // pair — a plain, always-numeric display (never letters swapped into the
  // digit slots themselves, which let "mm" overflow its slot and clash with
  // its neighbors).
  const padded = pending.padStart(MAX_DIGITS, "0");
  const entered = pending.length;
  const unitNodes: React.ReactNode[] = [];
  for (let u = 0; u < 3; u++) {
    if (u > 0) {
      unitNodes.push(
        <span key={`sep-${u}`} className="self-start text-muted-foreground/40">
          :
        </span>,
      );
    }
    const i0 = u * 2;
    const i1 = u * 2 + 1;
    unitNodes.push(
      <span key={`unit-${u}`} className="flex flex-col items-center">
        <span className="flex">
          <span
            className={i0 >= MAX_DIGITS - entered ? "text-blue-600" : "text-muted-foreground/40"}
          >
            {padded[i0]}
          </span>
          <span
            className={i1 >= MAX_DIGITS - entered ? "text-blue-600" : "text-muted-foreground/40"}
          >
            {padded[i1]}
          </span>
        </span>
        <span className="mt-0.5 text-[8px] font-medium leading-none tracking-wide text-muted-foreground/50">
          {UNIT_HINTS[u]}
        </span>
      </span>,
    );
  }

  void valueMs; // currently unused; reserved for future "edit current" mode

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        {/* flex + h-full: an unstyled inline span stretched by a parent's
            `items-stretch` (as the grid/list timer pills do, to make this
            trigger fill the pill's full height) only grows the SPAN itself —
            its own child (the button) still sizes to its own content and
            sits top-aligned inside that taller box, since a plain block
            doesn't stretch its children. Making the span itself a flex
            container lets the button stretch (or center) to match. */}
        <span ref={anchorRef} className="flex h-full">
          {children({ isEditing: open, open: openKeypad })}
        </span>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        sideOffset={8}
        align="center"
        // z-[70]: same reasoning as NumberKeypad's identical comment.
        className="group z-[70] w-auto border-none bg-transparent p-0 shadow-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div
          ref={contentRef}
          className="relative w-[220px] rounded-2xl border-2 border-blue-400/80 bg-card p-2.5 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
        >
          <input
            ref={hiddenInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value=""
            onChange={(e) => {
              const chars = e.target.value.replace(/\D/g, "");
              for (const ch of chars) applyDigit(ch);
              e.target.value = "";
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace") {
                e.preventDefault();
                backspace();
              } else if (e.key === "Enter") {
                e.preventDefault();
                commitReplace();
              } else if (e.key === "Escape") {
                e.preventDefault();
                handleOpenChange(false);
              }
            }}
            // text-base (16px): see NumberKeypad's identical hidden input —
            // iOS zooms in on focus of any sub-16px input and back out on
            // blur, which is what read as "viewport scales down" on session
            // end (this popover's own hidden input closing/blurring then).
            className="absolute size-px text-base opacity-0 pointer-events-none -z-10"
            aria-hidden="true"
            tabIndex={-1}
          />

          {/* Same blue-bordered, inner-shadowed well as standard text entry
              fields (see ui/input.tsx) — matches NumberKeypad's own display. */}
          <div className="mb-2 flex items-center justify-center overflow-hidden rounded-lg border-2 border-blue-400/80 bg-white px-3 py-1.5 shadow-[inset_0_2px_5px_rgba(0,0,0,0.22)]">
            <span className="flex items-start font-display text-2xl leading-none tabular-nums">
              {unitNodes}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <KeyButton key={d} onClick={() => applyDigit(d)}>
                {d}
              </KeyButton>
            ))}
            <KeyButton onClick={clear} variant="muted">
              C
            </KeyButton>
            <KeyButton onClick={() => applyDigit("0")}>0</KeyButton>
            <KeyButton onClick={backspace} variant="muted">
              <Delete className="size-4" />
            </KeyButton>
          </div>

          <div className="mt-2 flex items-center justify-between gap-1.5">
            <motion.button
              type="button"
              onClick={() => handleOpenChange(false)}
              whileTap={{ scale: 0.92 }}
              className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-stone-100 hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </motion.button>
            <div className="flex items-center gap-1.5">
              <ActionButton
                onClick={commitAdd}
                disabled={!hasPending}
                tone="outline"
                icon={<Plus className="size-4" strokeWidth={3} />}
                aria-label="Add to elapsed"
              />
              <ActionButton
                onClick={commitReplace}
                disabled={!hasPending}
                tone="solid"
                icon={<Check className="size-4" strokeWidth={3} />}
                aria-label="Update elapsed"
              />
            </div>
          </div>

          {/* Arrow's left offset tracks the trigger's real position (see
              useSlidingArrowOffset) rather than staying hard-centered — see
              NumberKeypad's identical comment for why. */}
          <div
            className={cn(
              "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-blue-400/80 bg-card",
              // Default (side="top"): popup is above the trigger, so the arrow
              // sits on the bottom edge and points down at it.
              "-bottom-[7px] border-r-2 border-b-2",
              // When Radix flips to side="bottom" (not enough room above),
              // the popup renders below the trigger, so the arrow needs to
              // move to the top edge and point up at it instead.
              "group-data-[side=bottom]:bottom-auto group-data-[side=bottom]:-top-[7px]",
              "group-data-[side=bottom]:border-r-0 group-data-[side=bottom]:border-b-0",
              "group-data-[side=bottom]:border-l-2 group-data-[side=bottom]:border-t-2",
            )}
            style={{ left: arrowLeft ?? "50%" }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function KeyButton({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "muted";
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={cn(
        "btn-bevel h-9 select-none rounded-lg border text-lg font-semibold font-display transition-colors",
        variant === "default"
          ? "bg-stone-100 text-foreground border-border hover:bg-stone-200 active:bg-stone-300"
          : "bg-muted/70 text-muted-foreground border-border hover:bg-muted active:bg-stone-200",
      )}
    >
      <span className="flex items-center justify-center">{children}</span>
    </motion.button>
  );
}

function ActionButton({
  onClick,
  disabled,
  tone,
  icon,
  "aria-label": ariaLabel,
}: {
  onClick: () => void;
  disabled?: boolean;
  tone: "solid" | "outline";
  icon: React.ReactNode;
  "aria-label": string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      aria-label={ariaLabel}
      className={cn(
        "grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none",
        tone === "solid"
          ? "btn-bevel bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700"
          : "border-2 border-blue-500 text-blue-600 hover:bg-blue-50 active:bg-blue-100",
      )}
    >
      {icon}
    </motion.button>
  );
}
