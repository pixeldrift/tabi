import { useRef, type ReactNode } from "react";
import { GripVertical, Heart, EyeOff } from "lucide-react";
import { DetailsIcon } from "./icons/DetailsIcon";
import { DataDetailsDrawer } from "./DataDetailsDrawer";
import type { CardEditAndDrawerProps } from "./CardShell";
import { cn } from "@/lib/utils";

export interface MiniTileShellProps extends CardEditAndDrawerProps {
  title: string;
  description?: string;
  details?: ReactNode;
  isActive?: boolean;
  onActivate?: () => void;
  /** Which quick-action density this tile renders at — large (2 per row,
   *  more breathing room) or small (3 per row, everything scaled down). */
  density: "large" | "small";
  /** The tile's own main content, vertically centered in the space left
   *  after the title — a number, a swipeable strip, stars, etc. */
  children: ReactNode;
  /** Bottom row of compact action buttons, rendered below `children` — kept
   *  as a separate slot (rather than just trailing content) so its gap is
   *  consistent across card kinds. */
  actions?: ReactNode;
}

/** Compact aspect-square counterpart to CardShell, used by every card kind
 *  when the toolbar's display mode is one of the two quick-action grids
 *  (see DataToolbarContext's DisplayMode). Each card component renders
 *  either this or its own full CardShell from the exact same internal
 *  state — swapping components entirely on a mode change would lose that
 *  state, since React remounts (and re-initializes) a new component
 *  instance whenever the element type at a given position changes. */
export function MiniTileShell({
  title,
  description,
  details,
  isActive = true,
  onActivate,
  density,
  reorderEditing = false,
  favorited = false,
  onToggleFavorite,
  cardHidden = false,
  onToggleHidden,
  dragControls,
  detailsOpen = false,
  onDetailsOpenChange,
  onOpenDetails,
  stickyTop = 0,
  toolbarHeight = 0,
  children,
  actions,
}: MiniTileShellProps) {
  const articleRef = useRef<HTMLElement | null>(null);
  const large = density === "large";

  return (
    <article
      ref={articleRef}
      onClick={onActivate}
      className={cn(
        "relative aspect-square w-full flex flex-col overflow-hidden bg-card text-card-foreground transition-all duration-200",
        large ? "rounded-[18px] p-3.5 gap-2" : "rounded-[14px] p-2.5 gap-1.5",
        isActive
          ? "border-2 border-blue-400/80 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.25)]"
          : "border border-stone-200 opacity-80 hover:opacity-95",
      )}
    >
      <div className="flex items-start gap-1">
        <h2
          className={cn(
            // A 2-line clamp otherwise truncates a title after only its
            // first couple of words, dropping an entire trailing word
            // ("Holds hand during..." losing "transition" outright) rather
            // than actually needing a third line's worth of room. Large
            // tiles have that room to spare (confirmed — a third line
            // there still leaves the body's own content full-size); small
            // tiles don't — their body content (e.g. the bubble strip's own
            // circles) has so little vertical slack already that a third
            // title line squeezes it down to an illegible sliver, which is
            // worse than the truncation it would avoid. So only large gets
            // the taller clamp; small keeps 2 lines, with a bit of its own
            // reserved padding clawed back instead to fit a little more of
            // each line before it has to truncate at all.
            "font-display font-bold leading-[0.82] flex-1",
            large ? "text-[13px] pr-5 line-clamp-3" : "text-[10.5px] pr-4 line-clamp-2",
          )}
        >
          {title}
        </h2>
        {reorderEditing ? (
          <MiniEditControls
            favorited={favorited}
            onToggleFavorite={onToggleFavorite ?? (() => {})}
            cardHidden={cardHidden}
            onToggleHidden={onToggleHidden ?? (() => {})}
            dragControls={dragControls}
            large={large}
          />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails?.();
            }}
            aria-label="Card details"
            className={cn(
              "absolute grid place-items-center rounded-full border border-current text-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0",
              large ? "top-2.5 right-2.5 size-5" : "top-1.5 right-1.5 size-4",
            )}
          >
            <DetailsIcon className={large ? "size-3" : "size-2.5"} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {isActive && (
        <DataDetailsDrawer
          open={detailsOpen}
          onOpenChange={onDetailsOpenChange ?? (() => {})}
          // Tiles keep their own grid's normal per-column width when the
          // drawer opens (see index.tsx's `stackToLeftColumn`) rather than
          // the pane compressing — so a fixed widthClassName guess can't
          // reliably reach exactly this tile's own right edge the way it
          // can for card/list's more predictable half-viewport split.
          // hugCardRight measures the real thing instead.
          hugCardRight
          title={title}
          description={description}
          details={details}
          top={stickyTop}
          toolbarHeight={toolbarHeight}
          cardRef={articleRef}
        />
      )}

      <div className="flex-1 min-h-0 min-w-0 flex flex-col items-center justify-center gap-0.5">{children}</div>

      {actions && <div className="shrink-0">{actions}</div>}
    </article>
  );
}

function MiniEditControls({
  favorited,
  onToggleFavorite,
  cardHidden,
  onToggleHidden,
  dragControls,
  large,
}: {
  favorited: boolean;
  onToggleFavorite: () => void;
  cardHidden: boolean;
  onToggleHidden: () => void;
  dragControls?: CardEditAndDrawerProps["dragControls"];
  large: boolean;
}) {
  const size = large ? "size-5" : "size-4";
  const icon = large ? "size-3" : "size-2.5";
  return (
    <div
      className="flex items-center gap-0.5 shrink-0 -mt-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={onToggleFavorite}
        aria-pressed={favorited}
        aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        className={cn("grid place-items-center rounded-full transition-colors", size, favorited ? "text-blue-500" : "text-stone-400 hover:text-stone-600")}
      >
        <Heart className={icon} fill={favorited ? "currentColor" : "none"} />
      </button>
      <button
        type="button"
        onClick={onToggleHidden}
        aria-pressed={cardHidden}
        aria-label={cardHidden ? "Unhide card" : "Hide card"}
        className={cn("grid place-items-center rounded-full transition-colors", size, cardHidden ? "text-blue-500" : "text-stone-400 hover:text-stone-600")}
      >
        <EyeOff className={icon} />
      </button>
      <span
        className={cn("cursor-grab touch-none select-none grid place-items-center rounded-full text-stone-400 hover:text-stone-600 active:cursor-grabbing", size)}
        onPointerDown={(e) => {
          e.preventDefault();
          dragControls?.start(e);
        }}
        aria-label="Drag to reorder"
      >
        <GripVertical className={icon} />
      </span>
    </div>
  );
}
