import { createFileRoute } from "@tanstack/react-router";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, LayoutGroup, Reorder, useDragControls, type DragControls } from "motion/react";
import { User } from "lucide-react";
import { TrialCard } from "@/components/TrialCard";
import { FrequencyCard } from "@/components/FrequencyCard";
import { RateCard } from "@/components/RateCard";
import { DurationCard } from "@/components/DurationCard";
import { TaskAnalysisCard } from "@/components/TaskAnalysisCard";
import { RatingCard } from "@/components/RatingCard";
import { ScheduleView } from "@/components/ScheduleView";
import { SessionProvider, useSession, PILL_LAND_MS, type TransitionKind } from "@/components/SessionContext";
import { SettingsProvider, useSettings } from "@/components/SettingsContext";
import { SettingsPane } from "@/components/SettingsPane";
import { StatusBar, type StatusTab } from "@/components/StatusBar";
import { NotificationProvider } from "@/components/NotificationContext";
import { NOTIFICATION_AREA_TRANSITION } from "@/components/NotificationBar";
import { useStickyTop } from "@/hooks/use-sticky-top";
import { useElementHeight } from "@/hooks/use-element-height";
import { DataToolbar } from "@/components/DataToolbar";
import {
  DataToolbarProvider,
  useDataToolbar,
  type CardKind,
  type DataToolbarFilters,
  type DisplayMode,
} from "@/components/DataToolbarContext";
import { CardDataStoreProvider } from "@/components/CardDataStore";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Data collection — multi-format demo" },
      {
        name: "description",
        content:
          "Demo of consistent cards for collecting % correct, frequency, rate, duration, and task analysis data.",
      },
    ],
  }),
  component: Index,
});

// `id` is intersected onto every variant rather than repeated per-branch —
// stable identity for drag-reorder, favoriting, hiding, and active-card
// tracking, independent of array position (which filtering/reordering
// otherwise makes an unreliable key).
type CardConfig = { id: string; behaviorRole?: "interfering" } & (
  | {
      kind: "trial";
      title: string;
      phase: string;
      description: string;
      minTrials: number;
      maxTrials?: number;
      /** Adds a third, neutral "No Response" option between Error and Correct. */
      noResponse?: boolean;
      /** Error becomes a picker for these prompt levels instead of a plain toggle. */
      promptLevels?: string[];
    }
  | { kind: "frequency"; title: string; phase: string; description: string; minCount: number }
  | { kind: "rate"; title: string; phase: string; description: string; minDurationSec: number; locked?: boolean }
  | { kind: "duration"; title: string; phase: string; description: string; minDurationSec: number }
  | { kind: "task-analysis"; title: string; phase: string; description: string; steps: string[] }
  | {
      kind: "rating";
      title: string;
      phase: string;
      description: string;
      min?: number;
      max: number;
      levelDescriptions?: string[];
    }
);

const cards: CardConfig[] = [
  {
    id: "holds-hand-transition",
    kind: "trial",
    title: "Holds hand during transition",
    phase: "Intervention",
    description:
      "Score correct if the learner reaches for and maintains hand-hold from the start of the transition through arrival at the destination.",
    minTrials: 5,
  },
  {
    id: "requests-preferred-item",
    kind: "trial",
    title: "Requests preferred item",
    phase: "Baseline",
    description:
      "Score correct if the learner independently requests using a full phrase within 5 seconds of the item being visible. Score No Response if the learner does not attempt within the window.",
    minTrials: 8,
    noResponse: true,
  },
  {
    id: "follows-one-step-direction",
    kind: "trial",
    title: "Follows one-step direction",
    phase: "Probing",
    description:
      "Score correct if the learner completes the direction independently. If an error occurs, record the least-to-most prompt level required.",
    minTrials: 8,
    promptLevels: ["Verbal", "Gestural", "Modeling", "Partial Physical", "Full Physical"],
  },
  {
    id: "giggles-laughs",
    kind: "frequency",
    title: "Giggles/laughs during therapist-led play",
    phase: "Intervention",
    description: "Tally each instance the learner giggles or laughs during therapist-led play.",
    minCount: 5,
  },
  {
    id: "flopping-dropping",
    kind: "rate",
    title: "Flopping/dropping to floor",
    behaviorRole: "interfering",
    phase: "Baseline",
    description:
      "During a timed observation, tally each flop/drop. Rate is reported as occurrences per minute.",
    minDurationSec: 60,
  },
  {
    id: "uses-aac-to-request",
    kind: "rate",
    title: "Uses AAC to request",
    phase: "Maintenance",
    description: "Tally each independent AAC request. This timer is linked to the session timer.",
    minDurationSec: 60,
    locked: true,
  },
  {
    id: "property-destruction-throwing",
    kind: "frequency",
    title: "Property destruction/throwing",
    behaviorRole: "interfering",
    phase: "Baseline",
    description:
      "Tally each instance the learner throws or destroys property, including books, toys, or furniture.",
    minCount: 3,
  },
  {
    id: "self-injury-banging-head",
    kind: "rate",
    title: "Self Injury/Banging Head",
    behaviorRole: "interfering",
    phase: "Intervention",
    description:
      "During a timed observation, tally each head-banging instance. Rate is reported as occurrences per minute.",
    minDurationSec: 60,
  },
  {
    id: "tantruming",
    kind: "duration",
    title: "Tantruming",
    behaviorRole: "interfering",
    phase: "Intervention",
    description:
      "Track each tantrum instance separately. Start a new instance with the plus button; pause/resume the current instance with the play/pause button.",
    minDurationSec: 30,
  },
  {
    id: "tolerates-sitting-social-group",
    kind: "duration",
    title: "Tolerates sitting in social group",
    phase: "Maintenance",
    description:
      "Track each interval the learner remains seated with the social group. Start a new instance when they rejoin.",
    minDurationSec: 60,
  },
  {
    id: "washing-hands",
    kind: "task-analysis",
    title: "Washing hands",
    phase: "Probing",
    description: "Score each step as Independent (I), Prompted (P), or Error (E).",
    steps: [
      "Turn on water",
      "Wet hands",
      "Apply soap",
      "Scrub for 20 seconds",
      "Rinse hands",
      "Turn off water",
      "Dry hands",
    ],
  },
  {
    id: "overall-session-engagement",
    kind: "rating",
    title: "Overall session engagement",
    phase: "Intervention",
    description:
      "A holistic, end-of-session quality rating capturing overall engagement and cooperation. Unlike the other cards, this is scored once — later interactions simply update the same score rather than adding new entries.",
    max: 5,
    levelDescriptions: [
      "Highly resistant; required significant redirection throughout the session.",
      "Engaged briefly; needed frequent prompts to reorient to tasks.",
      "Adequate engagement with occasional prompting.",
      "Consistently engaged with minimal prompting.",
      "Fully engaged and cooperative throughout the session.",
    ],
  },
  {
    id: "readiness-to-learn",
    kind: "rating",
    title: "Readiness to learn",
    phase: "Intervention",
    description:
      "A quick end-of-session read on how available the learner was for instruction. Same single-score behavior as Overall session engagement — later interactions update this same rating rather than adding new entries.",
    max: 3,
    levelDescriptions: [
      "Not ready — dysregulated or unresponsive to redirection for most of the session.",
      "Partially ready — needed regulation support before engaging productively.",
      "Fully ready — regulated and available for instruction from the start.",
    ],
  },
];

