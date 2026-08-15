import { useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  const { bookmarkBarMode, setBookmarkBarMode, editMode, setEditMode } = useDataToolbar();
  const { bookmarkBarVisible, setBookmarkBarVisible } = useSettings();
  // Only flips (not tracked continuously) so this doesn't re-render on
  // every scroll tick — just the two moments that actually change which
  // mask applies: leaving position 0, and (on a reset/re-favorite) landing
  // back on it. Reset on every mode switch (below) — favorites and
  // interfering are separate scroll containers (each mode's chip strip is
  // its own fresh DOM node under the AnimatePresence swap further down),
  // so a leftover "scrolled" flag from whichever strip was showing before
  // would otherwise paint the WRONG edge mask on the new one until the
  // user scrolls it themselves.
  const [scrolledFromStart, setScrolledFromStart] = useState(false);
  // Reorder-editing and "quick-score from the shelf" are competing modes
  // for the same moment (dragging a tile while the shelf keeps trying to
  // register taps underneath it), so the bar steps aside entirely while
  // editMode is on rather than trying to coexist with it — folded into the
  // same `visible` the open/close setting drives, so entering/leaving edit
  // mode gets the same slide the manual toggle does instead of an abrupt
  // pop.
  const visible = bookmarkBarVisible && !editMode;

  // Measured (not the literal string "auto") for the same reason
  // StatusBar's own boxNaturalHeight/miniSlotHeight are — Motion's own
  // "auto" resolution can settle at a mid-transition value and re-measure
  // out from under itself (here, e.g., an empty-state height replaced by a
  // chip row's height as favorites fills in), which reads as a bounce
  // instead of one smooth run to the real target. A ResizeObserver-driven
  // pixel number doesn't have that problem, and it doubles as the ongoing
  // remeasure this needs anyway: switching between favorites/interfering
  // can itself change this box's natural height (a chip row vs. the
  // shorter empty-state message), and the observer picks that up the same
  // way it picks up the open/close transition.
  const barContentRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState<number | null>(null);
  // Keyed on `visible`, not `[]` — the ref's own element unmounts along
  // with the rest of the bar's content while hidden (see the
  // AnimatePresence below), so the observer needs to be torn down and
  // reattached to the fresh node each time the bar reopens rather than
  // staying latched onto a detached one.
  useLayoutEffect(() => {
    if (!visible) return;
    const el = barContentRef.current;
    if (!el) return;
    const measure = () => setBarHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible]);

  const isFavorites = bookmarkBarMode === "favorites";
  const cards = isFavorites ? favoriteCards : interferingCards;

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          key="bookmark-bar"
          data-bookmark-bar
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: barHeight ?? "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden border-t border-border/70 bg-stone-50/70"
        >
          <div ref={barContentRef} className="px-2.5 py-1.5">
            <div className="flex items-start gap-1.5 max-w-3xl mx-auto">
              {/* Both source lists stay visible as a two-option segmented
               *  control (same rounded-pill-of-circular-buttons idiom as
               *  the main toolbar's own view-mode toggle) rather than one
               *  button that cycles — there's room for both, and it reads
               *  which mode is active (and that a second one exists at
               *  all) at a glance instead of only after tapping. Stacked
               *  vertically (not side by side) — horizontal space here is
               *  what's actually scarce, since every px this toggle
               *  claims is a px the chip strip doesn't get; stacking
               *  trades that for height the row already has spare,
               *  bounded by whatever the tallest chip's own 2-line title
               *  needs. */}
              <div
                data-tour="bookmark-bar-mode-toggle"
                className="flex flex-col items-center rounded-full border border-stone-200 bg-stone-100/60 p-0.5 shrink-0"
              >
                <button
                  type="button"
                  onClick={() => {
                    setScrolledFromStart(false);
                    setBookmarkBarMode("favorites");
                  }}
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
                  onClick={() => {
                    setScrolledFromStart(false);
                    setBookmarkBarMode("interfering");
                  }}
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

              {/* Favorites is the toggle's TOP option, interfering its
               *  BOTTOM one, so the swap between them plays out on that
               *  same axis: switching to interfering slides the favorites
               *  content up and out while interfering rises in from
               *  below (matching the toggle's own top-to-bottom order),
               *  and switching back reverses it — favorites slides back
               *  down from above as interfering exits downward. Each
               *  mode's own enter/exit offset is a fixed constant tied to
               *  ITS identity (favorites always "-100%", interfering
               *  always "100%"), not to which direction the transition
               *  happens to be running — so, unlike a plain
               *  forward/backward toggle, this needs no separate
               *  direction state to stay correct: whichever element is
               *  animating, entering or exiting, was rendered with
               *  `bookmarkBarMode` already equal to its own key, so it
               *  always resolves to the same offset regardless of
               *  transition history. `popLayout` lets the exiting mode's
               *  strip carry on scrolling out of flow while the entering
               *  one immediately claims layout space, instead of both
               *  fighting over it mid-swap. */}
              <div className="relative flex-1 min-w-0 overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={bookmarkBarMode}
                    initial={{ y: isFavorites ? "-100%" : "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: isFavorites ? "-100%" : "100%", opacity: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  >
                    {cards.length === 0 ? (
                      <p className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                        {isFavorites ? (
                          <>
                            Use{" "}
                            <button
                              type="button"
                              onClick={() => setEditMode(true)}
                              className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground"
                            >
                              Edit
                              <Pencil className="inline-block size-3 -translate-y-px" aria-hidden />
                            </button>{" "}
                            mode to add your own bookmarks.
                          </>
                        ) : (
                          "No interfering behaviors in this list."
                        )}
                      </p>
                    ) : (
                      <div
                        className="flex gap-1.5 overflow-x-auto no-scrollbar py-1"
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
                  </motion.div>
                </AnimatePresence>
              </div>

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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
