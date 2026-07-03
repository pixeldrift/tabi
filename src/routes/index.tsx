import { createFileRoute } from "@tanstack/react-router";
import { memo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { User } from "lucide-react";
import { TrialCard } from "@/components/TrialCard";
import { FrequencyCard } from "@/components/FrequencyCard";
import { RateCard } from "@/components/RateCard";
import { DurationCard } from "@/components/DurationCard";
import { TaskAnalysisCard } from "@/components/TaskAnalysisCard";
import { ScheduleView } from "@/components/ScheduleView";
import { SessionProvider, useSession, PILL_LAND_MS, type TransitionKind } from "@/components/SessionContext";
import { SettingsProvider } from "@/components/SettingsContext";
import { SettingsPane } from "@/components/SettingsPane";
import { StatusBar, type StatusTab } from "@/components/StatusBar";
import { NotificationProvider } from "@/components/NotificationContext";
import { NOTIFICATION_AREA_TRANSITION } from "@/components/NotificationBar";
import { useStickyTop } from "@/hooks/use-sticky-top";
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

type CardConfig =
  | {
      kind: "trial";
      title: string;
      phase: string;
      description: string;
      minTrials: number;
      maxTrials?: number;
    }
  | { kind: "frequency"; title: string; phase: string; description: string; minCount: number }
  | { kind: "rate"; title: string; phase: string; description: string; minDurationSec: number; locked?: boolean }
  | { kind: "duration"; title: string; phase: string; description: string; minDurationSec: number }
  | { kind: "task-analysis"; title: string; phase: string; description: string; steps: string[] };

const cards: CardConfig[] = [
  {
    kind: "trial",
    title: "Holds hand during transition",
    phase: "Intervention",
    description:
      "Score correct if the learner reaches for and maintains hand-hold from the start of the transition through arrival at the destination.",
    minTrials: 5,
  },
  {
    kind: "frequency",
    title: "Giggles/laughs during therapist-led play",
    phase: "Intervention",
    description: "Tally each instance the learner giggles or laughs during therapist-led play.",
    minCount: 5,
  },
  {
    kind: "rate",
    title: "Flopping/dropping to floor",
    phase: "Baseline",
    description:
      "During a timed observation, tally each flop/drop. Rate is reported as occurrences per minute.",
    minDurationSec: 60,
  },
  {
    kind: "rate",
    title: "Uses AAC to request",
    phase: "Intervention",
    description: "Tally each independent AAC request. This timer is linked to the session timer.",
    minDurationSec: 60,
    locked: true,
  },
  {
    kind: "duration",
    title: "Tantruming",
    phase: "Intervention",
    description:
      "Track each tantrum instance separately. Start a new instance with the plus button; pause/resume the current instance with the play/pause button.",
    minDurationSec: 30,
  },
  {
    kind: "duration",
    title: "Tolerates sitting in social group",
    phase: "Intervention",
    description:
      "Track each interval the learner remains seated with the social group. Start a new instance when they rejoin.",
    minDurationSec: 60,
  },
  {
    kind: "task-analysis",
    title: "Washing hands",
    phase: "Intervention",
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
];

// Data-submitted animation timing — TODO: surface in user settings.
const DATA_SUBMIT_STAGGER_MS = 90;
const DATA_SUBMIT_ENTER_DURATION_MS = 550;
const DATA_SUBMIT_EXIT_DURATION_MS = 550;

function Index() {
  return (
    <SettingsProvider>
      <SessionProvider>
        <IndexInner />
      </SessionProvider>
    </SettingsProvider>
  );
}

function IndexInner() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [tab, setTab] = useState<StatusTab>("data");
  const [scheduleScrollId, setScheduleScrollId] = useState<string | null>(null);
  const { status, transitionStage, transitionKind } = useSession();
  const sessionActive = status === "running";
  const stickyTop = useStickyTop();

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
        setCardsAnimKind("discard");
        setCardsGen((n) => n + 1);
        setCardsHidden(false);
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


      <motion.section
        layout="position"
        transition={{ layout: NOTIFICATION_AREA_TRANSITION }}
        className={cn(
          "px-5 pb-16 max-w-5xl mx-auto border-t border-stone-200 -mt-px",
          tab === "schedule" ? "pt-2" : "pt-5",
        )}
      >
        {tab === "data" && (
          <>
            {/* Direct child of the section (not the flex/align-items:center
                wrapper below) — negative margins used to break a flex child
                out to full width get silently ignored by that container's
                centering, so this uses the viewport-relative breakout
                instead, same as the notification bar / schedule toggles. */}
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
                  className="sticky z-40 -mt-5 mb-5 overflow-hidden bg-background border-b border-stone-200/70 ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] w-screen"
                  style={{ top: stickyTop }}
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
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-full flex flex-col items-center gap-3 transition-opacity duration-300",
                !sessionActive && "opacity-50",
              )}
            >
              <DataCardList
                cardsGen={cardsGen}
                cardsAnimKind={cardsAnimKind}
                activeIndex={activeIndex}
                setActiveIndex={setActiveIndex}
                hidden={cardsHidden}
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
  common: { isActive: boolean; onActivate: () => void },
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
    // A gentle deflate-and-sink reads as "being discarded" without a
    // literal trash/shred effect.
    exit: { opacity: 0, scale: 0.92, y: 10, transition: { duration: CARD_SLIDE_EXIT_MS / 1000, ease: [0.4, 0, 1, 1] } },
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
  activeIndex,
  setActiveIndex,
  hidden = false,
}: {
  cardsGen: number;
  cardsAnimKind: "start-new" | "discard" | "submit";
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  /** True during stages 1-2 of a start-new/discard transition — the old
   * list plays its exit (this flipping true is what triggers it, since
   * AnimatePresence here tracks its child's presence) and nothing renders
   * until the fresh list mounts for stage 3. */
  hidden?: boolean;
}) {
  const cardElements = cards.map((card, i) =>
    renderCard(card, { isActive: i === activeIndex, onActivate: () => setActiveIndex(i) }),
  );

  if (cardsAnimKind === "submit") {
    // Submit keeps its own separate, more elaborate per-card staggered
    // animation — untouched, and deliberately allowed to cost more.
    return (
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={cardsGen}
          className="w-full flex flex-col items-center gap-3"
          initial="enter"
          animate="center"
          exit="exit"
          variants={{
            enter: {},
            center: { transition: { staggerChildren: 0 } },
            exit: { transition: { staggerChildren: DATA_SUBMIT_STAGGER_MS / 1000 } },
          }}
        >
          {cardElements.map((el, i) => (
            <motion.div
              key={i}
              className="w-full flex justify-center"
              variants={{
                enter: { opacity: 0, x: -40 },
                center: { opacity: 1, x: 0, transition: { duration: DATA_SUBMIT_ENTER_DURATION_MS / 1000 } },
                exit: { opacity: 0, x: 80, transition: { duration: DATA_SUBMIT_EXIT_DURATION_MS / 1000 } },
              }}
            >
              {el}
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {!hidden && (
        <motion.div
          key={cardsGen}
          className="w-full flex flex-col items-center gap-3"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={SINGLE_UNIT_VARIANTS[cardsAnimKind]}
        >
          {cardElements.map((el, i) => (
            <div key={i} className="w-full flex justify-center">
              {el}
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

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