// Data-submitted animation timing — TODO: surface in user settings.
const DATA_SUBMIT_STAGGER_MS = 90;
const DATA_SUBMIT_ENTER_DURATION_MS = 550;
const DATA_SUBMIT_EXIT_DURATION_MS = 550;

function Index() {
  return (
    <SettingsProvider>
      <SessionProvider>
        <DataToolbarProvider>
          {/* Above the whole card list, so its store survives the per-card
              remounts that MorphContent's display-mode crossfade causes
              below it (see CardDataStore's own comment). */}
          <CardDataStoreProvider>
            <IndexInner />
          </CardDataStoreProvider>
        </DataToolbarProvider>
      </SessionProvider>
    </SettingsProvider>
  );
}

const CARD_KINDS_IN_ORDER: CardKind[] = ["trial", "frequency", "rate", "duration", "task-analysis", "rating"];

function getVisibleCards(
  order: string[],
  filters: DataToolbarFilters,
  searchQuery: string,
  favorites: Set<string>,
  hidden: Set<string>,
  hasData: Record<string, boolean>,
  completion: Record<string, boolean>,
  editMode: boolean,
): CardConfig[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const orderedIds =
    order.length > 0
      ? [...order.filter((id) => byId.has(id)), ...cards.map((c) => c.id).filter((id) => !order.includes(id))]
      : cards.map((c) => c.id);
  const ordered = orderedIds.map((id) => byId.get(id)).filter((c): c is CardConfig => c !== undefined);

  const q = searchQuery.trim().toLowerCase();
  return ordered.filter((card) => {
    // Hidden cards mirror After Effects' shy layers: they stay visible while
    // editing (so there's a way to find and un-hide them) but otherwise only
    // show when the "Show hidden" filter is on.
    if (!editMode && hidden.has(card.id) && !filters.showHidden) return false;
    if (filters.favoritesOnly && !favorites.has(card.id)) return false;
    if (filters.kinds.size > 0 && !filters.kinds.has(card.kind)) return false;
    if (filters.phases.size > 0 && !filters.phases.has(card.phase)) return false;
    // Each pair below is two independent toggles, not a mutually exclusive
    // choice — selecting both or neither applies no constraint (show all).
    if (filters.withData !== filters.noData) {
      if (filters.withData && !hasData[card.id]) return false;
      if (filters.noData && hasData[card.id]) return false;
    }
    if (filters.trialsReached !== filters.incompleteTrials) {
      if (filters.trialsReached && !completion[card.id]) return false;
      if (filters.incompleteTrials && completion[card.id]) return false;
    }
    if (filters.behaviorFilter !== "both") {
      const role = card.behaviorRole ?? "target";
      if (role !== filters.behaviorFilter) return false;
    }
    if (q && !card.title.toLowerCase().includes(q)) return false;
    return true;
  });
}

// Native `scrollIntoView({block: "center"})` centers an element against the
// FULL viewport, with no notion of the sticky status bar + data toolbar
// (and, when idle, the "Start session" banner inside it) covering the top
// of it — headerHeight px are visually spoken for whether or not the
// browser knows it. That's the gap: idle and running headers are different
// heights, so a naive center leaves the card's own top/title tucked behind
// the sticky header in whichever state has the taller one. Centering
// within the space actually left below the header fixes both, and the
// clamp keeps a card taller than that space from having its own top
// (title) pushed up out of view in the process.
function scrollActiveCardIntoView(el: HTMLElement, headerHeight: number) {
  const rect = el.getBoundingClientRect();
  const availableHeight = window.innerHeight - headerHeight;
  const desiredCenterY = headerHeight + availableHeight / 2;
  const currentCenterY = rect.top + rect.height / 2;
  const maxDelta = rect.top - headerHeight;
  const delta = Math.min(currentCenterY - desiredCenterY, maxDelta);
  window.scrollBy({ top: delta, behavior: "smooth" });
}

// The default (setting off) counterpart to scrollActiveCardIntoView above —
// same headerHeight-aware math (native `scrollIntoView({block:"nearest"})`
// has the identical blind spot to `"center"`: it doesn't know the sticky
// header is eating into the true visible area), but only the minimum nudge
// needed to bring a partially-hidden card fully on screen, not a forced
// recenter. A no-op if the card's already fully visible.
function scrollCardFullyIntoView(el: HTMLElement, headerHeight: number) {
  const rect = el.getBoundingClientRect();
  const visibleTop = headerHeight;
  const visibleBottom = window.innerHeight;
  if (rect.top >= visibleTop && rect.bottom <= visibleBottom) return;
  // Taller than the room available below the header — no scroll amount can
  // satisfy both edges, so just lead with the top (matches how a browser's
  // own "nearest" falls back when the target doesn't fit either).
  if (rect.height > visibleBottom - visibleTop || rect.top < visibleTop) {
    window.scrollBy({ top: rect.top - visibleTop, behavior: "smooth" });
  } else if (rect.bottom > visibleBottom) {
    window.scrollBy({ top: rect.bottom - visibleBottom, behavior: "smooth" });
  }
}

const DISPLAY_MODE_GRID_CLASSES: Record<DisplayMode, string> = {
  // Tighter than card's gap-3 — a condensed list reads better with its rows
  // sitting close together rather than spaced like full cards.
  list: "grid-cols-1 gap-1",
  card: "grid-cols-1 sm:grid-cols-2 gap-3",
  // Quick-action tiles are deliberately mobile-first multi-column (unlike
  // list/card's single column on narrow viewports) — the whole point is
  // fitting several at once on a phone screen, not just at sm+.
  "grid-large": "grid-cols-2 gap-2",
  "grid-small": "grid-cols-3 gap-1.5",
};

