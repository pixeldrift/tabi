import { useState } from "react";
import { Bookmark, Frown, Pencil, X } from "lucide-react";
import { BookmarkChip } from "./BookmarkChip";
import { HORIZONTAL_FADE_MASK } from "./TimestampCard";
import { useDataToolbar } from "./DataToolbarContext";
import { useSettings } from "./SettingsContext";
import { cn } from "@/lib/utils";
import type { CardConfig } from "@/routes/index";

// HORIZONTAL_FADE_MASK fades both edges — right for TimestampCard's own
// centered carousel, where either direction can always have more content.
// The bar's strip isn't like that: it starts pinned at scrollLeft 0, right
// up against the corner toggle, so a left fade there would feather the
// very first chip even though there's nothing further left to reveal.
// This is the same right-only fade with the left edge left fully opaque —
// swapped in below only until the strip has actually been scrolled away
// from that starting position, at which point the left edge legitimately
// has hidden chips behind it again and gets the normal two-edge mask back.
const RIGHT_EDGE_FADE_MASK = {
  WebkitMaskImage: "linear-gradient(to right, black 0%, black 94%, transparent 100%)",
  maskImage: "linear-gradient(to right, black 0%, black 94%, transparent 100%)",
};

export interface BookmarkBarProps {
  /** Already ordered (see routes/index.tsx's getOrderedCards) — this
   *  component never re-sorts or re-filters, it just picks which of the
   *  two lists to render based on the corner toggle's own mode. */
  favoriteCards: CardConfig[];
  interferingCards: CardConfig[];
  /** Ids currently in the main list's own visibleCards — a card missing
   *  from this set is genuinely unmounted (filtered out), not just
   *  scrolled off-screen, since the Data tab's list isn't virtualized. Only
   *  Duration's chip cares (see BookmarkChip's DurationChip). */
  mountedIds: Set<string>;
  /** The main list's own activeId — shared, not a separate "which chip is
   *  selected" state, so a chip and its real card always agree on which
   *  one is highlighted and which one's drawer content is showing. */
  activeId: string;
  /** Sets activeId without scrolling the main list — see routes/index.tsx's
   *  own comment on why plain setActiveId needs a scroll-suppressing
   *  wrapper for taps that originate from the bar. */
  onSelectCard: (id: string) => void;
  /** Scrolls the main list to and activates the given card — the same
   *  handleNavigateToCard used by notifications' own "View Card". */
  onJumpToCard: (id: string) => void;
}

/** The pinned shelf itself — docked inside DataToolbar's own children slot
 *  (see routes/index.tsx) so its height is automatically absorbed into
 *  every drawer offset that measures the whole [data-toolbar] box. Three
 *  ways to close it, all sharing one `bookmarkBarVisible` setting: the
 *  inline X here, DataToolbar's own persistent reopen icon, and the
 *  Settings switch (see SettingsPane.tsx) — this component only ever reads
 *  and writes that one value, same as the other two. */
export function BookmarkBar({
  favoriteCards,
  interferingCards,
  mountedIds,
  activeId,
  onSelectCard,
  onJumpToCard,
}: BookmarkBarProps) {
  const { bookmarkBarMode, setBookmarkBarMode, editMode } = useDataToolbar();
  const { bookmarkBarVisible, setBookmarkBarVisible } = useSettings();
  // Only flips (not tracked continuously) so this doesn't re-render on
  // every scroll tick — just the two moments that actually change which
  // mask applies: leaving position 0, and (on a reset/re-favorite) landing
  // back on it.
  const [scrolledFromStart, setScrolledFromStart] = useState(false);
  // Reorder-editing and "quick-score from the shelf" are competing modes
  // for the same moment (dragging a tile while the shelf keeps trying to
  // register taps underneath it), so the bar steps aside entirely while
  // editMode is on rather than trying to coexist with it.
  if (!bookmarkBarVisible || editMode) return null;

  const isFavorites = bookmarkBarMode === "favorites";
  const cards = isFavorites ? favoriteCards : interferingCards;

  return (
    <div data-bookmark-bar className="border-t border-border/70 bg-stone-50/70 px-2.5 py-1.5">
      <div className="flex items-start gap-1.5 max-w-3xl mx-auto">
        {/* Both source lists stay visible as a two-option segmented control
         *  (same rounded-pill-of-circular-buttons idiom as the main
         *  toolbar's own view-mode toggle) rather than one button that
         *  cycles — there's room for both, and it reads which mode is
         *  active (and that a second one exists at all) at a glance
         *  instead of only after tapping. */}
        <div className="flex items-center rounded-full border border-stone-200 bg-stone-100/60 p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setBookmarkBarMode("favorites")}
            aria-pressed={isFavorites}
            aria-label="Show favorites"
            title="Favorites"
            className={cn(
              "grid place-items-center size-6 rounded-full transition-colors",
              isFavorites
                ? "btn-bevel bg-blue-500 text-white"
                : "text-stone-400 hover:text-stone-600",
            )}
          >
            <Bookmark className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setBookmarkBarMode("interfering")}
            aria-pressed={!isFavorites}
            aria-label="Show interfering behaviors"
            title="Interfering behaviors"
            className={cn(
              "grid place-items-center size-6 rounded-full transition-colors",
              !isFavorites
                ? "btn-bevel bg-blue-500 text-white"
                : "text-stone-400 hover:text-stone-600",
            )}
          >
            <Frown className="size-3.5" />
          </button>
        </div>

        {cards.length === 0 ? (
          <p className="flex-1 min-w-0 px-2 py-1.5 text-center text-xs text-muted-foreground">
            {isFavorites ? (
              <>
                Nothing bookmarked. Use Edit Mode{" "}
                <Pencil className="inline-block size-3 -translate-y-px" aria-hidden /> to add your
                own.
              </>
            ) : (
              "No interfering behaviors in this list."
            )}
          </p>
        ) : (
          <div
            className={cn("flex-1 min-w-0 flex gap-1.5 overflow-x-auto no-scrollbar py-1")}
            style={scrolledFromStart ? HORIZONTAL_FADE_MASK : RIGHT_EDGE_FADE_MASK}
            onScroll={(e) => {
              const next = e.currentTarget.scrollLeft > 0;
              setScrolledFromStart((prev) => (prev === next ? prev : next));
            }}
          >
            {cards.map((card) => (
              <BookmarkChip
                key={card.id}
                card={card}
                mounted={mountedIds.has(card.id)}
                active={card.id === activeId}
                onSelect={() => onSelectCard(card.id)}
                onJumpToCard={() => onJumpToCard(card.id)}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setBookmarkBarVisible(false)}
          aria-label="Close bookmark bar"
          className="grid place-items-center size-6 shrink-0 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
