import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TrialCard } from "@/components/TrialCard";
import { FrequencyCard } from "@/components/FrequencyCard";
import { RateCard } from "@/components/RateCard";
import { DurationCard } from "@/components/DurationCard";
import { TaskAnalysisCard } from "@/components/TaskAnalysisCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Data collection — multi-format demo" },
      {
        name: "description",
        content:
          "Demo of consistent cards for collecting % correct, frequency, rate, duration, and task analysis data.",
      },
      { property: "og:title", content: "Data collection — multi-format demo" },
      {
        property: "og:description",
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
  | {
      kind: "frequency";
      title: string;
      phase: string;
      description: string;
      minCount: number;
    }
  | {
      kind: "rate";
      title: string;
      phase: string;
      description: string;
      minDurationSec: number;
    }
  | {
      kind: "duration";
      title: string;
      phase: string;
      description: string;
      minDurationSec: number;
    }
  | {
      kind: "task-analysis";
      title: string;
      phase: string;
      description: string;
      steps: string[];
    };

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
    title: "Raises hand before speaking",
    phase: "Intervention",
    description:
      "Tally each instance the learner raises their hand and waits to be called on before speaking during group instruction.",
    minCount: 5,
  },
  {
    kind: "rate",
    title: "Math facts answered",
    phase: "Baseline",
    description:
      "During a timed observation, tally each correct answer. Rate is reported as responses per minute.",
    minDurationSec: 60,
  },
  {
    kind: "duration",
    title: "On-task during independent work",
    phase: "Intervention",
    description:
      "Start the timer when the learner begins engaging with the task; stop when off-task. Multiple bouts are summed.",
    minDurationSec: 30,
  },
  {
    kind: "task-analysis",
    title: "Washing hands",
    phase: "Intervention",
    description:
      "Score each step as Independent (I), Prompted (P), or Error (E).",
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
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <main className="min-h-screen bg-background">
      <header className="px-5 pt-10 pb-4 max-w-md mx-auto">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Session · today
        </p>
        <h1 className="font-display text-3xl mt-1">Data collection</h1>
      </header>
      <section className="px-5 pb-16 flex flex-col items-center gap-5">
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
      </section>
    </main>
  );
}
