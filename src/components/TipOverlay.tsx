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
        <>
          {/* Same setting SettingsPane's own "Show 'Did you know?' tips"
              toggle controls — this is just a more discoverable surface
              for it, not a second parallel flag. */}
          <SpotlightCheckbox
            checked={tipsEnabled}
            onChange={setTipsEnabled}
            label="Show Tabi Tips on startup."
          />
          <Button size="sm" onClick={nextTip}>
            Next Tabi Tip
          </Button>
        </>
      }
    />
  );
}
