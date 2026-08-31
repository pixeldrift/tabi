import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Delete, Check, X, Plus } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSlidingArrowOffset } from "@/hooks/useSlidingArrowOffset";
import { useSettings } from "./SettingsContext";

export interface TimeOfDayKeypadProps {
  /** Current committed value as 24h "HH:MM" (or "HH:MM:SS" when
   *  `withSeconds` is set), or "" if unset. */
  value: string;
  /** Called when user commits. Receives 24h "HH:MM" ("HH:MM:SS" when
   *  `withSeconds` is set). */
  onChange: (next: string) => void;
  /** Renders a second, outline "+" commit button next to the usual solid
   *  one — same two-button footer TimeKeypad's own duration entry already
   *  has. The entered digits are read as a plain hh:mm(:ss) OFFSET (AM/PM
   *  ignored) and passed here in milliseconds, for a caller that wants
   *  "nudge this time forward by…" alongside "set it outright". Omit for
   *  callers with no meaningful "add" (most scheduled-time fields just
   *  replace), which keeps the single-button footer. */
  onAdd?: (deltaMs: number) => void;
  /** Fires whenever the keypad popover opens/closes — lets a parent that
   *  renders multiple time fields know which one is actively being edited. */
  onEditingChange?: (isEditing: boolean) => void;
  /** Adds a third "ss" digit pair for callers that need second-level
   *  precision (e.g. Timestamp's own logged entries) — everything else
   *  (appointments, checkpoints, schedule fields) leaves this unset and
   *  keeps the plain "HH:MM" entry, since a scheduled time never needs
   *  seconds. */
  withSeconds?: boolean;
  children: (state: { isEditing: boolean; open: () => void }) => React.ReactNode;
}

const BUSINESS_START = 8; // 8 AM
const BUSINESS_END = 18; // 6 PM

function from24h(value: string): { hour12: number; minute: number; isPM: boolean } {
  const [hStr, mStr] = (value || "00:00").split(":");
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const isPM = h >= 12;
  const hour12 = ((h + 11) % 12) + 1;
  return { hour12, minute: m, isPM };
}

/** Choose AM or PM so the time falls within business hours. */
function autoPeriod(hh: number, manualLeadingZero: boolean): boolean | null {
  if (hh <= 0 || hh > 12) return null;
  // A MANUALLY typed leading zero (the user's first keystroke was "0", e.g.
  // "0800") is explicit 24h notation — always AM, no business-hours
  // guessing. A single-digit hour reached without one (e.g. typing "8" then
  // "3" then "0" for "830") isn't explicit either way, so it falls through
  // to the same business-hours heuristic as 10/11/12 below.
  if (manualLeadingZero) return false;
  const amH = hh === 12 ? 0 : hh;
  const pmH = hh === 12 ? 12 : hh + 12;
  const amOk = amH >= BUSINESS_START && amH < BUSINESS_END;
  const pmOk = pmH >= BUSINESS_START && pmH < BUSINESS_END;
  if (pmOk && !amOk) return true;
  if (amOk && !pmOk) return false;
  return null;
}

