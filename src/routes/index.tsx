import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { User } from "lucide-react";
import { TrialCard } from "@/components/TrialCard";
import { FrequencyCard } from "@/components/FrequencyCard";
import { RateCard } from "@/components/RateCard";
import { DurationCard } from "@/components/DurationCard";
import { TaskAnalysisCard } from "@/components/TaskAnalysisCard";
import { ScheduleView } from "@/components/ScheduleView";
import { SessionProvider, useSession } from "@/components/SessionContext";
import { StatusBar, type StatusTab } from "@/components/StatusBar";
import { NotificationProvider } from "@/components/NotificationContext";
import { NotificationBar } from "@/components/NotificationBar";
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

function Index() {
  return (
    <SessionProvider>
      <IndexInner />
    </SessionProvider>
  );
}

function IndexInner() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [tab, setTab] = useState<StatusTab>("data");
  const { status } = useSession();
  const sessionActive = status === "running";

  return (
    <main className="min-h-screen bg-background">
      <StatusBar activeTab={tab} onTabChange={setTab} />

      <section className="px-5 pt-5 pb-16 max-w-5xl mx-auto border-t border-stone-200 -mt-px">
        {tab === "data" && (
          <div
            className={cn(
              "flex flex-col items-center gap-5 transition-opacity duration-300",
              !sessionActive && "opacity-50 pointer-events-none select-none",
            )}
            aria-disabled={!sessionActive}
          >
            {cards.map((card, i) => {
              const common = {
                isActive: i === activeIndex,
                onActivate: () => setActiveIndex(i),
              };
              switch (card.kind) {
                case "trial":
                  return (
                    <TrialCard
                      key={i}
                      title={card.title}
                      phase={card.phase}
                      dataType="% correct"
                      description={card.description}
                      minTrials={card.minTrials}
                      maxTrials={card.maxTrials}
                      {...common}
                    />
                  );
                case "frequency":
                  return (
                    <FrequencyCard
                      key={i}
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
                      key={i}
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
                      key={i}
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
                      key={i}
                      title={card.title}
                      phase={card.phase}
                      description={card.description}
                      steps={card.steps}
                      {...common}
                    />
                  );
              }
            })}
          </div>
        )}

        {tab === "info" && <InfoPane />}
        {tab === "schedule" && <ScheduleView />}
        {tab === "notifications" && <PlaceholderPane title="Alerts & announcements" description="Messages, reminders, and supervisor notes will appear here." />}
      </section>
    </main>
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
