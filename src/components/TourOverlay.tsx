import { Button } from "@/components/ui/button";
import { SpotlightCallout } from "./SpotlightCallout";
import { useTour } from "./TourContext";

/** Thin wrapper around the shared SpotlightCallout for the guided tour's
 *  own step sequence — owns just the step counter and Back/Next/Done
 *  controls, everything else (positioning, the spotlight cutout, the
 *  dismiss button) lives in SpotlightCallout itself. */
export function TourOverlay() {
  const { active, currentStep, stepIndex, stepCount, targetRect, targetStatus, next, back, skip } =
    useTour();

  if (!active || !currentStep) return null;

  const isLastStep = stepIndex === stepCount - 1;

  return (
    <SpotlightCallout
      contentKey={currentStep.id}
      targetRect={targetRect}
      targetStatus={targetStatus}
      title={currentStep.title}
      body={currentStep.body}
      onDismiss={skip}
      dismissLabel="Skip tour"
      ariaLabel={`Guided tour, step ${stepIndex + 1} of ${stepCount}`}
      footer={
        <>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {stepIndex + 1} of {stepCount}
          </span>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <Button variant="ghost" size="sm" onClick={back}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {isLastStep ? "Done" : "Next"}
            </Button>
          </div>
        </>
      }
    />
  );
}
