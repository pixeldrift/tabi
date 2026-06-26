import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Delete, Plus, Check, X } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface NumberKeypadProps {
  /** Current committed value shown on the card. */
  value: number;
  /** Called when user commits via "Update Total". */
  onReplace: (next: number) => void;
  /** Called when user commits via "Add to Total". */
  onAdd: (delta: number) => void;
  /** Maximum digits allowed in the pending entry. */
  maxDigits?: number;
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
  children,
}: NumberKeypadProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState("");
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const openKeypad = useCallback(() => {
    setPending("");
    setOpen(true);
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) setPending("");
    setOpen(next);
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
    setOpen(false);
  };
  const commitAdd = () => {
    if (!hasPending) return;
    onAdd(pendingNum);
    setOpen(false);
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
        <span>{children({ isEditing: open, open: openKeypad })}</span>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        sideOffset={12}
        align="center"
        className="w-auto p-0 rounded-2xl border-2 border-blue-400/80 bg-card text-card-foreground shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <PopoverPrimitive.Arrow
          width={16}
          height={8}
          className="fill-card"
        />
        {/* Render arrow border with a stacked path workaround: shadow on the arrow */}

        <div className="w-[268px] p-3">
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
          <div className="rounded-lg bg-muted/60 border border-stone-200 px-4 py-3 mb-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Entry</span>
              <span>Current: {value}</span>
            </div>
            <div className="h-12 flex items-center justify-end overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={pending || "empty"}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -12, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  className={cn(
                    "font-display text-4xl leading-none tabular-nums",
                    hasPending ? "text-blue-600" : "text-muted-foreground/40",
                  )}
                >
                  {hasPending ? pending : "0"}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2">
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
              <Delete className="size-5" />
            </KeyButton>
          </div>

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="h-10 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <X className="size-4" /> Close
            </button>
            <div className="ml-auto flex items-center gap-2">
              <ActionButton
                onClick={commitAdd}
                disabled={!hasPending}
                tone="outline"
                icon={<Plus className="size-4" strokeWidth={3} />}
                label="Add to Total"
              />
              <ActionButton
                onClick={commitReplace}
                disabled={!hasPending}
                tone="solid"
                icon={<Check className="size-4" strokeWidth={3} />}
                label="Update Total"
              />
            </div>
          </div>
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
        "h-12 rounded-lg text-xl font-semibold font-display select-none transition-colors border",
        variant === "default"
          ? "bg-background text-foreground border-stone-200 hover:bg-stone-50 active:bg-stone-100"
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
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  tone: "solid" | "outline";
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      className={cn(
        "h-10 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:pointer-events-none",
        tone === "solid"
          ? "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700"
          : "border-2 border-blue-500 text-blue-600 hover:bg-blue-50 active:bg-blue-100",
      )}
    >
      {icon} {label}
    </motion.button>
  );
}
