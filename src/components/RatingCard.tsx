import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Star } from "lucide-react";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { useCardSession } from "./SessionContext";
import { useReportCardStatus } from "./DataToolbarContext";
import { cn } from "@/lib/utils";

export interface RatingCardProps extends CardEditAndDrawerProps {
  id?: string;
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
// Expanded-list rows use one uniform size (no ascending scale needed in a
// vertical list) — the same RatingStar component, just with maxSize equal
// to its own size so its margin-top offset comes out to zero.
const ROW_STAR_SIZE = 30;

export function RatingCard({
  id,
  title,
  phase = "Intervention",
  description,
  min = 0,
  max,
  levelDescriptions,
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
}: RatingCardProps) {
  const numStars = max - min;
  // A single subjective score for the whole session — unlike the other card
  // types there's no running count or trial list to fill in, just one value
  // that later interactions simply overwrite.
  const [rating, setRating] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const { markDirty, resetSignal } = useCardSession();
  useReportCardStatus(id ?? title, rating > 0, rating > 0);

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
        <ol className="px-4 pt-1 pb-3 space-y-1">
          {Array.from({ length: numStars }, (_, i) => {
            const value = min + i + 1;
            const desc = levelDescriptions?.[i] ?? `Describe what a rating of ${value} looks like.`;
            const filled = rating >= value;
            const isTop = filled && value === rating;
            return (
              <li key={value} className="flex items-start gap-2.5">
                <RatingStar
                  value={value}
                  size={ROW_STAR_SIZE}
                  maxSize={ROW_STAR_SIZE}
                  filled={filled}
                  isTop={isTop}
                  onClick={() => pick(value)}
                />
                <span className={cn("flex-1 text-sm leading-tight", isTop ? "text-foreground" : "text-foreground/70")}>
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
  "M10.5,5.05 Q12,2 13.5,5.05 L14.29,6.65 Q15.09,8.26 16.87,8.52 L18.64,8.78 Q22,9.27 19.56,11.64 " +
  "L18.29,12.88 Q17,14.14 17.3,15.91 L17.61,17.67 Q18.18,21.02 15.17,19.44 L13.59,18.61 Q12,17.77 10.41,18.61 " +
  "L8.83,19.44 Q5.82,21.02 6.39,17.67 L6.7,15.91 Q7,14.14 5.71,12.88 L4.44,11.64 Q2,9.27 5.36,8.78 " +
  "L7.13,8.52 Q8.91,8.26 9.71,6.65 Z";

// The digit's own vertical anchor, as a fraction of the box — measured
// directly (via Range.getBoundingClientRect on the rendered glyph, not
// theorized), not derived from the star's geometry at all. A plain CSS
// center (top: 50%, translateY(-50%)) already lands the glyph's actual ink
// within half a percent of dead center, so that's what this is: 0.5, not a
// star-shape-derived value.
const DIGIT_LINE_FRACTION = 0.5;

// The star polygon's own area centroid (shoelace formula over its 10
// vertices — 12.51 of a 24-unit box), a fact about its geometry independent
// of where the digit sits. Used below to compute how far each star's
// *natural* centroid position falls from the digit line, so that gap can be
// cancelled out and the star's centroid actually lands on that line rather
// than merely sharing the same box.
const STAR_CENTROID_FRACTION = 12.51 / 24;

// After centering on the digit line, every star shifts 1px further up
// relative to its digit — except 1 and 4, which stay put. (No single
// formula predicts this; it's a per-size optical call.)
const STAR_UP_SHIFT_EXCEPTIONS = new Set([1, 4]);

// A couple of stars still read as slightly off-true even once
// mathematically centered — the same family of illusion as Apple's
// famously-adjusted iOS Calendar icon digit. A hair of extra correction
// on top of the computed shift above, not a full nudge in its own right.
const STAR_TINY_NUDGE: Record<number, { x: number; y: number }> = {
  1: { x: 0.5, y: -1 },
  2: { x: 0, y: 0.5 },
  3: { x: 0, y: -0.5 },
  5: { x: 0, y: 0.5 },
};

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
  // Positions every star's box so its digit — sitting at the plain,
  // measured DIGIT_LINE_FRACTION within that box — lands on the same
  // shared line regardless of size (identical mechanism to before, just
  // anchored to the digit's own fraction instead of the star's).
  const marginTop = DIGIT_LINE_FRACTION * (maxSize - size);

  // The star's *natural* centroid position (given the box above) sits at
  // STAR_CENTROID_FRACTION, which generally isn't the same point as the
  // digit line — this is the gap between the two, in px, that a plain
  // shared marginTop can't close on its own since the star and the digit
  // read off two different fractions of the same box.
  const centroidGapFromDigitLine = (DIGIT_LINE_FRACTION - STAR_CENTROID_FRACTION) * size;
  // Closing that gap lands the star centroid exactly on the digit line;
  // subtracting the extra 1px is what actually holds it 1px above that
  // line for every value except the two exceptions.
  const starUpShift = STAR_UP_SHIFT_EXCEPTIONS.has(value) ? 0 : 1;
  const starShiftY = centroidGapFromDigitLine - starUpShift;
  const starTinyNudge = STAR_TINY_NUDGE[value] ?? { x: 0, y: 0 };

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
        style={{
          width: size,
          height: size,
          transform: `translate(${starTinyNudge.x}px, ${starShiftY + starTinyNudge.y}px)`,
        }}
        className={cn(
          "transition-colors",
          isTop
            ? "fill-blue-500 stroke-blue-600"
            : filled
              ? "fill-blue-100 stroke-blue-300"
              // Light gray fill at rest, matching the % Correct bubbles'
              // unselected state, rather than a hollow outline.
              : "fill-foreground/5 stroke-foreground/10",
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
          !isTop && (filled ? "text-blue-700" : "text-foreground/40"),
        )}
        style={{
          fontSize: Math.max(10, size * 0.32),
          top: `${DIGIT_LINE_FRACTION * 100}%`,
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
