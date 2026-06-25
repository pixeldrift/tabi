import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Minus, Plus, Delete, Check } from "lucide-react";
import { CardShell } from "./CardShell";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [keypadValue, setKeypadValue] = useState("");
  const keypadRef = useRef<HTMLDivElement>(null);

  const progress = Math.min(100, Math.round((count / Math.max(minCount, 1)) * 100));
  const isComplete = count >= minCount;
  const remaining = Math.max(0, minCount - count);

  const inc = () => {
    setCount((c) => c + 1);
    setBumpKey((k) => k + 1);
  };
  const dec = () => setCount((c) => Math.max(0, c - 1));

  const openKeypad = () => {
    setKeypadValue(String(count));
    setKeypadOpen(true);
  };

  const confirmKeypad = useCallback(() => {
    const val = parseInt(keypadValue, 10);
    if (!isNaN(val) && val >= 0) {
      setCount(val);
      setBumpKey((k) => k + 1);
    }
    setKeypadOpen(false);
  }, [keypadValue]);

  const handleKeypadDigit = useCallback((digit: string) => {
    setKeypadValue((prev) => {
      if (prev === "0") return digit;
      const next = prev + digit;
      if (next.length > 6) return prev;
      return next;
    });
  }, []);

  const handleKeypadBackspace = useCallback(() => {
    setKeypadValue((prev) => {
      if (prev.length <= 1) return "0";
      return prev.slice(0, -1);
    });
  }, []);

  const handleKeypadClear = useCallback(() => {
    setKeypadValue("0");
  }, []);

  // Keyboard support for desktop
  useEffect(() => {
    if (!keypadOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleKeypadDigit(e.key);
      } else if (e.key === "Backspace") {
        handleKeypadBackspace();
      } else if (e.key === "Escape") {
        setKeypadOpen(false);
      } else if (e.key === "Enter") {
        confirmKeypad();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keypadOpen, handleKeypadDigit, handleKeypadBackspace, confirmKeypad]);

  // Auto-focus hidden input for mobile keyboard
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (keypadOpen && hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [keypadOpen]);

  return (
    <>
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

      <Dialog open={keypadOpen} onOpenChange={setKeypadOpen}>
        <DialogContent className="sm:max-w-[320px] p-0 gap-0 overflow-hidden border-0 shadow-2xl">
          <DialogTitle className="sr-only">Enter count</DialogTitle>

          {/* Hidden input for native mobile keyboard fallback */}
          <input
            ref={hiddenInputRef}
            type="number"
            inputMode="numeric"
            className="absolute opacity-0 pointer-events-none"
            value={keypadValue}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "");
              setKeypadValue(val === "" ? "0" : val.slice(0, 6));
            }}
          />

          {/* Display */}
          <div className="bg-muted px-4 py-5 text-right">
            <span className="font-display text-4xl tabular-nums text-foreground">
              {keypadValue}
            </span>
          </div>

          {/* Keypad grid */}
          <div ref={keypadRef} className="p-3 bg-background">
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                <KeyButton key={digit} onClick={() => handleKeypadDigit(digit)}>
                  {digit}
                </KeyButton>
              ))}
              <KeyButton onClick={handleKeypadClear} variant="secondary">
                C
              </KeyButton>
              <KeyButton onClick={() => handleKeypadDigit("0")}>
                0
              </KeyButton>
              <KeyButton onClick={handleKeypadBackspace} variant="secondary">
                <Delete className="size-5" />
              </KeyButton>
            </div>
            <button
              onClick={confirmKeypad}
              className="mt-2 w-full h-12 rounded-lg bg-blue-500 text-white font-semibold text-lg hover:bg-blue-600 active:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Check className="size-5" /> Done
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
        "h-14 rounded-lg text-xl font-semibold transition-colors select-none",
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
