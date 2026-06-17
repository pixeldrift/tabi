import { createFileRoute } from "@tanstack/react-router";
import { TrialCard } from "@/components/TrialCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trials — scientific data collection" },
      {
        name: "description",
        content:
          "Scrollable list of trial cards for collecting experimental data with intuitive correct/incorrect entry and progress tracking.",
      },
      { property: "og:title", content: "Trials — scientific data collection" },
      {
        property: "og:description",
        content:
          "Scrollable list of trial cards for collecting experimental data with intuitive correct/incorrect entry and progress tracking.",
      },
    ],
  }),
  component: Index,
});

const trialCards = [
  {
    title: "Holds hand during transition",
    phase: "Intervention",
    dataType: "% correct",
    description:
      "Score correct if the learner reaches for and maintains hand-hold from the start of the transition through arrival at the destination.",
    minTrials: 10,
  },
  {
    title: "Requests break appropriately",
    phase: "Baseline",
    dataType: "% correct",
    description:
      "Score correct if the learner uses a vocal or AAC request to ask for a break instead of engaging in challenging behavior.",
    minTrials: 8,
    maxTrials: 15,
  },
  {
    title: "Identifies named object",
    phase: "Intervention",
    dataType: "% correct",
    description:
      "Place 3 objects in the field. Score correct on independent identification within 5 seconds of the SD.",
    minTrials: 12,
  },
];

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <header className="px-5 pt-10 pb-4 max-w-md mx-auto">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Session · today
        </p>
        <h1 className="font-display text-3xl mt-1">Data collection</h1>
      </header>
      <section className="px-5 pb-16 flex flex-col items-center gap-5">
        {trialCards.map((card, i) => (
          <TrialCard key={i} {...card} />
        ))}
      </section>
    </main>
  );
}
