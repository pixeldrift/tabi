import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpotlightCallout } from "./SpotlightCallout";
import { useTip } from "./TipContext";

/** Thin wrapper around the shared SpotlightCallout for the "Did you know?"
 *  tip rotation — no step counter (it's always just one tip), a single
 *  "Next tip" button in place of Back/Next/Done. */
export function TipOverlay() {
  const { active, currentTip, targetRect, targetStatus, nextTip, dismiss } = useTip();

  if (!active || !currentTip) return null;

  return (
    <SpotlightCallout
      contentKey={currentTip.id}
      targetRect={targetRect}
      targetStatus={targetStatus}
      title={currentTip.title}
      body={currentTip.body}
      onDismiss={dismiss}
      dismissLabel="Dismiss tip"
      ariaLabel="Did you know?"
      footer={
        <>
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Lightbulb className="size-3" />
            Did you know?
          </span>
          <Button size="sm" onClick={nextTip}>
            Next tip
          </Button>
        </>
      }
    />
  );
}
