import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpotlightCallout, SpotlightCheckbox } from "./SpotlightCallout";
import { useTip } from "./TipContext";
import { useSettings } from "./SettingsContext";

/** Thin wrapper around the shared SpotlightCallout for the "Did you know?"
 *  tip rotation — no step counter (it's always just one tip). Uses the
 *  callout's divided title-bar layout (same treatment as StatusBar's own
 *  "Session Data Status" popover): a constant "Did you know…?" header up
 *  top, with the current tip's own `title` demoted to a bold subtitle
 *  below the divider, `body` underneath that. */
export function TipOverlay() {
  const { active, currentTip, targetRect, targetStatus, nextTip, dismiss } = useTip();
  const { tipsEnabled, setTipsEnabled } = useSettings();

  if (!active || !currentTip) return null;

  return (
    <SpotlightCallout
      contentKey={currentTip.id}
      targetRect={targetRect}
      targetStatus={targetStatus}
      header={{ icon: <Lightbulb className="size-4" />, label: "Did you know…?" }}
      title={currentTip.title}
      body={currentTip.body}
      onDismiss={dismiss}
      dismissLabel="Dismiss tip"
      ariaLabel="Did you know?"
      footer={
        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center justify-end gap-3">
            {/* A plain text link, not a second button — "dismiss" is the
                action most people want most of the time, so it gets the
                only real button; browsing more tips is secondary and
                shouldn't visually compete with it. */}
            <button
              type="button"
              onClick={nextTip}
              className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Show another
            </button>
            <Button size="sm" onClick={dismiss}>
              Got it!
            </Button>
          </div>
          {/* Same setting SettingsPane's own "Show 'Did you know?' tips"
              toggle controls — this is just a more discoverable surface
              for it, not a second parallel flag. Sits below the real
              actions, smaller and italic, so it reads as a passive
              preference rather than competing with them. */}
          <SpotlightCheckbox
            checked={tipsEnabled}
            onChange={setTipsEnabled}
            label="Show Tabi Tips on startup."
            className="text-[11px] italic text-stone-400"
          />
        </div>
      }
    />
  );
}
