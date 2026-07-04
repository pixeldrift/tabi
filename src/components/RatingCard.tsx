import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import { CardShell } from "./CardShell";
import { useCardSession } from "./SessionContext";
import { cn } from "@/lib/utils";

export interface RatingCardProps {
  title: string;
  phase?: string;
  description?: string;
  /** Inclusive low end of the range — 0 means "unrated" and lights no stars. */
  min?: number;
  /** Inclusive high end — also the number of stars shown. */
  max: number;
  /**
   * One line per star describing what that level of quality looks like in
   * practice — in a real goal these would be authored by the BCBA when the
   * target is created; a placeholder is used here if omitted.
   */
  levelDescriptions?: string[];
  isActive?: boolean;
  onActivate?: () => void;
}

// Each star is a little larger than the one before it, ascending left to
// right, so the scale itself reads as "small praise -> big praise" without
// needing a legend.
const BASE_STAR_SIZE = 26;
const STAR_SIZE_STEP = 7;

export function RatingCard({
  title,
  phase = "Intervention",
  description,
  min = 0,
  max,
  levelDescriptions,
  isActive = true,
  onActivate,
}: RatingCardProps) {
  const numStars = max - min;
  // A single subjective score for the whole session — unlike the other card
  // types there's no running count or trial list to fill in, just one value
  // that later interactions simply overwrite.
  const [rating, setRating] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const { markDirty, resetSignal } = useCardSession();

  useEffect(() => {
    if (resetSignal === 0) return;
    setRating(0);
  }, [resetSignal]);

  const pick = (value: number) => {
    markDirty();
    setRating((r) => (r === value ? 0 : value));
  };

  return (
    <CardShell
      title={title}
      phase={phase}
      dataType="Rating"
      dataTypeIcon={<Star />}
      description={description}
      isActive={isActive}
      onActivate={onActivate}
      progress={null}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((v) => !v)}
      details={
        <dl className="space-y-3">
          <Row label="Phase" value={phase} />
          <Row label="Data type" value="Rating (quality)" />
          <Row label="Range" value={`${min}–${max}`} />
          <Row label="Current rating" value={rating > 0 ? String(rating) : "Not yet rated"} />
        </dl>
      }
      expandedView={
        <ol className="px-4 pt-1 pb-3 space-y-2.5">
          {Array.from({ length: numStars }, (_, i) => {
            const value = min + i + 1;
            const desc = levelDescriptions?.[i] ?? `Describe what a rating of ${value} looks like.`;
            const isCurrent = value === rating;
            return (
              <li key={value} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "grid place-items-center size-6 rounded-full text-[11px] font-medium shrink-0 mt-0.5 transition-colors",
                    isCurrent ? "bg-blue-500 text-white" : "bg-stone-100 text-foreground/60",
                  )}
                >
                  {value}
                </span>
                <span className={cn("flex-1 text-sm leading-snug pt-0.5", isCurrent ? "text-foreground" : "text-foreground/70")}>
                  {desc}
                </span>
              </li>
            );
          })}
        </ol>
      }
    >
      <div className="px-5 pt-3 pb-4 flex flex-col items-center gap-2">
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: numStars }, (_, i) => {
            const value = min + i + 1;
            const size = BASE_STAR_SIZE + i * STAR_SIZE_STEP;
            const filled = rating >= value;
            const isTop = filled && value === rating;
            return (
              <RatingStar
                key={value}
                value={value}
                size={size}
                filled={filled}
                isTop={isTop}
                onClick={() => pick(value)}
              />
            );
          })}
        </div>
        <span className="text-xs text-muted-foreground">
          {rating > 0 ? (
            <>
              Rated <strong className="font-semibold text-foreground">{rating}</strong> of {max}.
            </>
          ) : (
            "Tap a star to rate."
          )}
        </span>
      </div>
    </CardShell>
  );
}

// Custom star path (not lucide's <Star>, so we can mark the outline with
// vector-effect="non-scaling-stroke") — each star's rendered box grows with
// its value, but the SVG viewBox-to-viewport scale that growth implies would
// otherwise scale the stroke right along with it. non-scaling-stroke cancels
// that scale component for the stroke specifically, so line weight stays
// constant across every star regardless of size, like the trial bubbles'
// border thickness (2px on the emphasized one, 1px on the rest).
function RatingStar({
  value,
  size,
  filled,
  isTop,
  onClick,
}: {
  value: number;
  size: number;
  filled: boolean;
  /** The topmost filled star — i.e. the one matching the current rating —
   *  gets the bold "selected" treatment; stars below it just read as filled. */
  isTop: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      animate={filled ? { scale: [1, 1.14, 1] } : { scale: 1 }}
      transition={{ duration: 0.3 }}
      aria-label={`Rate ${value}`}
      aria-pressed={filled}
      className={cn("relative shrink-0", isTop && "drop-shadow-[0_2px_3px_rgba(29,78,216,0.45)]")}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        style={{ width: size, height: size }}
        className={cn(
          "transition-colors",
          isTop ? "fill-blue-500 stroke-blue-600" : filled ? "fill-blue-100 stroke-blue-300" : "fill-none stroke-stone-300",
        )}
      >
        <polygon
          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
          strokeWidth={isTop ? 2 : 1}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center pt-1 font-display font-semibold leading-none tabular-nums transition-colors",
          isTop ? "text-white" : filled ? "text-blue-700" : "text-stone-400",
        )}
        style={{ fontSize: Math.max(10, size * 0.32) }}
      >
        {value}
      </span>
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
