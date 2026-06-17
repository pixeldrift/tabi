import { createFileRoute } from "@tanstack/react-router";
import { DataCollectionForm } from "@/components/DataCollectionForm";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Onboard — interactive data collection" },
      {
        name: "description",
        content:
          "A warm, animated onboarding flow that collects your details step by step with delightful, responsive feedback.",
      },
      { property: "og:title", content: "Onboard — interactive data collection" },
      {
        property: "og:description",
        content:
          "A warm, animated onboarding flow that collects your details step by step with delightful, responsive feedback.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-5 py-12 sm:py-20">
        <DataCollectionForm />
      </div>

      <Toaster position="top-center" richColors closeButton={false} />
    </main>
  );
}