function IndexInner() {
  const [activeId, setActiveId] = useState<string>(cards[0].id);
  const [tab, setTab] = useState<StatusTab>("data");
  const [scheduleScrollId, setScheduleScrollId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { status, transitionStage, transitionKind } = useSession();
  // Paused counts as "active" too — a session still exists, it's just not
  // ticking. Gating this on "running" alone flashed the "Start session to
  // record data" banner and dimmed every card each time a session was
  // paused (only "idle" should read as no active session), which is what
  // was producing the tab/content-pane "bounce" on pause: the banner
  // sliding in and the cards dropping to half-opacity added an extra,
  // unrelated layout shift on top of the box's own expand animation.
  const sessionActive = status !== "idle";
  const stickyTop = useStickyTop();
  // The shared details drawer starts at stickyTop (the toolbar's own top)
  // so it slides out on top of the toolbar, not just the pane below it —
  // see DataDetailsDrawer. toolbarHeight is measured separately (rather
  // than measuring the toolbar's absolute position directly) since the
  // toolbar's own `top` can shift for reasons (status bar height changing)
  // that a resize observer on the toolbar itself wouldn't catch.
  const toolbarHeight = useElementHeight("[data-toolbar]");
  const { keepActiveCardCentered } = useSettings();
  const {
    displayMode,
    editMode,
    searchQuery,
    filters,
    favorites,
    toggleFavorite,
    hidden,
    toggleHidden,
    order,
    setOrder,
    hasData,
    completion,
  } = useDataToolbar();

  const availableKinds = useMemo(
    () => CARD_KINDS_IN_ORDER.filter((k) => cards.some((c) => c.kind === k)),
    [],
  );
  const availablePhases = useMemo(() => Array.from(new Set(cards.map((c) => c.phase))), []);

  const visibleCards = useMemo(
    () => getVisibleCards(order, filters, searchQuery, favorites, hidden, hasData, completion, editMode),
    [order, filters, searchQuery, favorites, hidden, hasData, completion, editMode],
  );

  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  // The actual signal fed to DataDetailsDrawer's `open` (distinct from
  // `drawerOpen`, which drives the tile reflow in DataCardList) — for the
  // two grid modes, delayed until the reflow triggered by `drawerOpen` has
  // actually settled. Sequencing it this way means DataDetailsDrawer only
  // ever has to measure the target tile's position once (it's already at
  // its final spot by the time the drawer starts sliding), instead of
  // polling every frame to chase a still-moving target — that polling was
  // fighting the drawer's own spring for frames and reading as sluggish/
  // jerky. Card/list modes don't reflow on open, so there's nothing to wait
  // for there.
  const isGridDisplayMode = displayMode === "grid-large" || displayMode === "grid-small";
  const [drawerSlideOpen, setDrawerSlideOpen] = useState(false);
  const drawerSlideTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    window.clearTimeout(drawerSlideTimeoutRef.current ?? undefined);
    if (!drawerOpen) {
      setDrawerSlideOpen(false);
      return;
    }
    if (!isGridDisplayMode) {
      setDrawerSlideOpen(true);
      return;
    }
    drawerSlideTimeoutRef.current = window.setTimeout(() => {
      setDrawerSlideOpen(true);
      // The reflow just collapsed every tile into a single left column,
      // which can shift the active tile to a completely different row —
      // bring it back into view now that it's settled (respecting the same
      // centered-vs-gentle choice as the effect below), rather than leaving
      // it wherever the reflow happened to land it.
      const el = cardRefs.current.get(activeId);
      if (el) {
        if (keepActiveCardCentered) scrollActiveCardIntoView(el, stickyTop + toolbarHeight);
        else scrollCardFullyIntoView(el, stickyTop + toolbarHeight);
      }
    }, CARD_MORPH_TRANSITION.duration * 1000 + 50);
    return () => window.clearTimeout(drawerSlideTimeoutRef.current ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen, isGridDisplayMode]);

  // Keep the active card centered whenever it's selected (opt-in — see the
  // Settings tab's "Keep active card centered" toggle) and, unconditionally,
  // whenever the display mode changes — switching from a single column to a
  // multi-column grid reflows every card's position, so without this the
  // active one can silently scroll off screen. With the setting off, still
  // gently nudge a partially-hidden active card fully into view (but never
  // force a full recenter) — becoming active shouldn't leave half of it
  // tucked behind the header or hanging off the bottom of the screen.
  useEffect(() => {
    const el = cardRefs.current.get(activeId);
    if (!el) return;
    if (keepActiveCardCentered) scrollActiveCardIntoView(el, stickyTop + toolbarHeight);
    else scrollCardFullyIntoView(el, stickyTop + toolbarHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, keepActiveCardCentered]);

  // The effect above doesn't actually cover a display-mode switch — its own
  // dependency array only watches activeId/keepActiveCardCentered, so a
  // pure mode change (same active card, same setting) never re-checks
  // visibility. The scroll-anchor effect below only stops the active card
  // from silently drifting mid-morph; it doesn't guarantee the reflowed
  // result lands anywhere visible. Delayed to match CARD_MORPH_TRANSITION
  // (same settle window used elsewhere, e.g. the drawer-slide effect above)
  // so this doesn't fight that anchor's own scroll compensation while it's
  // still running.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const el = cardRefs.current.get(activeId);
      if (!el) return;
      if (keepActiveCardCentered) scrollActiveCardIntoView(el, stickyTop + toolbarHeight);
      else scrollCardFullyIntoView(el, stickyTop + toolbarHeight);
    }, CARD_MORPH_TRANSITION.duration * 1000 + 50);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMode]);

  // Anchors the active card's on-screen top position while the display mode
  // switches — cards above it are mid-flight through their own MorphContent
  // height animation, which would otherwise silently drift the active card
  // up/down underneath the user for the whole transition. This runs after
  // every render (no dependency array) so activeTopRef always holds the
  // active card's PREVIOUS position by the time a mode switch's own commit
  // fires — a `useLayoutEffect` scoped just to `[displayMode]` would still
  // measure the card AFTER that commit's own instant reflow already
  // happened, one frame too late to correct before paint. A short
  // requestAnimationFrame loop then keeps canceling further drift for the
  // rest of the morph's duration rather than only correcting once at the
  // end. Switching to a more condensed mode can shrink the page's total
  // height by more than the user's current scroll offset, so the browser
  // clamps scrollY on its own the instant that happens — fighting that
  // clamp frame-by-frame is what produced a worse jump than doing nothing,
  // so a temporary bottom padding pads the page out for the duration of the
  // transition, guaranteeing there's always room to scroll to hold the
  // anchor, then it's removed once the morph settles.
  // Suppresses each card wrapper's own `layout="position"` specifically
  // during a mode-switch's morph — that prop exists to smoothly reposition
  // cards when siblings are added/removed elsewhere (filtering, submit,
  // discard), but during a mode switch its own FLIP-based repositioning
  // fights the scroll anchor above, since both are independently trying to
  // keep the active card visually in the same spot — competing over the
  // same handful of frames produced a worse, jittery result than either
  // alone. Derived synchronously during render (not in an effect) so it
  // takes effect on the very same commit the mode switch itself lands on.
  const [prevModeForLayout, setPrevModeForLayout] = useState(displayMode);
  const [suppressCardLayout, setSuppressCardLayout] = useState(false);
  if (displayMode !== prevModeForLayout) {
    setPrevModeForLayout(displayMode);
    setSuppressCardLayout(true);
  }
  useEffect(() => {
    if (!suppressCardLayout) return;
    const t = setTimeout(() => setSuppressCardLayout(false), CARD_MORPH_TRANSITION.duration * 1000 + 50);
    return () => clearTimeout(t);
  }, [suppressCardLayout]);

  const activeTopRef = useRef<number | null>(null);
  const prevDisplayModeRef = useRef(displayMode);
  const anchorRafRef = useRef(0);
  useLayoutEffect(() => {
    const el = cardRefs.current.get(activeId);
    if (!el) return;
    const isModeSwitch = prevDisplayModeRef.current !== displayMode;
    prevDisplayModeRef.current = displayMode;

    if (isModeSwitch && activeTopRef.current !== null) {
      cancelAnimationFrame(anchorRafRef.current);
      const body = document.body;
      const prevPaddingBottom = body.style.paddingBottom;
      body.style.paddingBottom = `${window.innerHeight}px`;

      const initialDelta = el.getBoundingClientRect().top - activeTopRef.current;
      if (initialDelta !== 0) window.scrollBy(0, initialDelta);

      let anchorTop = el.getBoundingClientRect().top;
      const start = performance.now();
      const durationMs = CARD_MORPH_TRANSITION.duration * 1000 + 50;
      const tick = (now: number) => {
        const newTop = el.getBoundingClientRect().top;
        const delta = newTop - anchorTop;
        if (delta !== 0) window.scrollBy(0, delta);
        anchorTop = el.getBoundingClientRect().top;
        if (now - start < durationMs) {
          anchorRafRef.current = requestAnimationFrame(tick);
        } else {
          body.style.paddingBottom = prevPaddingBottom;
        }
      };
      anchorRafRef.current = requestAnimationFrame(tick);
    }

    activeTopRef.current = el.getBoundingClientRect().top;
  });
  useEffect(() => () => cancelAnimationFrame(anchorRafRef.current), []);

  // Which single-unit animation the card list should play, and a remount
  // key. Only start-new (fresh session) and discard (abandon in-progress
  // data) actually swap the list's content — resume/continue-previous just
  // un-fades the same cards (the `opacity-50` wrapper below, untouched by
  // any of this), and submit keeps its own separate, more elaborate
  // per-card staggered animation for now.
  const [cardsGen, setCardsGen] = useState(0);
  const [cardsAnimKind, setCardsAnimKind] = useState<"start-new" | "discard" | "submit">("start-new");

  // Stage 1 (old stuff exits) needs the card list to unmount the INSTANT
  // transitionKind is set (not one effect-tick later), so the exit and the
  // header dimming start together. `cardsHidden` stays true — keeping the
  // old key's conditional slot empty (its own slower exit animation keeps
  // playing via AnimatePresence regardless) — until the new cards actually
  // remount, which happens at a different moment per kind:
  //  - discard doesn't run the header's pill travel (the box stays open),
  //    so it remounts immediately once stage 2 commits.
  //  - start-new does run the pill travel, and resets the odometer to zero
  //    at that same instant — so its remount waits PILL_LAND_MS, until the
  //    clock has actually landed in the mini slot, instead of the new cards
  //    beating it there. See SessionContext's PILL_LAND_MS comment.
  // Both cases use React's "adjust state during render" pattern (comparing
  // against a ref of the previous value) for the instant parts, so there's
  // no one-tick lag or intermediate stale-content flash.
  const [cardsHidden, setCardsHidden] = useState(false);
  const prevKindForHideRef = useRef<TransitionKind>(null);
  if (transitionKind !== prevKindForHideRef.current) {
    prevKindForHideRef.current = transitionKind;
    if (transitionKind === "start-new" || transitionKind === "discard") {
      setCardsHidden(true);
    }
  }

  // Stage 2's own commit is itself transient — SessionContext resets
  // transitionStage/transitionKind back to 0/null well before start-new's
  // PILL_LAND_MS timeout can fire, so that reset must not be allowed to
  // cancel the pending timeout (a plain `useEffect` cleanup tied to these
  // deps would otherwise clearTimeout it the instant they revert). Guard
  // with a ref so the stage-2 entrance logic only runs once per transition,
  // and keep the timeout's clearTimeout in a separate, unmount-only effect.
  const cardEntranceTimeoutRef = useRef<number | null>(null);
  const stage2HandledRef = useRef(false);
  useEffect(() => {
    if (transitionStage === 2 && !stage2HandledRef.current) {
      stage2HandledRef.current = true;
      if (transitionKind === "discard") {
        // Wait for the old cards' own shrink-and-dissolve exit to actually
        // finish (CARD_SLIDE_EXIT_MS) instead of remounting the instant
        // stage 2 commits — discard reads as one set fully leaving before
        // the next arrives, not an overlapping relay like start-new's.
        cardEntranceTimeoutRef.current = window.setTimeout(() => {
          setCardsAnimKind("discard");
          setCardsGen((n) => n + 1);
          setCardsHidden(false);
          cardEntranceTimeoutRef.current = null;
        }, CARD_SLIDE_EXIT_MS);
      } else if (transitionKind === "start-new") {
        cardEntranceTimeoutRef.current = window.setTimeout(() => {
          setCardsAnimKind("start-new");
          setCardsGen((n) => n + 1);
          setCardsHidden(false);
          cardEntranceTimeoutRef.current = null;
        }, PILL_LAND_MS);
      }
    } else if (transitionStage !== 2) {
      stage2HandledRef.current = false;
    }
  }, [transitionStage, transitionKind]);

  useEffect(() => {
    return () => {
      if (cardEntranceTimeoutRef.current) window.clearTimeout(cardEntranceTimeoutRef.current);
    };
  }, []);

  // Submit doesn't go through the shared transition stages above (it's a
  // direct, unstaged action) — detected the same way as before, just guarded
  // against also matching discard's paused->idle transition.
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    const justSubmitted = prev === "paused" && status === "idle" && transitionKind === null;
    if (!justSubmitted) return;
    const id = window.setTimeout(() => {
      setCardsAnimKind("submit");
      setCardsGen((n) => n + 1);
    }, NOTIFICATION_AREA_TRANSITION.duration * 1000);
    return () => window.clearTimeout(id);
  }, [status, transitionKind]);

  const handleNotificationActivate = (n: { sourceRef?: { type: string; id: string } }) => {
    if (n.sourceRef?.type === "activity") {
      setTab("schedule");
      setScheduleScrollId(n.sourceRef.id);
    } else {
      setTab("notifications");
    }
  };

  return (
    <NotificationProvider onActivate={handleNotificationActivate}>
    <main className="min-h-screen bg-background">
      {/* Shared across StatusBar's tab nav and this section's panel so their
          `layout="position"` FLIPs are batched into one coordinated motion
          instead of two independent trees that can drift a frame apart —
          see LayoutGroup's docs on coordinating layout detection across
          separate components. */}
      <LayoutGroup id="session-bar">
      <StatusBar activeTab={tab} onTabChange={setTab} />

      {/* Rendered as a sibling of (not nested inside) the motion.section
          below — that section's own `layout="position"` tracking applies a
          (near-identity, but non-"none") transform, which makes it establish
          a stacking context that traps any z-index inside it. */}
      {tab === "data" && (
        <DataToolbar
          stickyTop={stickyTop}
          availableKinds={availableKinds}
          availablePhases={availablePhases}
        >
          <AnimatePresence initial={false}>
            {!sessionActive && (
              <motion.div
                key="start-session-banner"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  height: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
                  opacity: { duration: 0.25 },
                }}
                className="overflow-hidden border-t border-stone-200/70"
              >
                <motion.div
                  initial={{ y: -16 }}
                  animate={{ y: 0 }}
                  exit={{ y: -16 }}
                  transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                  className="py-1.5 px-8 text-center"
                >
                  <span className="text-sm text-muted-foreground">Start session to record data.</span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </DataToolbar>
      )}

      <motion.section
        layout="position"
        transition={{ layout: NOTIFICATION_AREA_TRANSITION }}
        className={cn(
          "px-5 pb-16 max-w-5xl mx-auto border-t border-stone-200 -mt-px",
          tab === "schedule" ? "pt-2" : tab === "data" ? "pt-0" : "pt-5",
        )}
      >
        {tab === "data" && (
          <>
          {/* -mx-2 cancels 8px of the section's px-5, so the cards sit 12px
              from the viewport edge — the same as the gap-3 between them,
              instead of the wider 20px inherited from the shared tab padding.
              The two quick-action grids get a touch less top margin than
              list/card — their own tiles already sit close under the
              toolbar with little breathing room built into the tile itself,
              so the fuller list/card margin read as an oversized gap there. */}
          {/* overflow-x-hidden: SINGLE_UNIT_VARIANTS' start-new/discard exit
              slides the whole card grid a full extra width off to the
              side — without this, that briefly inflates the document's
              scrollable width, which some mobile browsers respond to by
              rescaling the visual viewport for an instant. */}
          <div className={cn("flex flex-col items-center -mx-2 overflow-x-hidden", isGridDisplayMode ? "mt-4" : "mt-5")}>
            <div
              className={cn(
                "transition-[opacity,width] duration-300",
                !sessionActive && "opacity-50",
                // The open drawer is half the viewport wide (see
                // DataListRow/CardShell) — left-anchored and just over half
                // width itself (rather than the usual full width, centered)
                // so the cards/rows and the open drawer stay visible side by
                // side instead of the drawer covering them entirely. Card
                // mode's full-size cards are much denser than a list row,
                // though — squeezing them to the same 55% at phone widths
                // left button labels truncating and text wrapping badly, so
                // that mode only compresses at sm+ (tablet/desktop, where 55%
                // is still wide enough to hold a full card); below that the
                // drawer just overlays on top full-width instead (see
                // DataDetailsDrawer's own mobile-width default). List's rows
                // are minimal enough to compress at any width. The two
                // quick-action grids don't compress this container at all —
                // unlike a card (which is already a fixed intrinsic size
                // regardless of its grid track's own width) a tile's size
                // IS its grid track's width, so shrinking the container here
                // would shrink every tile with it. Instead their own tiles
                // stay pinned to column 1 of their normal (unchanged)
                // multi-column grid — see gridClasses/the per-card
                // `gridColumn` override below — so they keep their usual
                // size and just stack into the left column the drawer
                // doesn't cover, rather than a general-purpose "compress the
                // pane" approach.
                drawerOpen
                  ? displayMode === "card"
                    ? "w-full sm:w-[55%] sm:self-start"
                    : displayMode === "list"
                      ? "w-[55%] self-start"
                      : "w-full"
                  : "w-full",
              )}
            >
              {/* Each card's own wrapper carries `layout` (see DataCardList)
                  so switching card/list/grid morphs every box from one
                  size/shape to the other in place, rather than either
                  snapping instantly or crossfading the whole list as one
                  flat unit — that requires the wrapper to persist across
                  the switch, which an outer keyed remount here would break. */}
              <DataCardList
                cardsGen={cardsGen}
                cardsAnimKind={cardsAnimKind}
                transitionHidden={cardsHidden}
                visibleCards={visibleCards}
                activeId={activeId}
                setActiveId={setActiveId}
                cardRefs={cardRefs}
                editMode={editMode}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                hidden={hidden}
                toggleHidden={toggleHidden}
                order={order}
                setOrder={setOrder}
                displayMode={displayMode}
                suppressCardLayout={suppressCardLayout}
                drawerOpen={drawerOpen}
                drawerSlideOpen={drawerSlideOpen}
                onDrawerOpenChange={setDrawerOpen}
                stickyTop={stickyTop}
                toolbarHeight={toolbarHeight}
              />
            </div>
          </div>
          </>
        )}

        {tab === "info" && <InfoPane />}
        {tab === "schedule" && (
          <ScheduleView
            scrollTargetId={scheduleScrollId}
            onScrolledToTarget={() => setScheduleScrollId(null)}
          />
        )}
        {tab === "notifications" && <PlaceholderPane title="Alerts & announcements" description="Messages, reminders, and supervisor notes will appear here." />}
        {tab === "settings" && <SettingsPane />}
      </motion.section>
      </LayoutGroup>
    </main>
    </NotificationProvider>
  );
}

