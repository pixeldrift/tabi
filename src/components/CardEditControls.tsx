import { GripVertical, Bookmark, EyeOff } from "lucide-react";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { playSoundEffect } from "@/lib/soundEffects";
import { cn } from "@/lib/utils";

/** dnd-kit's own per-card drag-handle wiring (from useSortable) — spread
 *  onto this handle specifically, never the card's own root element, so the
 *  rest of the card (buttons, the number pad, etc.) stays clickable while in
 *  edit mode. setActivatorNodeRef points dnd-kit's keyboard/ARIA handling at
 *  this handle rather than the sortable item's own root, since they're two
 *  different DOM nodes here. */
export interface DragHandleProps {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
}

export interface CardEditControlsProps {
  favorited: boolean;
  onToggleFavorite: () => void;
  cardHidden: boolean;
  onToggleHidden: () => void;
  dragControls?: DragHandleProps;
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
          onClick={() => {
            playSoundEffect("click");
            onToggleFavorite();
          }}
          aria-pressed={favorited}
          aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
          className={cn(
            "grid place-items-center size-6 rounded-full transition-colors",
            favorited ? "text-blue-500" : "text-stone-400 hover:text-stone-600",
          )}
        >
          <Bookmark className="size-4" fill={favorited ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          onClick={() => {
            playSoundEffect("click");
            onToggleHidden();
          }}
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
        ref={dragControls?.setActivatorNodeRef}
        className="cursor-grab touch-none select-none ml-2.5 -mr-1.5 grid place-items-center size-6 rounded-full text-stone-400 hover:text-stone-600 active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...dragControls?.attributes}
        {...dragControls?.listeners}
      >
        <GripVertical className="size-4" />
      </span>
    </div>
  );
}
