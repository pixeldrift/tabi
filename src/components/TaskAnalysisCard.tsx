import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Check, HandHelping, X } from "lucide-react";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { DataListRow } from "./DataListRow";
import { MiniTileShell } from "./MiniTileShell";
import { SwipeStrip } from "./SwipeStrip";
import { ListActionBadge, ListActionButton, ListActionSlide } from "./ListRowActions";
import { useCardState, useResetGuard } from "./CardDataStore";
import { TaskAnalysisIcon } from "./icons/TaskAnalysisIcon";
import { useCardSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { cn } from "@/lib/utils";

export type StepStatus = "independent" | "prompted" | "error" | null;

export interface TaskAnalysisCardProps extends CardEditAndDrawerProps {
  id?: string;
  title: string;
  phase?: string;
  description?: string;
  steps: string[];
  isActive?: boolean;
  onActivate?: () => void;
}

// Error (negative) on the left, Independent (positive) on the right — same
// left-to-right reading as Percent Correct's Error/Correct pair, with
// Prompted as the neutral middle option unique to task analysis.
const OPTIONS: { value: Exclude<StepStatus, null>; label: string; icon: typeof Check; strokeWidth: number; classes: string; selectedClasses: string }[] = [
  {
    value: "error",
    label: "Error",
    icon: X,
    strokeWidth: 3,
    classes: "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
    selectedClasses: "bg-red-400 border-red-500 text-white",
  },
  {
    value: "prompted",
    label: "Prompted",
    icon: HandHelping,
    // HandHelping has much more path detail than Check/X, so the same
    // strokeWidth reads noticeably heavier — thinned to match their weight.
    strokeWidth: 1.75,
    classes: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
    selectedClasses: "bg-amber-400 border-amber-500 text-white",
  },
  {
    value: "independent",
    label: "Independent",
    icon: Check,
    strokeWidth: 3,
    classes: "border-green-300 bg-green-50 text-green-700 hover:bg-green-100",
    selectedClasses: "bg-green-400 border-green-500 text-white",
  },
];

const BUBBLE = 18;
const BUBBLE_CENTER = 54;
const GAP = 6;

// Solid dot color for a step's status — used by the tile's prev/next status
// indicator (unlike OPTIONS' classes above, which style a full button).
function statusDotColor(status: StepStatus) {
  return status === "independent"
    ? "bg-green-500"
    : status === "prompted"
      ? "bg-amber-500"
      : status === "error"
        ? "bg-red-500"
        : "bg-stone-300";
}

export function TaskAnalysisCard({
  id,
  title,
  phase = "Intervention",
  description,
  steps,
  isActive = true,
  onActivate,
  reorderEditing,
  favorited,
  onToggleFavorite,
  cardHidden,
  onToggleHidden,
  dragControls,
  detailsOpen,
  onDetailsOpenChange,
  onOpenDetails,
  stickyTop,
  toolbarHeight,
  tileDensity,
  listMode,
}: TaskAnalysisCardProps) {
  const cardKey = id ?? title;
  const [statuses, setStatuses] = useCardState<StepStatus[]>(cardKey, "statuses", () => steps.map(() => null));
  const [current, setCurrent] = useCardState(cardKey, "current", 0);
  const [expanded, setExpanded] = useState(false);
  const { markDirty, resetSignal, sessionRunning } = useCardSession();
  const [shouldReset, markResetHandled] = useResetGuard(cardKey, resetSignal);

  useEffect(() => {
    if (!shouldReset) return;
    markResetHandled();
    setStatuses(steps.map(() => null));
    setCurrent(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset, steps]);

  // Mirrors TrialCard's setResult: read the pre-toggle value from the
  // current render's closure (not inside the setState updater) so we know
  // whether this was a genuine score vs. a toggle-off before deciding
  // whether to auto-advance.
  const setStep = (idx: number, value: Exclude<StepStatus, null>, advance = false) => {
    markDirty();
    const isToggleOff = statuses[idx] === value;
    setStatuses((prev) => {
      const next = [...prev];
      next[idx] = isToggleOff ? null : value;
      return next;
    });
    setCurrent(idx);
    if (advance && !isToggleOff) {
      window.setTimeout(() => {
        setCurrent((c) => Math.min(c + 1, steps.length - 1));
      }, 260);
    }
  };

  const goTo = (idx: number) => {
    setCurrent(Math.max(0, Math.min(idx, steps.length - 1)));
  };

  const completed = statuses.filter((s) => s !== null).length;
  const independent = statuses.filter((s) => s === "independent").length;
  const progress = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;
  const isComplete = completed >= steps.length;
  const remaining = Math.max(0, steps.length - completed);
  useReportCardStatus(cardKey, completed > 0, isComplete);

  const stepWidth = BUBBLE + GAP;
  const trackOffset = useMemo(
    () => -(current * stepWidth + BUBBLE_CENTER / 2),
    [current, stepWidth],
  );

  if (tileDensity) {
    const large = tileDensity === "large";
    return (
      <MiniTileShell
        title={title}
        description={description}
        density={tileDensity}
        isActive={isActive}
        onActivate={onActivate}
        reorderEditing={reorderEditing}
        favorited={favorited}
        onToggleFavorite={onToggleFavorite}
        cardHidden={cardHidden}
        onToggleHidden={onToggleHidden}
        dragControls={dragControls}
        detailsOpen={detailsOpen}
        onDetailsOpenChange={onDetailsOpenChange}
        onOpenDetails={onOpenDetails}
        stickyTop={stickyTop}
        toolbarHeight={toolbarHeight}
        details={
          <dl className="space-y-3">
            <Row label="Phase" value={phase} />
            <Row label="Data type" value="Task analysis (I / P / E)" />
            <Row label="Steps" value={String(steps.length)} />
            <Row label="Scored" value={`${completed} / ${steps.length}`} />
            <Row label="Independent" value={`${independent} / ${steps.length}`} />
          </dl>
        }
        actions={
          <div className={cn("flex items-center justify-center", large ? "gap-2" : "gap-1.5")}>
            {OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = statuses[current] === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStep(current, opt.value, true);
                  }}
                  disabled={!sessionRunning}
                  aria-label={opt.label}
                  className={cn(
                    "shrink-0 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
                    large ? "size-10" : "size-7",
                    selected ? cn("btn-bevel", opt.selectedClasses) : opt.classes,
                  )}
                >
                  <Icon className={large ? "size-[19px]" : "size-3.5"} strokeWidth={opt.strokeWidth} />
                </button>
              );
            })}
          </div>
        }
      >
        {/* Previous/next step status, in the same left-behind/coming-up
            reading direction as the nav arrows elsewhere — large density
            only ("if there is room"; small's own step text is already
            fighting for space, see MiniTileShell's own clamp comment). */}
        {large && (
          <div className="flex items-center gap-3" aria-hidden>
            <span className={cn("rounded-full size-1.5", current > 0 ? statusDotColor(statuses[current - 1]) : "bg-transparent")} />
            <span className={cn("rounded-full size-1.5", current < steps.length - 1 ? statusDotColor(statuses[current + 1]) : "bg-transparent")} />
          </div>
        )}
        <SwipeStrip
          count={steps.length}
          current={current}
          onCurrentChange={goTo}
          variant="centered"
          className="w-full"
          gapClassName={large ? "gap-3" : "gap-2"}
          itemWrapperClassName="flex items-center justify-center"
        >
          {(i, isCenter) => {
            const status = statuses[i];
            const color =
              status === "independent"
                ? "text-green-700"
                : status === "prompted"
                  ? "text-amber-700"
                  : status === "error"
                    ? "text-red-700"
                    : "text-foreground";
            // Neighboring steps keep their usual footprint (so the swipe
            // strip's own drag distance doesn't change) but show no text at
            // all — previously a dimmed preview of the step name spilled
            // onto the tile next to the centered one; the dots above now
            // cover "what's coming" instead, so this just stays blank.
            return (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i);
                }}
                className={cn(
                  "whitespace-nowrap overflow-hidden text-ellipsis font-semibold leading-none transition-[font-size]",
                  isCenter ? color : "invisible",
                )}
                style={{
                  maxWidth: isCenter ? (large ? 148 : 96) : large ? 130 : 82,
                  fontSize: isCenter ? (large ? 17 : 11.5) : large ? 11 : 8.5,
                }}
              >
                {i + 1}: {steps[i]}
              </div>
            );
          }}
        </SwipeStrip>
      </MiniTileShell>
    );
  }

  if (listMode) {
    return (
      <DataListRow
        title={title}
        description={description}
        dataTypeIcon={<TaskAnalysisIcon />}
        dataTypeLabel="Task Analysis"
        isActive={isActive}
        onActivate={onActivate}
        reorderEditing={reorderEditing}
        favorited={favorited}
        onToggleFavorite={onToggleFavorite}
        cardHidden={cardHidden}
        onToggleHidden={onToggleHidden}
        dragControls={dragControls}
        detailsOpen={detailsOpen}
        onDetailsOpenChange={onDetailsOpenChange}
        stickyTop={stickyTop}
        toolbarHeight={toolbarHeight}
        actions={
          <ListActionSlide actionKey={current}>
            <ListActionBadge value={current + 1} />
            {OPTIONS.map((opt) => (
              <ListActionButton
                key={opt.value}
                icon={opt.icon}
                variant={opt.value === "error" ? "red" : opt.value === "prompted" ? "amber" : "green"}
                selected={statuses[current] === opt.value}
                disabled={!sessionRunning}
                ariaLabel={opt.label}
                onClick={() => setStep(current, opt.value, true)}
              />
            ))}
          </ListActionSlide>
        }
      />
    );
  }

  return (
    <CardShell
      title={title}
      phase={phase}
      dataType="Task Analysis"
      dataTypeIcon={<TaskAnalysisIcon />}
      description={description}
      isActive={isActive}
      onActivate={onActivate}
      reorderEditing={reorderEditing}
      favorited={favorited}
      onToggleFavorite={onToggleFavorite}
      cardHidden={cardHidden}
      onToggleHidden={onToggleHidden}
      dragControls={dragControls}
      detailsOpen={detailsOpen}
      onDetailsOpenChange={onDetailsOpenChange}
      onOpenDetails={onOpenDetails}
      stickyTop={stickyTop}
      toolbarHeight={toolbarHeight}
      progress={progress}
      isComplete={isComplete}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((v) => !v)}
      helperText={
        isComplete ? (
          <span>
            All steps scored ·{" "}
            <strong className="font-semibold">
              {independent}/{steps.length} independent
            </strong>
          </span>
        ) : (
          <span>
            Score <strong className="font-semibold">{remaining} more</strong>{" "}
            {remaining === 1 ? "step" : "steps"}.
          </span>
        )
      }
      details={
        <dl className="space-y-3">
          <Row label="Phase" value={phase} />
          <Row label="Data type" value="Task analysis (I / P / E)" />
          <Row label="Steps" value={String(steps.length)} />
          <Row label="Scored" value={`${completed} / ${steps.length}`} />
          <Row label="Independent" value={`${independent} / ${steps.length}`} />
        </dl>
      }
      expandedView={
        <ol className="px-3 pt-1 pb-3 space-y-1">
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
              <span className="grid place-items-center size-6 rounded-full bg-stone-100 text-[11px] font-medium text-foreground/60 shrink-0">
                {i + 1}
              </span>
              <span
                className={cn(
                  "flex-1 text-sm leading-tight",
                  statuses[i] && "text-foreground/80",
                )}
              >
                {step}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = statuses[i] === opt.value;
                  return (
                    <motion.button
                      key={opt.value}
                      onClick={() => setStep(i, opt.value)}
                      disabled={!sessionRunning}
                      whileTap={{ scale: 0.9 }}
                      aria-label={opt.value}
                      className={cn(
                        "size-8 rounded-full border-2 grid place-items-center transition-colors disabled:opacity-40",
                        opt.classes,
                        selected && cn("btn-bevel", opt.selectedClasses),
                      )}
                    >
                      <Icon className="size-3.5" strokeWidth={opt.strokeWidth} />
                    </motion.button>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      }
    >
      <div className="relative px-2 pt-3 pb-1">
        <div className="relative h-16">
          <TriangleNav direction="left" onClick={() => goTo(current - 1)} disabled={current === 0} />
          <TriangleNav
            direction="right"
            onClick={() => goTo(current + 1)}
            disabled={current >= steps.length - 1}
          />
          <div
            className="relative h-16 overflow-hidden"
            style={{
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0, black 22%, black 78%, transparent 100%)",
              maskImage:
                "linear-gradient(to right, transparent 0, black 22%, black 78%, transparent 100%)",
            }}
          >
            <motion.div
              className="absolute top-1/2 left-1/2 flex items-center"
              style={{ gap: GAP, translateY: "-50%" }}
              animate={{ x: trackOffset }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
            >
              {steps.map((_, i) => {
                const isCenter = i === current;
                const status = statuses[i];
                return (
                  <motion.button
                    key={i}
                    onClick={() => goTo(i)}
                    className="relative shrink-0 grid place-items-center rounded-full font-medium select-none border"
                    animate={{
                      width: isCenter ? BUBBLE_CENTER : BUBBLE,
                      height: isCenter ? BUBBLE_CENTER : BUBBLE,
                    }}
                    transition={{ type: "spring", stiffness: 360, damping: 28 }}
                  >
                    <span
                      className={cn(
                        "absolute inset-0 rounded-full grid place-items-center",
                        isCenter ? "border-2" : "border",
                        status === "independent"
                          ? "bg-green-50 border-green-300 text-green-700"
                          : status === "prompted"
                            ? "bg-amber-50 border-amber-300 text-amber-700"
                            : status === "error"
                              ? "bg-red-50 border-red-300 text-red-700"
                              : "bg-foreground/5 border-foreground/10 text-foreground/40",
                        isCenter && !status && "bg-card border-foreground/30 text-foreground",
                      )}
                    >
                      <span className={cn(isCenter ? "font-display text-2xl leading-none" : "text-[7px] leading-none")}>
                        {i + 1}
                      </span>
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
          </div>
        </div>
        <div className="text-center text-xs text-muted-foreground">
          Step {current + 1} of {steps.length}
        </div>

        {/* flex+justify-center on the row, rather than text-align:center on
         *  the paragraph itself: a centered *line* pushes overflow past
         *  both edges equally, and CardShell's own rounded-corner
         *  overflow-hidden then clips the beginning of a too-long word
         *  along with the end. Centering the *box* instead means a short
         *  line (which fits, so the box shrinks to its content) still reads
         *  as centered, but a long line's box gets capped at max-w-full —
         *  leaving nothing left to center around — so it truncates from its
         *  natural (left) start, losing only the tail. */}
        <div className="mt-2 px-3 flex justify-center">
          <p className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-base font-semibold leading-tight">
            {steps[current]}
          </p>
        </div>

        <div className="mt-3 flex justify-center gap-1 px-2">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = statuses[current] === opt.value;
            return (
              <motion.button
                key={opt.value}
                onClick={() => setStep(current, opt.value, true)}
                disabled={!sessionRunning}
                whileTap={{ scale: 0.96 }}
                className={cn(
                  "flex-1 min-w-0 h-10 rounded-full border-2 flex items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors disabled:opacity-40",
                  opt.classes,
                  selected && cn("btn-bevel", opt.selectedClasses),
                )}
              >
                <Icon className="size-3.5 shrink-0" strokeWidth={opt.strokeWidth} />
                <span className="truncate">{opt.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </CardShell>
  );
}

function TriangleNav({
  direction,
  onClick,
  disabled,
}: {
  direction: "left" | "right";
  onClick: () => void;
  disabled?: boolean;
}) {
  const isLeft = direction === "left";
  return (
    <motion.button
      aria-label={isLeft ? "Previous step" : "Next step"}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.82 }}
      whileHover={{ scale: 1.08 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-20 grid place-items-center size-12 shrink-0 aspect-square text-blue-500 hover:text-blue-600 active:text-blue-700 transition-colors disabled:text-foreground/25 disabled:pointer-events-none",
        isLeft ? "-left-2" : "-right-2",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-9 drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]"
        fill="currentColor"
        aria-hidden
      >
        {isLeft ? (
          <path
            d="M15.5 4.2c1.1-.7 2.5.1 2.5 1.4v12.8c0 1.3-1.4 2.1-2.5 1.4L6.9 13.6a1.9 1.9 0 0 1 0-3.2L15.5 4.2z"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M8.5 4.2c-1.1-.7-2.5.1-2.5 1.4v12.8c0 1.3 1.4 2.1 2.5 1.4l8.6-5.8a1.9 1.9 0 0 0 0-3.2L8.5 4.2z"
            strokeLinejoin="round"
          />
        )}
      </svg>
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