function renderCard(
  card: CardConfig,
  displayMode: DisplayMode,
  common: {
    id: string;
    isActive: boolean;
    onActivate: () => void;
    detailsOpen: boolean;
    onDetailsOpenChange: (open: boolean) => void;
    onOpenDetails: () => void;
    stickyTop: number;
    toolbarHeight: number;
    reorderEditing: boolean;
    favorited: boolean;
    onToggleFavorite: () => void;
    cardHidden: boolean;
    onToggleHidden: () => void;
    dragControls?: DragControls;
    /** Set for the two quick-action grid modes — swaps each card's own
     *  full-size markup for a compact aspect-square tile rendering the
     *  same underlying state, rather than mounting a separate component
     *  (which would lose that state on every mode switch). */
    tileDensity?: "large" | "small";
    /** Set for the list display mode — same reasoning as tileDensity: each
     *  card kind renders its own DataListRow (with its own kind-specific
     *  floating action buttons) from the same component instance, rather
     *  than a separate generic component that has no access to that state. */
    listMode?: boolean;
  },
): React.ReactNode {
  switch (card.kind) {
    case "trial":
      return (
        <TrialCard
          title={card.title}
          phase={card.phase}
          dataType="Percent Correct"
          description={card.description}
          minTrials={card.minTrials}
          maxTrials={card.maxTrials}
          noResponse={card.noResponse}
          promptLevels={card.promptLevels}
          {...common}
        />
      );
    case "frequency":
      return (
        <FrequencyCard
          title={card.title}
          phase={card.phase}
          description={card.description}
          minCount={card.minCount}
          {...common}
        />
      );
    case "rate":
      return (
        <RateCard
          title={card.title}
          phase={card.phase}
          description={card.description}
          minDurationSec={card.minDurationSec}
          locked={card.locked}
          {...common}
        />
      );
    case "duration":
      return (
        <DurationCard
          title={card.title}
          phase={card.phase}
          description={card.description}
          minDurationSec={card.minDurationSec}
          {...common}
        />
      );
    case "task-analysis":
      return (
        <TaskAnalysisCard
          title={card.title}
          phase={card.phase}
          description={card.description}
          steps={card.steps}
          {...common}
        />
      );
    case "rating":
      return (
        <RatingCard
          title={card.title}
          phase={card.phase}
          description={card.description}
          min={card.min}
          max={card.max}
          levelDescriptions={card.levelDescriptions}
          {...common}
        />
      );
  }
}

