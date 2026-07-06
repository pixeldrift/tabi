import { GripVertical, Heart, EyeOff } from "lucide-react";
import type { DragControls } from "motion/react";
import { cn } from "@/lib/utils";

export interface CardEditControlsProps {
  favorited: boolean;
  onToggleFavorite: () => void;
  cardHidden: boolean;
  onToggleHidden: () => void;
  /** Starts the Reorder.Item drag from this handle specifically — the item
   *  itself uses `dragListener={false}` so the rest of the card (buttons,
   *  the number pad, etc.) stays clickable while in edit mode. */
  dragControls?: DragControls;
}

/** Replaces the phase/data-type label and details button in a card's header
 *  while the toolbar's edit mode is on — reordering, favoriting, and hiding
 *  all happen right on the card instead of a separate row above it. */
export function CardEditControls({
  favorited,
  onToggleFavorite,
  cardHidden,
  onToggleHidden,
  dragControls,
}: CardEditControlsProps) {
  return (
    <div className="flex items-center shrink-0 -mt-0.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorited}
          aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
          className={cn(
            "grid place-items-center size-6 rounded-full transition-colors",
            favorited ? "text-blue-500" : "text-stone-400 hover:text-stone-600",
          )}
        >
          <Heart className="size-4" fill={favorited ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          onClick={onToggleHidden}
          aria-pressed={cardHidden}
          aria-label={cardHidden ? "Unhide card" : "Hide card"}
          className={cn(
            "grid place-items-center size-6 rounded-full transition-colors",
            cardHidden ? "text-blue-500" : "text-stone-400 hover:text-stone-600",
          )}
        >
          <EyeOff className="size-4" />
        </button>
      </div>
      {/* Pulled toward the card's right edge (mirroring the twirl-down
          chevron's own -ml-1.5 hugging the left edge) and set apart from
          favorite/hide with its own margin, so it reads as a distinct
          "edge of the card" control rather than a third icon grouped in
          with them. */}
      <span
        className="cursor-grab touch-none select-none ml-2.5 -mr-1.5 grid place-items-center size-6 rounded-full text-stone-400 hover:text-stone-600 active:cursor-grabbing"
        onPointerDown={(e) => {
          // Without this, a mouse-based (non-touch) drag also kicks off the
          // browser's native text-selection drag as the pointer crosses
          // over other cards' text while reordering.
          e.preventDefault();
          dragControls?.start(e);
        }}
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </span>
    </div>
  );
}
