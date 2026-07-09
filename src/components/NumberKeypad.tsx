import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Delete, Plus, Check, X } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useSlidingArrowOffset } from "@/hooks/useSlidingArrowOffset";
import { cn } from "@/lib/utils";

export interface NumberKeypadProps {
  /** Current committed value shown on the card. */
  value: number;
  /** Called when user commits via "Update". */
  onReplace: (next: number) => void;
  /** Called when user commits via "Add". */
  onAdd: (delta: number) => void;
  /** Maximum digits allowed in the pending entry. */
  maxDigits?: number;
  /** Optional callback when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Renders the trigger (the on-card number). Receives editing state. */
  children: (state: {
    isEditing: boolean;
    open: () => void;
  }) => React.ReactNode;
}

export function NumberKeypad({
  value,
  onReplace,
  onAdd,
  maxDigits = 6,
  onOpenChange,
  children,
}: NumberKeypadProps) {
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

  const applyDigit = useCallback(
    (digit: string) => {
      setPending((prev) => {
        const next = (prev + digit).replace(/^0+(?=\d)/, "");
        return next.slice(0, maxDigits);
      });
    },
    [maxDigits],
  );

  const backspace = useCallback(() => {
    setPending((prev) => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => setPending(""), []);

  const pendingNum = pending === "" ? 0 : parseInt(pending, 10);
  const hasPending = pending !== "";

  const commitReplace = () => {
    if (!hasPending) return;
    onReplace(pendingNum);
    setOpenWithCallback(false);
  };
  const commitAdd = () => {
    if (!hasPending) return;
    onAdd(pendingNum);
    setOpenWithCallback(false);
  };

  // Focus hidden input on open so the mobile keyboard appears.
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => hiddenInputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        {/* flex + h-full — see TimeKeypad's identical comment: keeps this
            trigger filling the anchor span's full height instead of sitting
            top-aligned inside it whenever a parent stretches the span. */}
        <span ref={anchorRef} className="flex h-full">{children({ isEditing: open, open: openKeypad })}</span>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        sideOffset={8}
        align="center"
        // z-[70]: matches DataToolbar's filter popover — otherwise this sits
        // at the base popover z-50, which the sticky toolbar (z-[60]) and
        // details drawer (z-[62]) both paint over once the trigger scrolls
        // near them.
        className="group z-[70] w-auto border-none bg-transparent p-0 shadow-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div ref={contentRef} className="relative w-[200px] rounded-2xl border-2 border-blue-400/80 bg-card p-2.5 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]">
          {/* Hidden input — catches native + physical keyboard */}
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
            className="absolute size-px opacity-0 pointer-events-none -z-10"
            aria-hidden="true"
            tabIndex={-1}
          />

          {/* Display */}
          <div className="mb-2 flex h-8 items-end justify-end overflow-hidden rounded-lg border border-stone-200 bg-muted/60 px-3 py-1">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={pending || "empty"}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                className={cn(
                  "font-display text-2xl leading-none tabular-nums",
                  hasPending ? "text-blue-600" : "text-muted-foreground/40",
                )}
              >
                {hasPending ? pending : "0"}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Keypad */}
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

          {/* Actions */}
          <div className="mt-2 flex items-center justify-between gap-1.5">
            <motion.button
              type="button"
              onClick={() => handleOpenChange(false)}
              whileTap={{ scale: 0.92 }}
              className="btn-bevel grid size-8 place-items-center rounded-full border border-stone-200 text-muted-foreground transition-colors hover:bg-stone-100 hover:text-foreground"
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
                aria-label="Add to total"
              />
              <ActionButton
                onClick={commitReplace}
                disabled={!hasPending}
                tone="solid"
                icon={<Check className="size-4" strokeWidth={3} />}
                aria-label="Update total"
              />
            </div>
          </div>

          {/* Arrow — part of the bordered card shape. Its left offset
              tracks the trigger's real position (see useSlidingArrowOffset)
              rather than staying hard-centered, since Radix's own collision
              avoidance can shift the popup sideways to stay on screen when
              the trigger sits near a viewport edge — a fixed center would
              then no longer line up with the element it's pointing at. */}
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
          ? "bg-stone-100 text-foreground border-stone-200 hover:bg-stone-200 active:bg-stone-300"
          : "bg-muted/70 text-muted-foreground border-stone-200 hover:bg-muted active:bg-stone-200",
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
          : "btn-bevel border-2 border-blue-500 text-blue-600 hover:bg-blue-50 active:bg-blue-100",
      )}
    >
      {icon}
    </motion.button>
  );
}
