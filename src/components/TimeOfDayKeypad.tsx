import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Delete, Check, X } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface TimeOfDayKeypadProps {
  /** Current committed value as 24h "HH:MM". */
  value: string;
  /** Called when user commits. Receives 24h "HH:MM". */
  onChange: (next: string) => void;
  children: (state: { isEditing: boolean; open: () => void }) => React.ReactNode;
}

const MAX_DIGITS = 4;
const BUSINESS_START = 8;  // 8 AM
const BUSINESS_END = 18;   // 6 PM

function from24h(value: string): { hour12: number; minute: number; isPM: boolean } {
  const [hStr, mStr] = (value || "00:00").split(":");
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const isPM = h >= 12;
  const hour12 = ((h + 11) % 12) + 1;
  return { hour12, minute: m, isPM };
}

/** Choose AM or PM so the time falls within business hours. */
function autoPeriod(hh: number): boolean | null {
  if (hh <= 0 || hh > 12) return null;
  const amH = hh === 12 ? 0 : hh;
  const pmH = hh === 12 ? 12 : hh + 12;
  const amOk = amH >= BUSINESS_START && amH < BUSINESS_END;
  const pmOk = pmH >= BUSINESS_START && pmH < BUSINESS_END;
  if (pmOk && !amOk) return true;
  if (amOk && !pmOk) return false;
  return null;
}

