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
        <div className="flex items-start justify-center gap-1.5">
          {Array.from({ length: numStars }, (_, i) => {
            const value = min + i + 1;
            const size = BASE_STAR_SIZE + i * STAR_SIZE_STEP;
            const maxSize = BASE_STAR_SIZE + (numStars - 1) * STAR_SIZE_STEP;
            const filled = rating >= value;
            const isTop = filled && value === rating;
            return (
              <RatingStar
                key={value}
                value={value}
                size={size}
                maxSize={maxSize}
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

// A 5-point star with every vertex rounded off (each sharp corner replaced
// by a short quadratic curve cutting across it) instead of lucide's crisp
// polygon — reads as much less "spiky" while keeping the star's silhouette
// recognizable. Outer points get a bigger rounding radius than the inner
// notches, since those tips are what read as pointy.
const ROUNDED_STAR_PATH =
  "M10.85,4.33 Q12,2 13.15,4.33 L14.51,7.09 Q15.09,8.26 16.38,8.45 L19.43,8.89 Q22,9.27 20.14,11.08 " +
  "L17.93,13.23 Q17,14.14 17.22,15.42 L17.74,18.46 Q18.18,21.02 15.88,19.81 L13.15,18.38 Q12,17.77 10.85,18.38 " +
  "L8.12,19.81 Q5.82,21.02 6.26,18.46 L6.78,15.42 Q7,14.14 6.07,13.23 L3.86,11.08 Q2,9.27 4.57,8.89 " +
  "L7.62,8.45 Q8.91,8.26 9.49,7.09 Z";

// Same fraction of box height for every star (they're geometrically similar,
// just scaled), used both as each star's own margin-top (relative to the
// largest star, which anchors at 0) and as the number's own vertical anchor
// within its box. Because both use the same fraction, the two facts —
// "numbers form a straight line" and "each star's shape is what actually
// shifts to hold that line" — are the same equation, not two separate fixes.
const NUMBER_LINE_FRACTION = 0.56;

function RatingStar({
  value,
  size,
  maxSize,
  filled,
  isTop,
  onClick,
}: {
  value: number;
  size: number;
  /** The largest star in the row — every other star's shift is relative to it. */
  maxSize: number;
  filled: boolean;
  /** The topmost filled star — i.e. the one matching the current rating —
   *  gets the bold "selected" treatment; stars below it just read as filled. */
  isTop: boolean;
  onClick: () => void;
}) {
  const marginTop = NUMBER_LINE_FRACTION * (maxSize - size);

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
      style={{ width: size, height: size, marginTop }}
    >
      <svg
        viewBox="0 0 24 24"
        style={{ width: size, height: size }}
        className={cn(
          "transition-colors",
          isTop ? "fill-blue-500 stroke-blue-600" : filled ? "fill-blue-100 stroke-blue-300" : "fill-none stroke-stone-300",
        )}
      >
        <path
          d={ROUNDED_STAR_PATH}
          strokeWidth={isTop ? 2 : 1}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className={cn(
          "absolute inset-x-0 flex justify-center font-display leading-none tabular-nums transition-colors",
          isTop ? "font-bold text-white" : "font-medium",
          !isTop && (filled ? "text-blue-700" : "text-stone-400"),
        )}
        style={{
          fontSize: Math.max(10, size * 0.32),
          top: `${NUMBER_LINE_FRACTION * 100}%`,
          transform: "translateY(-50%)",
        }}
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
