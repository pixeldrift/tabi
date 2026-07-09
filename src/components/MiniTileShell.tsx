import { useRef, type ReactNode } from "react";
import { GripVertical, Heart, EyeOff } from "lucide-react";
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
  /** 0–100 progress — a thin, color-coded bar flush to the tile's bottom
   *  edge, no label (unlike CardShell's own progress bar, which has room
   *  for helper text). Omit for kinds where a running percentage isn't
   *  meaningful (Frequency, Rate, Duration, Rating already pass `null` to
   *  CardShell for the same reason). */
  progress?: number | null;
  isComplete?: boolean;
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
  stickyTop = 0,
  toolbarHeight = 0,
  children,
  actions,
  progress,
  isComplete = false,
}: MiniTileShellProps) {
  const articleRef = useRef<HTMLElement | null>(null);
  const large = density === "large";
  const showProgress = typeof progress === "number";
  const pct = showProgress ? Math.min(100, Math.max(0, progress!)) : 0;
  const barColor = isComplete ? "bg-green-500" : pct >= 50 ? "bg-yellow-400" : "bg-blue-400";

  return (
    <article
      ref={articleRef}
      onClick={onActivate}
      className={cn(
        // Border is ALWAYS 1px — see CardShell's own version of this same
        // comment. A real border-2 on isActive shrinks the content box by
        // an extra px per side (border participates in box-sizing), nudging
        // every child inward the instant a tile is selected; an inset ring
        // (box-shadow) adds the same visual weight without consuming any
        // layout space, so nothing shifts. overflow-hidden also moved onto
        // the absolutely-positioned inner wrapper below instead of living
        // on this bordered/shadowed element — the two together were what
        // let the shadow clip into a squared-off corner instead of fading
        // past the rounded edge.
        "relative aspect-square w-full bg-card text-card-foreground transition-all duration-200",
        large ? "rounded-[18px]" : "rounded-[14px]",
        isActive
          ? "border border-blue-400/80 ring-2 ring-inset ring-blue-400/80 shadow-[0_6px_18px_-6px_rgba(0,0,0,0.25)]"
          : "border border-stone-200 opacity-80 hover:opacity-95",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 flex flex-col overflow-hidden",
          large ? "rounded-[18px]" : "rounded-[14px]",
        )}
      >
      <div
        className={cn(
          // relative z-10: keeps this in-flow content painting above the
          // progress bar below, which is an absolutely positioned
          // background wash now rather than a layout sibling this wrapper
          // shrinks to make room for — see that div's own comment.
          "relative z-10 flex-1 min-h-0 flex flex-col",
          large ? "p-3.5 gap-2" : "p-2.5 gap-1.5",
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
            // the taller clamp; small keeps 2 lines. No reserved right-side
            // padding here anymore — that was only clearing space for the
            // per-tile details button (removed; the drawer's own pull-tab
            // is the one way to open it now), so the title gets that width
            // back.
            "font-display font-bold flex-1",
            // leading-[…] MUST come after text-[…] here — tailwind-merge
            // treats an arbitrary text-size and leading as the same
            // conflict group (real Tailwind size utilities like text-sm
            // bundle their own line-height), so whichever comes LAST in
            // the merged string wins the whole group. With leading first,
            // it was silently discarded and this was rendering at the
            // browser's ~1.5x default the entire time.
            // 1.05 (matching Card/List's own ratio) still clips descenders
            // here specifically — line-clamp hard-caps the box at exactly
            // lines × line-height with no allowance for glyph overhang,
            // unlike Card/List's plain wrapping text (no line-clamp, so an
            // ascender/descender bleeding a hair past the line box just
            // renders — there's no hard edge there to clip against). 1.2
            // gives real headroom for that overhang without reading as
            // loose.
            large ? "text-[13px] line-clamp-3 leading-[1.2]" : "text-[10.5px] line-clamp-2 leading-[1.2]",
          )}
        >
          {title}
        </h2>
        {reorderEditing && (
          <MiniEditControls
            favorited={favorited}
            onToggleFavorite={onToggleFavorite ?? (() => {})}
            cardHidden={cardHidden}
            onToggleHidden={onToggleHidden ?? (() => {})}
            dragControls={dragControls}
            large={large}
          />
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
      </div>

      {/* A background wash behind the tile's own content (z-10 above, see
          that wrapper's comment) rather than a layout sibling it shrinks to
          make room for — so scoring a trial doesn't nudge everything else
          up a few px. Skinnier than CardShell's own labeled version since
          there's no helper text to make room for. Inset from the edges
          (rather than flush corner-to-corner) and rounded-full so it reads
          as sitting inside the tile's own border instead of touching/
          merging into it — most visible once a selected tile's ring makes
          that border more prominent. Only rendered where a running
          percentage is meaningful for the data type (Trial, Task Analysis);
          Frequency/Rate/Duration/Rating pass no `progress`. */}
      {showProgress && (
        <div className="absolute inset-x-2 bottom-1 z-0 h-0.5 rounded-full overflow-hidden bg-stone-200/80">
          <div
            className={cn("h-full transition-[width]", barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      </div>
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
