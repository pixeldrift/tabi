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
  isActive = true,
  onActivate,
}: RatingCardProps) {
  const numStars = max - min;
  // A single subjective score for the whole session — unlike the other card
  // types there's no running count or trial list to fill in, just one value
  // that later interactions simply overwrite.
  const [rating, setRating] = useState(0);
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
      details={
        <dl className="space-y-3">
          <Row label="Phase" value={phase} />
          <Row label="Data type" value="Rating (quality)" />
          <Row label="Range" value={`${min}–${max}`} />
          <Row label="Current rating" value={rating > 0 ? String(rating) : "Not yet rated"} />
        </dl>
      }
    >
      <div className="px-5 pt-3 pb-4 flex flex-col items-center gap-2">
        <div className="flex items-end justify-center gap-1.5">
          {Array.from({ length: numStars }, (_, i) => {
            const value = min + i + 1;
            const size = BASE_STAR_SIZE + i * STAR_SIZE_STEP;
            const filled = rating >= value;
            return (
              <RatingStar
                key={value}
                value={value}
                size={size}
                filled={filled}
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

function RatingStar({
  value,
  size,
  filled,
  onClick,
}: {
  value: number;
  size: number;
  filled: boolean;
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
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <Star
        style={{ width: size, height: size }}
        fill={filled ? "currentColor" : "none"}
        strokeWidth={filled ? 1.5 : 1.75}
        className={cn("transition-colors", filled ? "text-amber-400" : "text-stone-300")}
      />
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center pt-1 font-display font-semibold leading-none tabular-nums transition-colors",
          filled ? "text-white" : "text-stone-400",
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