export function TimeOfDayKeypad({ value, onChange, children }: TimeOfDayKeypadProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState("");
  const [isPM, setIsPM] = useState(false);
  const [userPeriodOverride, setUserPeriodOverride] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const init = from24h(value);
      setPending(
        String(init.hour12).padStart(2, "0") + String(init.minute).padStart(2, "0"),
      );
      setIsPM(init.isPM);
      setUserPeriodOverride(true); // honor existing value
      const id = window.setTimeout(() => hiddenInputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open, value]);

  const applyDigit = useCallback((digit: string) => {
    setPending((prev) => (prev + digit).slice(-MAX_DIGITS));
  }, []);

  const backspace = useCallback(() => setPending((p) => p.slice(0, -1)), []);
  const clear = useCallback(() => {
    setPending("");
    setUserPeriodOverride(false);
  }, []);

  // Raw entered digits, right-aligned in HHMM.
  const padded = pending.padStart(MAX_DIGITS, "0");
  const entered = pending.length;
  const hh = parseInt(padded.slice(0, 2), 10) || 0;
  const mm = parseInt(padded.slice(2, 4), 10) || 0;
  const valid = entered > 0 && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;

  // Hour > 12 = explicit military time → forces PM on commit.
  const forcedPM = hh > 12 && hh <= 23;

  // Auto-pick period so the time lands within business hours (unless user overrode).
  useEffect(() => {
    if (userPeriodOverride) return;
    if (entered === 0) return;
    if (forcedPM) {
      setIsPM(true);
      return;
    }
    const auto = autoPeriod(hh);
    if (auto !== null) setIsPM(auto);
  }, [hh, forcedPM, entered, userPeriodOverride]);

  const pickPeriod = (pm: boolean) => {
    setIsPM(pm);
    setUserPeriodOverride(true);
  };

  const commit = () => {
    if (!valid) return;
    let outH: number;
    let outM = mm;
    if (forcedPM) {
      outH = hh; // already 13-23
    } else {
      const h12 = hh === 0 ? 12 : hh;
      outH = h12 % 12;
      if (isPM) outH += 12;
    }
    const result = `${String(outH).padStart(2, "0")}:${String(outM).padStart(2, "0")}`;
    onChange(result);
    setOpen(false);
  };

  // Digit nodes (right-aligned, faded slots).
  const charNodes: React.ReactNode[] = [];
  for (let i = 0; i < MAX_DIGITS; i++) {
    if (i === 2) {
      charNodes.push(
        <span key="sep" className="text-muted-foreground/40">:</span>,
      );
    }
    const isReal = i >= MAX_DIGITS - entered;
    charNodes.push(
      <span
        key={`d-${i}`}
        className={isReal ? "text-blue-600" : "text-muted-foreground/40"}
      >
        {padded[i]}
      </span>,
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <span>{children({ isEditing: open, open: () => setOpen(true) })}</span>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        sideOffset={8}
        align="center"
        className="w-auto border-none bg-transparent p-0 shadow-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="relative w-[210px] rounded-2xl border-2 border-blue-400/80 bg-card p-2.5 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]">
          <input
            ref={hiddenInputRef}
            type="text"
            inputMode="numeric"
            value=""
            onChange={(e) => {
              const chars = e.target.value.replace(/\D/g, "");
              for (const ch of chars) applyDigit(ch);
              e.target.value = "";
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace") { e.preventDefault(); backspace(); }
              else if (e.key === "Enter") { e.preventDefault(); commit(); }
              else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
            }}
            className="absolute size-px opacity-0 pointer-events-none -z-10"
            aria-hidden="true"
            tabIndex={-1}
          />

          {/* Display row: digits + stacked AM/PM */}
          <div className="mb-2 flex h-10 items-stretch overflow-hidden rounded-lg border border-stone-200 bg-muted/60 pl-3 pr-1.5">
            <div className="flex flex-1 items-center justify-end">
              <span className="font-display text-2xl leading-none tabular-nums">
                {charNodes}
              </span>
            </div>
            <div className="ml-1.5 flex flex-col justify-center gap-0.5 py-0.5">
              <button
                type="button"
                onClick={() => pickPeriod(false)}
                className={cn(
                  "text-[10px] leading-none font-bold px-1.5 py-0.5 rounded transition-colors",
                  !isPM
                    ? "bg-blue-500 text-white"
                    : "text-stone-400 hover:text-stone-600",
                )}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => pickPeriod(true)}
                className={cn(
                  "text-[10px] leading-none font-bold px-1.5 py-0.5 rounded transition-colors",
                  isPM
                    ? "bg-blue-500 text-white"
                    : "text-stone-400 hover:text-stone-600",
                )}
              >
                PM
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {["1","2","3","4","5","6","7","8","9"].map((d) => (
              <KeyButton key={d} onClick={() => applyDigit(d)}>{d}</KeyButton>
            ))}
            <KeyButton onClick={clear} variant="muted">C</KeyButton>
            <KeyButton onClick={() => applyDigit("0")}>0</KeyButton>
            <KeyButton onClick={backspace} variant="muted">
              <Delete className="size-4" />
            </KeyButton>
          </div>

          <div className="mt-2 flex items-center justify-between gap-1.5">
            <motion.button
              type="button"
              onClick={() => setOpen(false)}
              whileTap={{ scale: 0.92 }}
              className="grid size-8 place-items-center rounded-full border border-stone-200 text-muted-foreground transition-colors hover:bg-stone-100 hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </motion.button>
            <motion.button
              type="button"
              onClick={commit}
              disabled={!valid}
              whileTap={valid ? { scale: 0.92 } : undefined}
              aria-label="Set time"
              className={cn(
                "grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none",
                "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700",
              )}
            >
              <Check className="size-4" strokeWidth={3} />
            </motion.button>
          </div>

          <div className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r-2 border-b-2 border-blue-400/80 bg-card" />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function KeyButton({
  children, onClick, variant = "default",
}: { children: React.ReactNode; onClick: () => void; variant?: "default" | "muted" }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={cn(
        "h-9 select-none rounded-lg border text-lg font-semibold font-display transition-colors",
        variant === "default"
          ? "bg-stone-100 text-foreground border-stone-200 hover:bg-stone-200 active:bg-stone-300"
          : "bg-muted/70 text-muted-foreground border-stone-200 hover:bg-muted active:bg-stone-200",
      )}
    >
      <span className="flex items-center justify-center">{children}</span>
    </motion.button>
  );
}

export function formatTimeOfDay(value: string): string {
  const { hour12, minute, isPM } = from24h(value);
  return `${hour12}:${String(minute).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;
}
