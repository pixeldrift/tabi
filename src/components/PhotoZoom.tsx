import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";

// Tap-to-zoom trigger for any photo in the app (client, guardian, vehicle,
// staff) — a plain circular thumbnail that opens the shared full-size
// lightbox below. ClientAvatar (ClientInfoPane) wraps this with its own
// blur/reveal step first; everywhere else it's the direct trigger.
export function PhotoZoomButton({
  avatar,
  kind,
  label,
  size,
  ringClassName = "border border-border bg-blue-50",
}: {
  avatar?: string;
  kind?: "person" | "vehicle";
  label: string;
  size: string;
  /** Border/background for the thumbnail's own ring — override this
   *  instead of wrapping the button in a second bordered circle. Two
   *  concentric rounded-full elements never quite share a center (padding
   *  rounding, sub-pixel layout), which reads as the photo not lining up
   *  with its own frame; one ring on one element sidesteps that entirely. */
  ringClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge photo of ${label}`}
        className={cn("shrink-0 overflow-hidden rounded-full [clip-path:circle(50%)]", ringClassName, size)}
      >
        <Avatar value={avatar} kind={kind} className="h-full w-full object-cover" />
      </button>
      <PhotoZoomDialog open={open} onOpenChange={setOpen} avatar={avatar} kind={kind} label={label} />
    </>
  );
}

// Full-size lightbox shared by every photo in the app — tapping the photo
// itself closes it, same as the dialog's own X (DialogContent already
// renders one in the corner) or tapping outside. Shows the whole image
// uncropped (object-contain, no circular mask) rather than the thumbnail's
// cropped circle, since a face or a plate number cropped out of frame
// defeats the point of zooming in.
export function PhotoZoomDialog({
  open,
  onOpenChange,
  avatar,
  kind,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatar?: string;
  kind?: "person" | "vehicle";
  label: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-auto max-w-[min(85vw,400px)] rounded-3xl border-none bg-transparent p-0 shadow-none grid place-items-center [&>button]:bg-white/90 [&>button]:rounded-full [&>button]:p-1.5 [&>button]:right-3 [&>button]:top-3">
        <DialogTitle className="sr-only">{label}'s photo</DialogTitle>
        {/* Wrapped in a plain div, not a direct child of DialogContent —
            DialogContent's own [&>button] styling below exists to turn the
            auto-injected close-X into a circular white pill and is scoped
            to direct-child buttons, which would otherwise also catch (and
            force circular) this button. */}
        <div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Shrink photo"
            className="grid max-h-[70vh] w-[min(85vw,400px)] place-items-center overflow-hidden rounded-2xl border-4 border-white bg-blue-100 shadow-2xl"
          >
            <Avatar value={avatar} kind={kind} className="max-h-[calc(70vh-8px)] w-full object-contain" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