export function TimeOfDayKeypad({
  value: _value,
  onChange,
  onAdd,
  onEditingChange,
  withSeconds = false,
  children,
}: TimeOfDayKeypadProps) {
  // The Settings 24-hour toggle — while on, entered digits are always read
  // as literal 24h notation (see commit's own use of this below) and the
  // AM/PM picker doesn't render at all, rather than guessing a period for a
  // value that was never ambiguous in the first place.
  const { use24HourTime } = useSettings();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState("");
  const [isPM, setIsPM] = useState(false);
  const [userPeriodOverride, setUserPeriodOverride] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const arrowLeft = useSlidingArrowOffset(open, anchorRef, contentRef);

  const maxDigits = withSeconds ? 6 : 4;
  const unitHints = withSeconds ? ["hh", "mm", "ss"] : ["hh", "mm"];

  useEffect(() => onEditingChange?.(open), [open, onEditingChange]);

  // Always start blank — do not prepopulate from existing value.
  useEffect(() => {
    if (open) {
      setPending("");
      setIsPM(false);
      setUserPeriodOverride(false);
      const id = window.setTimeout(() => hiddenInputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const applyDigit = useCallback(
    (digit: string) => {
      setPending((prev) => (prev + digit).slice(-maxDigits));
    },
    [maxDigits],
  );

  const backspace = useCallback(() => setPending((p) => p.slice(0, -1)), []);
  const clear = useCallback(() => {
    setPending("");
    setUserPeriodOverride(false);
  }, []);

  // Raw entered digits, right-aligned in HHMM (or HHMMSS).
  const padded = pending.padStart(maxDigits, "0");
  const entered = pending.length;
  // Any digit at all is enough to add an offset (e.g. "30" → 30s) — unlike
  // `valid` below, which the wall-clock "Set time" commit needs (a bare
  // "30" would be an ambiguous half-entered time, not a real hh:mm), a
  // typed offset is unambiguous at any length: it's always read the same
  // right-aligned way pendingToMs reads it. Same gate TimeKeypad's own
  // commitAdd uses (hasPending there) for exactly this reason.
  const hasPending = pending !== "";
  const hh = parseInt(padded.slice(0, 2), 10) || 0;
  const mm = parseInt(padded.slice(2, 4), 10) || 0;
  const ss = withSeconds ? parseInt(padded.slice(4, 6), 10) || 0 : 0;

  // A valid time requires at least one fewer digit than the full width
  // (e.g. 318 → 3:18, or 91530 → 9:15:30 with seconds) with hh ≤ 23,
  // mm ≤ 59, and (when present) ss ≤ 59.
  const valid = entered >= maxDigits - 1 && hh <= 23 && mm <= 59 && (!withSeconds || ss <= 59);

  // Period selection is only shown/active once a valid hour can be inferred
  // — and never while the 24-hour setting is on, since there's no AM/PM to
  // pick at all in that mode.
  const periodActive = !use24HourTime && entered >= maxDigits - 1;

  // Hour > 12 = explicit military time → forces PM on commit.
  const forcedPM = hh > 12 && hh <= 23;
  // The very first digit typed was "0" — an explicit 24h leading zero
  // (e.g. "0800"), not just a hour value that happens to be under 10.
  const manualLeadingZero = pending.length > 0 && pending[0] === "0";
  // Either signal means the digits are already the literal 24h time —
  // skip AM/PM guessing (and any override) entirely at commit.
  const forced24h = forcedPM || manualLeadingZero;

  // Re-evaluate AM/PM whenever the digit count crosses into 3 or 4 (or back down).
  useEffect(() => {
    if (!periodActive) return;
    if (userPeriodOverride) return;
    if (forcedPM) {
      setIsPM(true);
      return;
    }
    const auto = autoPeriod(hh, manualLeadingZero);
    if (auto !== null) setIsPM(auto);
  }, [hh, forcedPM, manualLeadingZero, periodActive, userPeriodOverride]);

  const pickPeriod = (pm: boolean) => {
    if (!periodActive) return;
    setIsPM(pm);
    setUserPeriodOverride(true);
  };

  const commit = () => {
    if (!valid) return;
    let outH: number;
    const outM = mm;
    if (forced24h || use24HourTime) {
      outH = hh;
    } else {
      const h12 = hh === 0 ? 12 : hh;
      outH = h12 % 12;
      if (isPM) outH += 12;
    }
    const result = withSeconds
      ? `${String(outH).padStart(2, "0")}:${String(outM).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
      : `${String(outH).padStart(2, "0")}:${String(outM).padStart(2, "0")}`;
    onChange(result);
    setOpen(false);
  };

  // Same digits, read as a plain elapsed offset instead of a wall-clock
  // time — no AM/PM involved, exactly TimeKeypad's own pendingToMs. Gated
  // on hasPending, not valid — see that constant's own comment.
  const commitAdd = () => {
    if (!hasPending || !onAdd) return;
    onAdd((hh * 3600 + mm * 60 + ss) * 1000);
    setOpen(false);
  };

  // Digit nodes: when empty, render a fully grayed "00:00" (or "00:00:00")
  // placeholder, plus a small "hh mm ss" unit hint centered under each digit
  // pair (see TimeKeypad's identical treatment for why — plain digits only,
  // never letters swapped into the digit slots themselves).
  const unitCount = withSeconds ? 3 : 2;
  const unitNodes: React.ReactNode[] = [];
  for (let u = 0; u < unitCount; u++) {
    if (u > 0) {
      unitNodes.push(
        <span key={`sep-${u}`} className="self-start text-muted-foreground/40">
          :
        </span>,
      );
    }
    const i0 = u * 2;
    const i1 = u * 2 + 1;
    const isReal0 = entered > 0 && i0 >= maxDigits - entered;
    const isReal1 = entered > 0 && i1 >= maxDigits - entered;
    unitNodes.push(
      <span key={`unit-${u}`} className="flex flex-col items-center">
        <span className="flex">
          <span className={isReal0 ? "text-blue-600" : "text-muted-foreground/40"}>
            {padded[i0]}
          </span>
          <span className={isReal1 ? "text-blue-600" : "text-muted-foreground/40"}>
            {padded[i1]}
          </span>
        </span>
        <span className="mt-0.5 text-[8px] font-medium leading-none tracking-wide text-muted-foreground/50">
          {unitHints[u]}
        </span>
      </span>,
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        {/* flex + h-full — see TimeKeypad/NumberKeypad's identical comment:
            an unstyled inline span otherwise computes its own line-box
            height from its ambient (inherited) font metrics rather than its
            actual button child's, baseline-aligning that child inside the
            gap — invisible most places, but visibly low once a parent
            (Timestamp's own grid-tile pill) centers this whole span within
            a fixed-height row via place-items-center, since the span's own
            padded-out height threw that centering off. A flex container
            sizes to its child's real content instead, and keeps this
            trigger filling the anchor span's full height whenever a parent
            stretches the span (items-stretch), matching those siblings. */}
        <span ref={anchorRef} className="flex h-full">
          {children({ isEditing: open, open: () => setOpen(true) })}
        </span>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        sideOffset={8}
        align="center"
        collisionPadding={8}
        // z-[110]: this popover is opened from Start/End time fields inside
        // Schedule's Add/Edit Activity and Add/Edit Appointment dialogs
        // (ui/dialog.tsx's DialogContent sits at z-[100]) as well as
        // standalone in Settings — without an explicit z-index here it fell
        // back to Radix Popover's base z-50, rendering completely hidden
        // behind the dialog whenever opened from inside one.
        className="group z-[110] w-auto border-none bg-transparent p-0 shadow-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div
          ref={contentRef}
          className={cn(
            "relative rounded-2xl border-2 border-blue-400/80 bg-card p-2.5 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]",
            withSeconds ? "w-[254px]" : "w-[210px]",
          )}
        >
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
              if (e.key === "Backspace") {
                e.preventDefault();
                backspace();
              } else if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
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

          {/* Display row: digits + stacked AM/PM — same blue-bordered,
              inner-shadowed well as standard text entry fields (see
              ui/input.tsx) rather than the old plain gray box. */}
          <div className="mb-2 flex items-stretch overflow-hidden rounded-lg border-2 border-blue-400/80 bg-white py-1.5 pl-3 pr-1.5 shadow-[inset_0_2px_5px_rgba(0,0,0,0.22)]">
            <div className="flex flex-1 flex-col items-end justify-center">
              <span
                className={cn(
                  "flex items-start font-display leading-none tabular-nums",
                  withSeconds ? "text-xl" : "text-2xl",
                )}
              >
                {unitNodes}
              </span>
            </div>
            {!use24HourTime && (
              <div
                className="ml-1.5 flex flex-col justify-center gap-0.5 py-0.5"
                data-tour="time-period-override"
              >
                <button
                  type="button"
                  onClick={() => pickPeriod(false)}
                  disabled={!periodActive}
                  className={cn(
                    "text-[10px] leading-none font-bold px-1.5 py-0.5 rounded transition-colors",
                    !periodActive
                      ? "text-stone-300 cursor-default"
                      : !isPM
                        ? "btn-bevel bg-blue-500 text-white"
                        : "text-stone-400 hover:text-stone-600",
                  )}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => pickPeriod(true)}
                  disabled={!periodActive}
                  className={cn(
                    "text-[10px] leading-none font-bold px-1.5 py-0.5 rounded transition-colors",
                    !periodActive
                      ? "text-stone-300 cursor-default"
                      : isPM
                        ? "btn-bevel bg-blue-500 text-white"
                        : "text-stone-400 hover:text-stone-600",
                  )}
                >
                  PM
                </button>
              </div>
            )}
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
              onClick={() => setOpen(false)}
              whileTap={{ scale: 0.92 }}
              className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-stone-100 hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </motion.button>
            <div className="flex items-center gap-1.5">
              {onAdd && (
                <ActionButton
                  onClick={commitAdd}
                  disabled={!hasPending}
                  tone="outline"
                  icon={<Plus className="size-4" strokeWidth={3} />}
                  ariaLabel="Add to time"
                />
              )}
              <ActionButton
                onClick={commit}
                disabled={!valid}
                tone="solid"
                icon={<Check className="size-4" strokeWidth={3} />}
                ariaLabel="Set time"
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

// Same solid/outline commit-button pattern as TimeKeypad's own ActionButton
// (Add vs. Set/Update) — kept as a separate local copy since the two
// keypads' commit semantics differ enough (wall-clock time vs. elapsed
// duration) that sharing one component isn't worth the indirection.
function ActionButton({
  onClick,
  disabled,
  tone,
  icon,
  ariaLabel,
}: {
  onClick: () => void;
  disabled?: boolean;
  tone: "solid" | "outline";
  icon: React.ReactNode;
  ariaLabel: string;
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

// Matches the schedule grid's own time convention (see fmt12 in
// ScheduleView) — lowercase a/p directly after the digits, no space —
// rather than " AM"/" PM", to save room in the time-entry boxes.
export function formatTimeOfDay(value: string): string {
  if (!value) return "";
  const { hour12, minute, isPM } = from24h(value);
  return `${hour12}:${String(minute).padStart(2, "0")}${isPM ? "p" : "a"}`;
}

// Same "no space, lowercase a/p" convention as formatTimeOfDay, extended
// with seconds — for the few displays (Timestamp's own expanded view) that
// pair a stamp's time with its date and want second-level precision there,
// unlike every plain "HH:MM" scheduled-time field elsewhere in the app.
export function formatTimeOfDaySeconds(value: string): string {
  if (!value) return "";
  const { hour12, minute, isPM } = from24h(value);
  const second = parseInt(value.split(":")[2], 10) || 0;
  return `${hour12}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}${isPM ? "p" : "a"}`;
}

// The Settings 24-hour toggle's own display layer — every actual on-screen
// clock/appointment/checkpoint reads through one of these two instead of
// calling formatTimeOfDay/formatTimeOfDaySeconds directly, so flipping the
// setting changes what's shown everywhere at once. Deliberately NOT built
// into formatTimeOfDay itself: that function's "10:00a" output is also the
// literal encoding checkpoint schedules are persisted in (see
// AddCardDialog's buildCardConfig and parseTimeOfDayLabel below, which
// hard-parses that exact shape) — changing its format based on a live
// setting would silently corrupt how already-saved checkpoints round-trip.
// `value` is already 24h "HH:MM"/"HH:MM:SS" here, so the 24-hour branch is
// just a pass-through.
export function formatTimeOfDayForDisplay(value: string, use24Hour: boolean): string {
  if (!value) return "";
  return use24Hour ? value : formatTimeOfDay(value);
}

export function formatTimeOfDaySecondsForDisplay(value: string, use24Hour: boolean): string {
  if (!value) return "";
  return use24Hour ? value : formatTimeOfDaySeconds(value);
}

/** Reverses formatTimeOfDay's own "10:00a" / "12:00p" display format back
 *  into a 24h hour + minute — e.g. for comparing a saved checkpoint time
 *  against the real wall clock. Returns null for anything that doesn't
 *  match that exact shape (blank/unset checkpoints, corrupted data, etc.)
 *  rather than guessing. */
export function parseTimeOfDayLabel(formatted: string): { hour24: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})([ap])$/i.exec(formatted.trim());
  if (!m) return null;
  const hour12 = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const isPM = m[3].toLowerCase() === "p";
  if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) return null;
  const hour24 = isPM ? (hour12 === 12 ? 12 : hour12 + 12) : hour12 === 12 ? 0 : hour12;
  return { hour24, minute };
}
