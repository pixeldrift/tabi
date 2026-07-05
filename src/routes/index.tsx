import { createFileRoute } from "@tanstack/react-router";
import { memo, useEffect, useMemo, useRef, useState } from "react";
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
type CardConfig = { id: string } & (
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
    id: "tantruming",
    kind: "duration",
    title: "Tantruming",
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
          <IndexInner />
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
    if (q && !card.title.toLowerCase().includes(q)) return false;
    return true;
  });
}

const DISPLAY_MODE_GRID_CLASSES: Record<DisplayMode, string> = {
  list: "grid-cols-1",
  card: "grid-cols-1 sm:grid-cols-2",
  grid: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

function IndexInner() {
  const [activeId, setActiveId] = useState<string>(cards[0].id);
  const [tab, setTab] = useState<StatusTab>("data");
  const [scheduleScrollId, setScheduleScrollId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { status, transitionStage, transitionKind } = useSession();
  const sessionActive = status === "running";
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

  // Keep the active card centered whenever it's selected (opt-in — see the
  // Settings tab's "Keep active card centered" toggle) and, unconditionally,
  // whenever the display mode changes — switching from a single column to a
  // multi-column grid reflows every card's position, so without this the
  // active one can silently scroll off screen.
  useEffect(() => {
    if (!keepActiveCardCentered) return;
    const el = cardRefs.current.get(activeId);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, keepActiveCardCentered]);

  const prevDisplayModeRef = useRef(displayMode);
  useEffect(() => {
    if (prevDisplayModeRef.current === displayMode) return;
    prevDisplayModeRef.current = displayMode;
    const el = cardRefs.current.get(activeId);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMode]);

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
              instead of the wider 20px inherited from the shared tab padding. */}
          <div className="flex flex-col items-center -mx-2 mt-5">
            <div
              className={cn(
                "w-full transition-opacity duration-300",
                !sessionActive && "opacity-50",
              )}
            >
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
                drawerOpen={drawerOpen}
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
  drawerOpen,
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
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  stickyTop: number;
  toolbarHeight: number;
}) {
  const setCardRef = (id: string) => (el: HTMLElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  };

  const renderOne = (card: CardConfig, dragControls?: DragControls) =>
    renderCard(card, {
      id: card.id,
      isActive: card.id === activeId,
      onActivate: () => setActiveId(card.id),
      detailsOpen: card.id === activeId && drawerOpen,
      onDetailsOpenChange: onDrawerOpenChange,
      onOpenDetails: () => {
        setActiveId(card.id);
        onDrawerOpenChange(true);
      },
      stickyTop,
      toolbarHeight,
      reorderEditing: editMode,
      favorited: favorites.has(card.id),
      onToggleFavorite: () => toggleFavorite(card.id),
      cardHidden: hidden.has(card.id),
      onToggleHidden: () => toggleHidden(card.id),
      dragControls,
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
        className={cn("grid gap-3 w-full", DISPLAY_MODE_GRID_CLASSES[displayMode])}
      >
        {visibleCards.map((card) => (
          <EditableCardItem
            key={card.id}
            card={card}
            isHidden={hidden.has(card.id)}
            setCardRef={setCardRef}
            renderOne={renderOne}
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
          className={cn("grid gap-3 w-full", DISPLAY_MODE_GRID_CLASSES[displayMode])}
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
              ref={setCardRef(card.id)}
              className="w-full flex justify-center"
              variants={{
                enter: { opacity: 0, x: -40 },
                center: { opacity: 1, x: 0, transition: { duration: DATA_SUBMIT_ENTER_DURATION_MS / 1000 } },
                exit: { opacity: 0, x: 80, transition: { duration: DATA_SUBMIT_EXIT_DURATION_MS / 1000 } },
              }}
            >
              {renderOne(card)}
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
          className={cn("grid gap-3 w-full", DISPLAY_MODE_GRID_CLASSES[displayMode])}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={SINGLE_UNIT_VARIANTS[cardsAnimKind]}
        >
          {visibleCards.map((card) => (
            <div key={card.id} ref={setCardRef(card.id)} className="w-full flex justify-center">
              {renderOne(card)}
            </div>
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
}: {
  card: CardConfig;
  isHidden: boolean;
  setCardRef: (id: string) => (el: HTMLElement | null) => void;
  renderOne: (card: CardConfig, dragControls?: DragControls) => React.ReactNode;
}) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item
      value={card.id}
      ref={setCardRef(card.id)}
      dragListener={false}
      dragControls={dragControls}
      className={cn("w-full flex justify-center", isHidden && "opacity-40")}
    >
      {renderOne(card, dragControls)}
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
        <h3 className="font-display text-xl">Session info</h3>
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
