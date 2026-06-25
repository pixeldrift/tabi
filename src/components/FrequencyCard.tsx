import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Minus, Plus, Delete, Check } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CardShell } from "./CardShell";
import { cn } from "@/lib/utils";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

export interface FrequencyCardProps {
  title: string;
  phase?: string;
  description?: string;
  minCount?: number;
  isActive?: boolean;
  onActivate?: () => void;
}

export function FrequencyCard({
  title,
  phase = "Intervention",
  description,
  minCount = 5,
  isActive = true,
  onActivate,
}: FrequencyCardProps) {
  const [count, setCount] = useState(0);
  const [bumpKey, setBumpKey] = useState(0);
  const [keypadOpen, setKeypadOpen] = useState(false);

  // Track edit session
  const originalCountRef = useRef(0);
  const freshOpenRef = useRef(true);
  const committedRef = useRef(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const isComplete = count >= minCount;
  const remaining = Math.max(0, minCount - count);

  const inc = () => {
    setCount((c) => c + 1);
    setBumpKey((k) => k + 1);
  };
  const dec = () => setCount((c) => Math.max(0, c - 1));

  const openKeypad = () => {
    originalCountRef.current = count;
    freshOpenRef.current = true;
    committedRef.current = false;
    setKeypadOpen(true);
  };

  const applyDigit = useCallback((digit: string) => {
    setCount((prev) => {
      const base = freshOpenRef.current ? "" : String(prev);
      freshOpenRef.current = false;
      const next = (base + digit).replace(/^0+(?=\d)/, "");
      const num = parseInt(next.slice(0, 6), 10);
      return isNaN(num) ? 0 : num;
    });
    setBumpKey((k) => k + 1);
  }, []);

  const backspace = useCallback(() => {
    setCount((prev) => {
      freshOpenRef.current = false;
      const s = String(prev);
      if (s.length <= 1) return 0;
      return parseInt(s.slice(0, -1), 10) || 0;
    });
  }, []);

  const clear = useCallback(() => {
    freshOpenRef.current = false;
    setCount(0);
  }, []);

  const commit = useCallback(() => {
    committedRef.current = true;
    setKeypadOpen(false);
  }, []);

  // Revert when popover closes without commit
  const handleOpenChange = (open: boolean) => {
    if (!open && !committedRef.current) {
      setCount(originalCountRef.current);
    }
    setKeypadOpen(open);
  };

  // Focus hidden input on open so the native keyboard can pop on mobile
  useEffect(() => {
    if (keypadOpen) {
      const id = window.setTimeout(() => hiddenInputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [keypadOpen]);

  return (
    <CardShell
      title={title}
      phase={phase}
      dataType="Frequency"
      description={description}
      isActive={isActive}
      onActivate={onActivate}
      progress={null}
      isComplete={isComplete}
      helperText={
        isComplete ? (
          "Minimum count reached. This data can now be graphed."
        ) : (
          <span>
            Record at least <strong className="font-semibold">{remaining} more</strong>{" "}
            {remaining === 1 ? "occurrence" : "occurrences"}.
          </span>
        )
      }
      details={
        <dl className="space-y-3">
          <Row label="Phase" value={phase} />
          <Row label="Data type" value="Frequency (count)" />
          <Row label="Minimum count" value={String(minCount)} />
          <Row label="Recorded so far" value={String(count)} />
        </dl>
      }
    >
      <div className="px-5 pt-2 pb-4 flex items-center justify-between gap-3">
        <button
          onClick={dec}
          disabled={count === 0}
          aria-label="Decrement"
          className="size-12 rounded-full grid place-items-center border border-stone-200 bg-white text-foreground/70 hover:bg-stone-50 active:scale-95 transition disabled:opacity-30"
        >
          <Minus className="size-5" strokeWidth={2.5} />
        </button>

        <Popover open={keypadOpen} onOpenChange={handleOpenChange}>
          <PopoverAnchor asChild>
            <button
              onClick={openKeypad}
              className="flex flex-col items-center justify-center min-w-[6rem] cursor-text"
              aria-label={`Current count is ${count}. Tap to edit.`}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={bumpKey}
                  initial={{ scale: 0.7, opacity: 0, y: 8 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 360, damping: 22 }}
                  className="font-display text-5xl leading-none tabular-nums"
                >
                  {count}
                </motion.span>
              </AnimatePresence>
              <span className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                occurrences
              </span>
            </button>
          </PopoverAnchor>

          <PopoverContent
            side="top"
            sideOffset={10}
            align="center"
            className="w-auto p-3 rounded-xl border border-stone-200 bg-background shadow-xl"
            onOpenAutoFocus={(e) => {
              // Let our hidden input take focus instead of Radix default
              e.preventDefault();
            }}
          >
            <PopoverPrimitive.Arrow
              width={14}
              height={7}
              className="fill-background drop-shadow-[0_1px_0_rgba(0,0,0,0.08)]"
            />

            {/* Hidden input: catches native mobile keyboard + physical keyboard */}
            <input
              ref={hiddenInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value=""
              onChange={(e) => {
                // Each native keystroke arrives here; replay through applyDigit
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
                  commit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  handleOpenChange(false);
                }
              }}
              className="absolute size-px opacity-0 pointer-events-none -z-10"
              aria-hidden="true"
              tabIndex={-1}
            />

            <div className="grid grid-cols-3 gap-2 w-[228px]">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <KeyButton key={digit} onClick={() => applyDigit(digit)}>
                  {digit}
                </KeyButton>
              ))}
              <KeyButton onClick={clear} variant="secondary">
                C
              </KeyButton>
              <KeyButton onClick={() => applyDigit("0")}>0</KeyButton>
              <KeyButton onClick={backspace} variant="secondary">
                <Delete className="size-5" />
              </KeyButton>
            </div>
            <button
              onClick={commit}
              className="mt-2 w-full h-11 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 active:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Check className="size-4" /> Done
            </button>
          </PopoverContent>
        </Popover>

        <motion.button
          onClick={inc}
          whileTap={{ scale: 0.94 }}
          aria-label="Increment"
          className={cn(
            "size-16 rounded-full grid place-items-center text-white shadow-[0_4px_12px_rgba(59,130,246,0.35)] transition-colors",
            "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
          )}
        >
          <Plus className="size-7" strokeWidth={3} />
        </motion.button>
      </div>
    </CardShell>
  );
}

function KeyButton({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "secondary";
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={cn(
        "h-12 w-[68px] rounded-lg text-lg font-semibold transition-colors select-none",
        variant === "default"
          ? "bg-stone-100 text-foreground hover:bg-stone-200 active:bg-stone-300"
          : "bg-stone-200 text-foreground/80 hover:bg-stone-300 active:bg-stone-400",
      )}
    >
      {children}
    </motion.button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
