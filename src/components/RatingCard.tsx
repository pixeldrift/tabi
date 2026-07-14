import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Star } from "lucide-react";
import { CardShell, type CardEditAndDrawerProps } from "./CardShell";
import { DataListRow } from "./DataListRow";
import { MiniTileShell } from "./MiniTileShell";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useCardState, useResetGuard } from "./CardDataStore";
import { TeachingProcedureAccordion } from "./TeachingProcedureAccordion";
import { DrawerQuickFacts } from "./DrawerQuickFacts";
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
const BASE_STAR_SIZE = 32;
const STAR_SIZE_STEP = 9;
// Expanded-list rows use one uniform size (no ascending scale needed in a
// vertical list) — the same RatingStar component, just with maxSize equal
// to its own size so its margin-top offset comes out to zero.
const ROW_STAR_SIZE = 36;

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
  tileDensity,
  listMode,
  teachingProcedure,
  onPrevCard,
  onNextCard,
  slideFrom,
}: RatingCardProps) {
  const numStars = max - min;
  // Fed into the drawer's teaching-procedure Measurement row (as a
  // `scale`, rather than the fixed correct/error pair every other kind
  // uses) — same value/description pairing the expanded view's own list
  // renders, so the two never drift out of sync.
  const scaleRows = Array.from({ length: numStars }, (_, i) => {
    const value = min + i + 1;
    return {
      value,
      description: levelDescriptions?.[i] ?? `Describe what a score of ${value} looks like.`,
    };
  });
  // A single subjective score for the whole session — unlike the other card
  // types there's no running count or trial list to fill in, just one value
  // that later interactions simply overwrite.
  const cardKey = id ?? title;
  const [rating, setRating] = useCardState(cardKey, "rating", 0);
  const [expanded, setExpanded] = useState(false);
  const { markDirty, resetSignal, sessionRunning } = useCardSession();
  useReportCardStatus(cardKey, rating > 0, rating > 0);
  const [shouldReset, markResetHandled] = useResetGuard(cardKey, resetSignal);

  useEffect(() => {
    if (!shouldReset) return;
    markResetHandled();
    setRating(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReset]);

  const pick = (value: number) => {
    markDirty();
    setRating((r) => (r === value ? 0 : value));
  };

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
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        details={
          <>
            <DrawerQuickFacts
              icon={<Star />}
              dataTypeLabel="Score (quality)"
              phase={phase}
              stats={[
                { label: "Range", value: `${min}–${max}` },
                { label: "Current score", value: rating > 0 ? String(rating) : "Not yet scored" },
              ]}
            />
            {teachingProcedure && (
              <div className="mt-4">
                <TeachingProcedureAccordion
                  data={{ ...teachingProcedure, measurement: { scale: scaleRows } }}
                  kind="rating"
                />
              </div>
            )}
          </>
        }
      >
        <div className={cn("flex items-center", large ? "gap-1.5" : "gap-1")}>
          {Array.from({ length: numStars }, (_, i) => {
            const value = min + i + 1;
            const filled = rating >= value;
            return (
              <motion.button
                key={value}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  pick(value);
                }}
                disabled={!sessionRunning}
                whileTap={{ scale: 0.88 }}
                animate={filled ? { scale: [1, 1.14, 1] } : { scale: 1 }}
                transition={{ duration: 0.3 }}
                aria-label={`Score ${value}`}
                aria-pressed={filled}
                className="shrink-0 disabled:opacity-40"
              >
                <Star
                  className={cn(
                    large ? "size-[26px]" : "size-[19px]",
                    filled ? "fill-blue-500 stroke-blue-600" : "fill-foreground/10 stroke-foreground/25",
                  )}
                  strokeWidth={1.5}
                />
              </motion.button>
            );
          })}
        </div>
      </MiniTileShell>
    );
  }

  if (listMode) {
    return (
      <DataListRow
        title={title}
        description={description}
        dataTypeIcon={<Star />}
        dataTypeLabel="Score"
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
        onPrevCard={onPrevCard}
        onNextCard={onNextCard}
        slideFrom={slideFrom}
        actions={
          <ListRatingButton
            rating={rating}
            numStars={numStars}
            min={min}
            disabled={!sessionRunning}
            onPick={pick}
          />
        }
      />
    );
  }

  return (
    <CardShell
      title={title}
      phase={phase}
      dataType="Score"
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
      onPrevCard={onPrevCard}
      onNextCard={onNextCard}
      slideFrom={slideFrom}
      progress={null}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((v) => !v)}
      details={
        <>
          <DrawerQuickFacts
            icon={<Star />}
            dataTypeLabel="Score (quality)"
            phase={phase}
            stats={[
              { label: "Range", value: `${min}–${max}` },
              { label: "Current score", value: rating > 0 ? String(rating) : "Not yet scored" },
            ]}
          />
          {teachingProcedure && (
            <div className="mt-4">
              <TeachingProcedureAccordion
                data={{ ...teachingProcedure, measurement: { scale: scaleRows } }}
                kind="rating"
              />
            </div>
          )}
        </>
      }
      expandedView={
        <ol className="px-4 pt-1 pb-3 space-y-2">
          {Array.from({ length: numStars }, (_, i) => {
            const value = min + i + 1;
            const desc = levelDescriptions?.[i] ?? `Describe what a score of ${value} looks like.`;
            const filled = rating >= value;
            const isTop = filled && value === rating;
            return (
              <li key={value} className="flex items-start gap-3">
                <RatingStar
                  value={value}
                  size={ROW_STAR_SIZE}
                  maxSize={ROW_STAR_SIZE}
                  filled={filled}
                  isTop={isTop}
                  disabled={!sessionRunning}
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
      <div className="px-5 pt-4 pb-4 flex flex-col items-center gap-3">
        <div className="flex items-start justify-center gap-2.5">
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
                disabled={!sessionRunning}
                onClick={() => pick(value)}
              />
            );
          })}
        </div>
        <span className="text-xs text-muted-foreground">
          {rating > 0 ? (
            <>
              Scored <strong className="font-semibold text-foreground">{rating}</strong> out of {max}.
            </>
          ) : (
            "Tap a star to score."
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

/** The List display mode's single floating action — shows the current
 *  rating (or a bare star while unrated) and opens a plain star-row picker,
 *  the same style as the grid tile's own star row (no level descriptions —
 *  those only appear in Card mode's roomier expanded view). The triangle is
 *  the same "more choices below" cue every other button-with-a-menu uses. */
function ListRatingButton({
  rating,
  numStars,
  min,
  disabled,
  onPick,
}: {
  rating: number;
  numStars: number;
  min: number;
  disabled?: boolean;
  onPick: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          disabled={disabled}
          aria-label={rating > 0 ? `Scored ${rating}` : "Score"}
          aria-haspopup
          className={cn(
            "btn-bevel relative shrink-0 size-7 rounded-full grid place-items-center border-[1.5px] transition-colors disabled:opacity-40",
            rating > 0
              ? "bg-blue-500 border-blue-600 text-white"
              : "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100",
          )}
        >
          {/* Only the numeral/star itself slides on a new rating — the
              button chrome around it stays put, same pattern as every other
              kind's badge+buttons split (see ListActionSlide). */}
          <span className="relative size-3.5 grid place-items-center overflow-hidden -translate-y-0.5">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={rating}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 grid place-items-center"
              >
                {rating > 0 ? (
                  <span className="text-xs font-bold tabular-nums">{rating}</span>
                ) : (
                  <Star className="size-3.5" strokeWidth={2} />
                )}
              </motion.span>
            </AnimatePresence>
          </span>
          <span
            className="absolute bottom-1 left-1/2 -translate-x-1/2 size-0 border-l-[3px] border-r-[3px] border-t-[3.5px] border-l-transparent border-r-transparent border-t-current opacity-70"
            aria-hidden
          />
        </button>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="center"
        collisionPadding={8}
        className="group w-auto rounded-2xl border-2 border-blue-300 bg-card p-2.5 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
      >
        <div className="flex items-center gap-1.5">
          {Array.from({ length: numStars }, (_, i) => {
            const value = min + i + 1;
            const filled = rating >= value;
            return (
              <motion.button
                key={value}
                type="button"
                onClick={() => {
                  onPick(value);
                  setOpen(false);
                }}
                disabled={disabled}
                whileTap={{ scale: 0.88 }}
                animate={filled ? { scale: [1, 1.14, 1] } : { scale: 1 }}
                transition={{ duration: 0.3 }}
                aria-label={`Score ${value}`}
                aria-pressed={filled}
                className="shrink-0 disabled:opacity-40"
              >
                <Star
                  className={cn(
                    "size-7",
                    filled ? "fill-blue-500 stroke-blue-600" : "fill-foreground/10 stroke-foreground/25",
                  )}
                  strokeWidth={1.5}
                />
              </motion.button>
            );
          })}
        </div>
        {/* Arrow — points back at the star button that opened this popup,
            same idiom as NumberKeypad's own popover arrow. */}
        <div
          className={cn(
            "absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-blue-300 bg-card",
            "-bottom-[7px] border-r-2 border-b-2",
            "group-data-[side=bottom]:bottom-auto group-data-[side=bottom]:-top-[7px]",
            "group-data-[side=bottom]:border-r-0 group-data-[side=bottom]:border-b-0",
            "group-data-[side=bottom]:border-l-2 group-data-[side=bottom]:border-t-2",
          )}
        />
      </PopoverContent>
    </Popover>
  );
}

function RatingStar({
  value,
  size,
  maxSize,
  filled,
  isTop,
  disabled,
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
  disabled?: boolean;
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
      disabled={disabled}
      whileTap={{ scale: 0.88 }}
      animate={filled ? { scale: [1, 1.14, 1] } : { scale: 1 }}
      transition={{ duration: 0.3 }}
      aria-label={`Score ${value}`}
      aria-pressed={filled}
      className={cn(
        "relative shrink-0 disabled:opacity-40",
        isTop && "drop-shadow-[0_2px_3px_rgba(29,78,216,0.45)]",
      )}
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
              // Fill and stroke now matched in weight to the number sitting
              // on top of it (both foreground/25) — previously the fill was
              // far fainter than the number, so an unrated star read as a
              // gray digit floating with barely a star shape under it rather
              // than one uniformly grayed-out unit.
              : "fill-foreground/10 stroke-foreground/25",
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
          fontSize: Math.max(11, size * 0.36),
          top: `${DIGIT_LINE_FRACTION * 100}%`,
          transform: "translateY(-50%)",
        }}
      >
        {value}
      </span>
    </motion.button>
  );
}