// The card list's own slide is deliberately SLOWER than CARD_EXIT_MS (stage
// 1's dwell, which is when the new cards' remount actually fires — see
// IndexInner). That gap is what makes the two overlap: the old cards are
// still most of the way through sliding out (not gone yet) when the new
// ones start sliding in, so it reads as one continuous relay — "one set
// leaving as the other enters" — instead of "exit, dead pause, enter."
const CARD_SLIDE_EXIT_MS = 560;
const CARD_SLIDE_ENTER_MS = 560;

// Shared by every per-card wrapper's `layout="position"` animation (see
// DataCardList) — smoothly translates a card to its new spot when siblings
// are added/removed (filtering, submit, discard), using the same eased-
// duration feel as the rest of the app's non-spring transitions. Restricted
// to "position" (translate only, never scale) because the actual box-size
// change between card/list/grid is handled separately by MorphContent's own
// real height animation below — layering a scale-based FLIP on top of that
// would double-animate the resize and reintroduce content distortion.
const CARD_MORPH_TRANSITION = { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as const;

// Expands/collapses a card's box to its new mode's natural height and
// crossfades its content — deliberately NOT a transform-scale (Motion's
// `layout` FLIP technique), because that scales the whole subtree including
// descendants Motion isn't tracking (a fresh card/list/grid render is a
// completely different DOM tree), which visibly stretched text and warped
// border-radius into an ellipse before easing back to normal. Measuring the
// real content height and animating the wrapper's `height` (clipped via
// overflow: hidden) instead means the content never gets scaled — only
// revealed or clipped — so it always renders at its true, undistorted size.
function MorphContent({ displayMode, children }: { displayMode: DisplayMode; children: React.ReactNode }) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const isFirstMeasure = useRef(true);

  // overflow:hidden only while a mode switch is actually mid-flight — not a
  // permanent property of this wrapper. Left on all the time, it clips the
  // wrapper to the exact measured `scrollHeight` of its content, which
  // (correctly, per spec) never includes a child's own box-shadow — so an
  // active card's selected-state shadow got hard-clipped right at its own
  // bottom edge instead of fading out naturally, reading as a flat gray
  // smudge with a sharp corner where the fade should have continued. Only
  // clipping during the brief crossfade (where it's genuinely needed, to
  // hide the old/new content pair briefly overlapping) and lifting it once
  // settled lets any static shadow bleed past the box normally at rest.
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevDisplayModeRef = useRef(displayMode);
  useEffect(() => {
    if (prevDisplayModeRef.current === displayMode) return;
    prevDisplayModeRef.current = displayMode;
    setIsTransitioning(true);
    const id = window.setTimeout(
      () => setIsTransitioning(false),
      CARD_MORPH_TRANSITION.duration * 1000 + 50,
    );
    return () => window.clearTimeout(id);
  }, [displayMode]);

  // ResizeObserver instead of the more obvious "measure scrollHeight in a
  // useLayoutEffect keyed on displayMode, animate to it, then transitionEnd
  // back to auto" — that trick doesn't hold up here. AnimatePresence's own
  // `exit` (below) pulls the OLD content out of flow via position:absolute
  // the INSTANT the key changes, not animated, so this wrapper's "auto"
  // height can already reflow to match the ENTERING content alone before a
  // same-pass layout effect ever runs — collapsing the animation's start
  // and end to the same number, so it snaps instead of morphing. A regular
  // (non-layout) effect here, by contrast, naturally fires AFTER that
  // paint — so `height` state still holds the OLD value through that first
  // paint, and only advances to the new measurement afterward, which is
  // exactly the two genuinely-different, two-separately-painted values
  // Motion needs to interpolate between. Same ResizeObserver-based pattern
  // StatusBar's own boxNaturalHeight/miniSlotHeight already use, for the
  // identical reason ("Motion's own auto height resolution wasn't
  // reliable") — and it doubles as the ongoing remeasure this wrapper needs
  // for any later in-place content growth (a trial's row expanding, a
  // frequency counter growing), which the old transitionEnd approach had to
  // hand off to "auto" for since it had no other way to keep tracking it.
  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const measure = () => setHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [displayMode]);

  useEffect(() => {
    isFirstMeasure.current = false;
  }, []);

  return (
    <motion.div
      className="w-full"
      style={{ overflow: isTransitioning ? "hidden" : "visible" }}
      animate={{ height: height ?? "auto" }}
      // The very first measurement (initial mount) snaps instantly — there's
      // no prior state to visually transition from, and animating "auto" to
      // itself would otherwise be a no-op anyway. Every later mode switch
      // gets the real eased transition.
      transition={isFirstMeasure.current ? { duration: 0 } : CARD_MORPH_TRANSITION}
    >
      <div className="relative w-full">
        {/* popLayout (not "wait") lets the new mode's content mount
            immediately instead of waiting for the old content's exit to
            finish first — mode="wait" left a blank gap between them.
            Setting position: absolute directly in `exit` applies instantly
            rather than animating, pulling the old content out of flow the
            moment it starts fading instead of waiting on that. The height
            measurement below is taken from THIS entering node specifically
            (not the shared parent above) — measuring the parent would also
            pick up the exiting sibling's own footprint for however long it
            takes AnimatePresence's own effects to actually apply that
            position: absolute, which runs on a separate cycle from this
            component's own layout effect and isn't guaranteed to have
            settled first; the entering node's own scrollHeight is
            unaffected by the exiting sibling regardless of that timing. */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={displayMode}
            ref={measureRef}
            className="w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, position: "absolute", top: 0, left: 0 }}
            transition={{ duration: 0.12 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Single-unit variants for start-new/discard — the WHOLE list moves as one
// element (not per-card), which is both simpler and much cheaper than
// animating each card individually: only one Motion component is tracked
// during the transition instead of seven.
const SINGLE_UNIT_VARIANTS = {
  "start-new": {
    initial: { x: "-100%" },
    animate: { x: 0, transition: { duration: CARD_SLIDE_ENTER_MS / 1000, ease: [0, 0, 0.2, 1] } },
    exit: { x: "100%", transition: { duration: CARD_SLIDE_EXIT_MS / 1000, ease: [0.4, 0, 1, 1] } },
  },
  discard: {
    initial: { x: "100%", opacity: 0 },
    animate: { x: 0, opacity: 1, transition: { duration: CARD_SLIDE_ENTER_MS / 1000, ease: [0, 0, 0.2, 1] } },
    // Shrinks and dissolves in place — unlike start-new's slide, this exit
    // has fully finished (see CARD_SLIDE_EXIT_MS delay in IndexInner) before
    // the fresh set enters, so discard reads as "gone, then a new one
    // arrives" rather than an overlapping relay.
    exit: { opacity: 0, scale: 0.7, transition: { duration: CARD_SLIDE_EXIT_MS / 1000, ease: [0.4, 0, 1, 1] } },
  },
} as const;

// Memoized so a resume/pause transition — which re-renders IndexInner via
// `status`/`transitionKind` but leaves every prop below unchanged — doesn't
// cascade a re-render through all five data cards (each a fairly heavy
// subtree, e.g. TrialCard's keypads). That cascade was landing as a ~90ms
// main-thread task right at click time, stalling the collapse animation.
const DataCardList = memo(function DataCardList({
  cardsGen,
  cardsAnimKind,
  transitionHidden = false,
  visibleCards,
  activeId,
  setActiveId,
  cardRefs,
  editMode,
  favorites,
  toggleFavorite,
  hidden,
  toggleHidden,
  setOrder,
  displayMode,
  suppressCardLayout,
  drawerOpen,
  drawerSlideOpen,
  onDrawerOpenChange,
  stickyTop,
  toolbarHeight,
}: {
  cardsGen: number;
  cardsAnimKind: "start-new" | "discard" | "submit";
  /** True during stages 1-2 of a start-new/discard transition — the old
   * list plays its exit (this flipping true is what triggers it, since
   * AnimatePresence here tracks its child's presence) and nothing renders
   * until the fresh list mounts for stage 3. */
  transitionHidden?: boolean;
  visibleCards: CardConfig[];
  activeId: string;
  setActiveId: (id: string) => void;
  cardRefs: React.RefObject<Map<string, HTMLElement>>;
  editMode: boolean;
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
  hidden: Set<string>;
  toggleHidden: (id: string) => void;
  order: string[];
  setOrder: (ids: string[]) => void;
  displayMode: DisplayMode;
  suppressCardLayout: boolean;
  /** Drives the tile reflow (see `stackToLeftColumn` below) the instant the
   *  user asks to open the drawer. */
  drawerOpen: boolean;
  /** The drawer's own actual slide-open signal — lags `drawerOpen` in grid
   *  modes until the reflow it triggers has settled (see IndexInner). */
  drawerSlideOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  stickyTop: number;
  toolbarHeight: number;
}) {
  const setCardRef = (id: string) => (el: HTMLElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  };

  // Card mode's own template collapses to one column when the drawer opens
  // (see IndexInner) — safe there since a card's own max-w-md already caps
  // its size regardless of its grid track's width, so the template change
  // doesn't resize anything, just reduces how many fit per row. The two
  // quick-action grids deliberately do NOT get the same treatment: a tile's
  // size IS its grid track's width, so collapsing to grid-cols-1 would
  // stretch every tile to fill the whole row instead of leaving them their
  // normal size. Their own template stays exactly as it is — see the
  // per-card `gridColumn` override below, which pins each one into column 1
  // of that unchanged template instead.
  const gridClasses =
    drawerOpen && displayMode === "card" ? "grid-cols-1 gap-3" : DISPLAY_MODE_GRID_CLASSES[displayMode];
  // Only the two quick-action grids need the per-card column pin above —
  // list is already single-column and card's own template change already
  // achieves the same "one per row" result without it.
  const stackToLeftColumn =
    drawerOpen && (displayMode === "grid-large" || displayMode === "grid-small");

  const renderOne = (card: CardConfig, dragControls?: DragControls) =>
    renderCard(card, displayMode, {
      id: card.id,
      isActive: card.id === activeId,
      onActivate: () => setActiveId(card.id),
      detailsOpen: card.id === activeId && drawerSlideOpen,
      onDetailsOpenChange: onDrawerOpenChange,
      onOpenDetails: () => {
        // Activating a card that wasn't already active mounts a FRESH
        // DataDetailsDrawer instance for it (see CardShell/MiniTileShell/
        // DataListRow's own `{isActive && <DataDetailsDrawer .../>}`) —
        // setting `open` true in that same tick means its very first commit
        // is already-open, and Motion's `initial={false}` treats that first
        // commit as the resting state rather than something to animate from,
        // so the panel pops open instead of sliding out. Deferring the open
        // flag one frame lets that fresh instance actually mount (and paint)
        // closed first, so the slide-open plays as a normal, already-mounted
        // prop change — the same way toggling the drawer's own pull tab
        // (which never remounts) already animates correctly.
        setActiveId(card.id);
        requestAnimationFrame(() => onDrawerOpenChange(true));
      },
      stickyTop,
      toolbarHeight,
      reorderEditing: editMode,
      favorited: favorites.has(card.id),
      onToggleFavorite: () => toggleFavorite(card.id),
      cardHidden: hidden.has(card.id),
      onToggleHidden: () => toggleHidden(card.id),
      dragControls,
      tileDensity: displayMode === "grid-large" ? "large" : displayMode === "grid-small" ? "small" : undefined,
      listMode: displayMode === "list",
    });

  // Edit mode is its own render path — drag-to-reorder (via Motion's
  // Reorder) plus per-card favorite/hide affordances (now rendered right in
  // each card's own header, see CardEditControls) don't need to coordinate
  // with the session-lifecycle animations below, since editing and a
  // start-new/discard/submit transition don't realistically overlap.
  if (editMode) {
    return (
      <Reorder.Group
        axis="y"
        values={visibleCards.map((c) => c.id)}
        onReorder={setOrder}
        className={cn("grid w-full", gridClasses)}
      >
        {visibleCards.map((card) => (
          <EditableCardItem
            key={card.id}
            card={card}
            isHidden={hidden.has(card.id)}
            setCardRef={setCardRef}
            renderOne={renderOne}
            displayMode={displayMode}
            suppressCardLayout={suppressCardLayout}
            stackToLeftColumn={stackToLeftColumn}
          />
        ))}
      </Reorder.Group>
    );
  }

  if (cardsAnimKind === "submit") {
    // Submit keeps its own separate, more elaborate per-card staggered
    // animation — untouched, and deliberately allowed to cost more.
    return (
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={cardsGen}
          className={cn("grid w-full", gridClasses)}
          initial="enter"
          animate="center"
          exit="exit"
          variants={{
            enter: {},
            center: { transition: { staggerChildren: 0 } },
            exit: { transition: { staggerChildren: DATA_SUBMIT_STAGGER_MS / 1000 } },
          }}
        >
          {visibleCards.map((card) => (
            <motion.div
              key={card.id}
              layout="position"
              ref={setCardRef(card.id)}
              className="w-full flex justify-center"
              style={stackToLeftColumn ? { gridColumn: 1 } : undefined}
              variants={{
                enter: { opacity: 0, x: -40 },
                center: { opacity: 1, x: 0, transition: { duration: DATA_SUBMIT_ENTER_DURATION_MS / 1000 } },
                exit: { opacity: 0, x: 80, transition: { duration: DATA_SUBMIT_EXIT_DURATION_MS / 1000 } },
              }}
              transition={{ layout: suppressCardLayout ? { duration: 0 } : CARD_MORPH_TRANSITION }}
            >
              <MorphContent displayMode={displayMode}>{renderOne(card)}</MorphContent>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {!transitionHidden && (
        <motion.div
          key={cardsGen}
          className={cn("grid w-full", gridClasses)}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={SINGLE_UNIT_VARIANTS[cardsAnimKind]}
        >
          {visibleCards.map((card) => (
            <motion.div
              key={card.id}
              layout="position"
              transition={{ layout: suppressCardLayout ? { duration: 0 } : CARD_MORPH_TRANSITION }}
              ref={setCardRef(card.id)}
              className="w-full flex justify-center"
              style={stackToLeftColumn ? { gridColumn: 1 } : undefined}
            >
              <MorphContent displayMode={displayMode}>{renderOne(card)}</MorphContent>
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// A real component (not just an inline callback in DataCardList's .map)
// because `useDragControls` must be called consistently on every render —
// the number of visible cards changes as filters/search narrow the list, so
// calling it directly inside the loop would violate the rules of hooks.
function EditableCardItem({
  card,
  isHidden,
  setCardRef,
  renderOne,
  displayMode,
  suppressCardLayout,
  stackToLeftColumn,
}: {
  card: CardConfig;
  isHidden: boolean;
  setCardRef: (id: string) => (el: HTMLElement | null) => void;
  renderOne: (card: CardConfig, dragControls?: DragControls) => React.ReactNode;
  displayMode: DisplayMode;
  suppressCardLayout: boolean;
  stackToLeftColumn: boolean;
}) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item
      value={card.id}
      layout="position"
      transition={{ layout: suppressCardLayout ? { duration: 0 } : CARD_MORPH_TRANSITION }}
      ref={setCardRef(card.id)}
      dragListener={false}
      dragControls={dragControls}
      className={cn("w-full flex justify-center", isHidden && "opacity-40")}
      style={stackToLeftColumn ? { gridColumn: 1 } : undefined}
    >
      <MorphContent displayMode={displayMode}>{renderOne(card, dragControls)}</MorphContent>
    </Reorder.Item>
  );
}

function InfoPane() {
  const { lastUpdated } = useSession();
  return (
    <div className="max-w-2xl mx-auto mt-6 px-4">
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
          <span>For</span>
          <UserLink name="Phineas Flynn" />
          <span>by</span>
          <UserLink name="Heinz Doofenshmirtz" />
        </div>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
          <span>Last updated {formatUpdated(lastUpdated)} by</span>
          <UserLink name="Perry Plat" />
        </div>
      </div>
      <div className="mt-8 rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center">
        <h3 className="font-display text-xl">Client Info</h3>
        <p className="mt-2 text-sm text-muted-foreground">Goals, programs, and learner notes will live here.</p>
      </div>
    </div>
  );
}

function UserLink({ name }: { name: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-200 text-blue-800 hover:bg-blue-100 hover:text-blue-700 transition-colors text-sm"
    >
      <User className="size-3" fill="currentColor" strokeWidth={0} />
      <span>{name}</span>
    </button>
  );
}


function formatUpdated(d: Date | null) {
  if (!d) return "—";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `today at ${time}`;
  return `${d.toLocaleDateString()} ${time}`;
}

function PlaceholderPane({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-md mx-auto mt-12 rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center">
      <h2 className="font-display text-xl">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
