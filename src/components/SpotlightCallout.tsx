import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpotlightRect, SpotlightTargetStatus } from "@/hooks/use-spotlight-target-rect";

const CALLOUT_WIDTH = 320;
const GAP = 16;
const VIEWPORT_MARGIN = 16;
// Same reasoning as StatusBar's PresenceIndicator/SaveIndicator arrow
// margins (rounded-2xl corner + rotated h-3 w-3 arrow square needs real
// clearance) — this box is narrower, so its own smaller-but-still-safe
// margin.
const ARROW_MARGIN = 24;

/** Shared positioning + rendering for every spotlight-style callout in the
 *  app — the guided tour's own steps and the "Did you know?" tip engine
 *  both point a callout at a real DOM target this same way, so the ~80
 *  lines of fiddly geometry (measure-then-reveal, above/below flip,
 *  callout/arrow clamping, the spotlight-cutout box-shadow trick) live
 *  here once instead of drifting between two copies. Not built on Radix
 *  Popover/Dialog — every Popover in this codebase is click-trigger-
 *  driven, and Dialog's modal focus-trap/Escape semantics fight a flow
 *  advanced by the caller's own controls rather than a click on the
 *  trigger. Callers own their own controls entirely via `footer`; this
 *  component only owns the box, the spotlight, and the dismiss (X). */
export function SpotlightCallout({
  contentKey,
  targetRect,
  targetStatus,
  title,
  body,
  onDismiss,
  dismissLabel,
  ariaLabel,
  footer,
}: {
  /** Identifies the current content (a tour step's id, a tip's id) —
   *  the callout's own height has to be re-measured whenever this
   *  changes, even on the rare chance two different pieces of content
   *  happen to target the same rect. */
  contentKey: string;
  targetRect: SpotlightRect | null;
  targetStatus: SpotlightTargetStatus;
  title: string;
  body: string;
  onDismiss: () => void;
  dismissLabel: string;
  ariaLabel: string;
  footer: ReactNode;
}) {
  const calloutRef = useRef<HTMLDivElement>(null);
  const [calloutHeight, setCalloutHeight] = useState<number | null>(null);

  // Copy length varies per tip/step, so the callout's real height isn't
  // known until it's actually rendered — measured fresh (not guessed)
  // each time the content or its target rect changes, same "measure,
  // then position" idiom as the app's own manual-FLIP overlays elsewhere.
  useLayoutEffect(() => {
    setCalloutHeight(null);
    const el = calloutRef.current;
    if (!el) return;
    setCalloutHeight(el.getBoundingClientRect().height);
  }, [contentKey, targetRect]);

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

  return createPortal(
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label={ariaLabel}>
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
          <h3 className="font-display text-base leading-tight">{title}</h3>
          <button
            type="button"
            aria-label={dismissLabel}
            onClick={onDismiss}
            className="-mr-1 -mt-1 grid size-6 shrink-0 place-items-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-xs leading-snug text-muted-foreground/80">{body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}
