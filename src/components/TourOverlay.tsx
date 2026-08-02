import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTour } from "./TourContext";

const CALLOUT_WIDTH = 320;
const GAP = 16;
const VIEWPORT_MARGIN = 16;
// Same reasoning as StatusBar's PresenceIndicator/SaveIndicator arrow
// margins (rounded-2xl corner + rotated h-3 w-3 arrow square needs real
// clearance) — this box is narrower, so its own smaller-but-still-safe
// margin.
const ARROW_MARGIN = 24;

/** Portaled overlay for the guided tour: a real spotlight cutout around the
 *  current step's target (see its own comment below), plus a callout box +
 *  arrow pointing at it. Not built on Radix Popover/Dialog — see
 *  TourContext's own file header reasoning (every Popover in this codebase
 *  is click-trigger-driven; Dialog's modal focus-trap/Escape semantics
 *  fight a multi-step non-modal flow advanced by its own Next button). */
export function TourOverlay() {
  const { active, currentStep, stepIndex, stepCount, targetRect, targetStatus, next, back, skip } =
    useTour();
  const calloutRef = useRef<HTMLDivElement>(null);
  const [calloutHeight, setCalloutHeight] = useState<number | null>(null);

  // Copy length varies per step, so the callout's real height isn't known
  // until it's actually rendered — measured fresh (not guessed) each time
  // the step or its target rect changes, same "measure, then position"
  // idiom as the app's own manual-FLIP overlays elsewhere.
  useLayoutEffect(() => {
    setCalloutHeight(null);
    const el = calloutRef.current;
    if (!el) return;
    setCalloutHeight(el.getBoundingClientRect().height);
  }, [currentStep?.id, targetRect]);

  if (!active || !currentStep) return null;

  const showHighlight = targetStatus === "settled" && !!targetRect;
  const ready = showHighlight && calloutHeight !== null;

  let calloutTop = -9999;
  let calloutLeft = -9999;
  let arrowSide: "top" | "bottom" = "top";
  let arrowLeft = CALLOUT_WIDTH / 2;

  if (ready && targetRect && calloutHeight !== null) {
    const spaceBelow = window.innerHeight - (targetRect.top + targetRect.height);
    const spaceAbove = targetRect.top;
    const placeBelow =
      spaceBelow >= calloutHeight + GAP + VIEWPORT_MARGIN || spaceBelow >= spaceAbove;
    if (placeBelow) {
      calloutTop = targetRect.top + targetRect.height + GAP;
      arrowSide = "top";
    } else {
      calloutTop = targetRect.top - GAP - calloutHeight;
      arrowSide = "bottom";
    }
    // Defensive clamp — the measuring hook scrolls the target into view
    // before settling, so this shouldn't normally be needed, but a target
    // taller than the viewport (or a callout taller than the leftover
    // space either side of it) would otherwise still push the box off
    // screen.
    calloutTop = Math.min(
      Math.max(calloutTop, VIEWPORT_MARGIN),
      window.innerHeight - calloutHeight - VIEWPORT_MARGIN,
    );
    const targetCenterX = targetRect.left + targetRect.width / 2;
    calloutLeft = Math.min(
      Math.max(targetCenterX - CALLOUT_WIDTH / 2, VIEWPORT_MARGIN),
      window.innerWidth - CALLOUT_WIDTH - VIEWPORT_MARGIN,
    );
    arrowLeft = Math.min(
      Math.max(targetCenterX - calloutLeft, ARROW_MARGIN),
      CALLOUT_WIDTH - ARROW_MARGIN,
    );
  }

  const isLastStep = stepIndex === stepCount - 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[120]"
      role="dialog"
      aria-modal="true"
      aria-label={`Guided tour, step ${stepIndex + 1} of ${stepCount}`}
    >
      {/* True spotlight, not a flat dim layer over everything — this div's
          own box-shadow does double duty: a tight blue halo right at its
          edge, and (via a 9999px spread with no blur) a dark fill for the
          entire REST of the viewport, shaped by this div's own
          rounded-2xl corners. The target sits fully undimmed in the
          "hole" that leaves — a flat bg-black overlay on top of it made
          the very thing being pointed at hard to actually see. Nothing
          renders here until `ready` (see below): the wrapper's own
          `fixed inset-0` still blocks clicks everywhere in the meantime
          even with no visible fill. */}
      {showHighlight && targetRect && (
        <div
          className="fixed rounded-2xl border-2 border-blue-400 pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: "0 0 0 4px rgba(96,165,250,0.25), 0 0 0 9999px rgba(0,0,0,0.45)",
          }}
        />
      )}

      <div
        ref={calloutRef}
        className="fixed rounded-2xl border-2 border-blue-400 bg-white p-4 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)] transition-opacity duration-150"
        style={{
          top: calloutTop,
          left: calloutLeft,
          width: CALLOUT_WIDTH,
          opacity: ready ? 1 : 0,
        }}
      >
        {ready && (
          <div
            className={cn(
              "absolute h-3 w-3 -translate-x-1/2 rotate-45 border-blue-400 bg-white",
              arrowSide === "top"
                ? "-top-[7px] border-l-2 border-t-2"
                : "-bottom-[7px] border-r-2 border-b-2",
            )}
            style={{ left: arrowLeft }}
          />
        )}

        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-base leading-tight">{currentStep.title}</h3>
          <button
            type="button"
            aria-label="Skip tour"
            onClick={skip}
            className="-mr-1 -mt-1 grid size-6 shrink-0 place-items-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-xs leading-snug text-muted-foreground/80">{currentStep.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
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
        </div>
      </div>
    </div>,
    document.body,
  );
}
