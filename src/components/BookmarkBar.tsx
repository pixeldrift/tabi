import { Bookmark, Frown, X } from "lucide-react";
import { BookmarkChip } from "./BookmarkChip";
import { HORIZONTAL_FADE_MASK } from "./TimestampCard";
import { useDataToolbar } from "./DataToolbarContext";
import { useSettings } from "./SettingsContext";
import { cn } from "@/lib/utils";
import type { CardConfig } from "@/routes/index";

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
  // Reorder-editing and "quick-score from the shelf" are competing modes
  // for the same moment (dragging a tile while the shelf keeps trying to
  // register taps underneath it), so the bar steps aside entirely while
  // editMode is on rather than trying to coexist with it.
  if (!bookmarkBarVisible || editMode) return null;

  const isFavorites = bookmarkBarMode === "favorites";
  const cards = isFavorites ? favoriteCards : interferingCards;

  return (
    <div data-bookmark-bar className="border-t border-border/70 bg-stone-50/70 px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => setBookmarkBarMode(isFavorites ? "interfering" : "favorites")}
          aria-label={
            isFavorites
              ? "Showing favorites — switch to interfering behaviors"
              : "Showing interfering behaviors — switch to favorites"
          }
          title={isFavorites ? "Favorites" : "Interfering behaviors"}
          className="grid place-items-center size-7 shrink-0 rounded-full border border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors"
        >
          {isFavorites ? <Bookmark className="size-3.5" /> : <Frown className="size-3.5" />}
        </button>

        {cards.length === 0 ? (
          <p className="flex-1 min-w-0 px-2 py-4 text-center text-xs text-muted-foreground">
            {isFavorites
              ? "No favorites yet — tap the bookmark icon on a card to add one."
              : "No interfering behaviors in this list."}
          </p>
        ) : (
          <div
            className={cn("flex-1 min-w-0 flex gap-1.5 overflow-x-auto no-scrollbar py-1")}
            style={HORIZONTAL_FADE_MASK}
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
