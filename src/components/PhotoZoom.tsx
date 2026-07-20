import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/utils";

// How long a revealed photo stays unblurred before hiding itself again —
// long enough to actually register a face, short enough that the screen
// doesn't sit showing it indefinitely.
const REVEAL_MS = 3000;

// Tap-to-zoom trigger for any photo in the app (vehicle, staff, and any
// person photo that doesn't need the blur/reveal privacy step below) — a
// plain circular thumbnail that opens the shared full-size lightbox below.
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
        className={cn(
          "shrink-0 overflow-hidden rounded-full [clip-path:circle(50%)]",
          ringClassName,
          size,
        )}
      >
        <Avatar value={avatar} kind={kind} className="h-full w-full object-cover" />
      </button>
      <PhotoZoomDialog
        open={open}
        onOpenChange={setOpen}
        avatar={avatar}
        kind={kind}
        label={label}
      />
    </>
  );
}

// Blurred variant of PhotoZoomButton for person photos that warrant a
// privacy step before showing a face outright (the client's own profile
// photo, guardian photos) — starts blurred with a small "tap to reveal"
// hint; a tap unblurs it for REVEAL_MS before it hides itself again. A
// SECOND tap while revealed doesn't just re-blur early — it opens the same
// full-size zoom PhotoZoomButton uses, since at that point the user has
// already chosen to look at it and is asking to look closer.
export function BlurredPhotoZoomButton({
  avatar,
  label,
  size,
  bgClassName = "bg-blue-50",
  ringClassName = "border border-border",
  iconClassName = "size-1/3",
}: {
  avatar?: string;
  label: string;
  size: string;
  /** Background behind the clipped photo — separate from `ringClassName`
   *  (below) since the ring has to live outside the blur's own clip, not
   *  share a box with it. */
  bgClassName?: string;
  /** Border for the thumbnail's own ring, drawn as its own layer on top of
   *  the clipping circle rather than sharing its box — a blur filter's
   *  bleed only reliably clips to the exact rounded shape when it lives
   *  inside its own circular clip; sharing that box with a border let the
   *  blur spill a sliver past the circle's edge, clipped to the element's
   *  square border-box instead. */
  ringClassName?: string;
  /** Size of the "tap to reveal" eye hint — proportional by default, but a
   *  very small thumbnail needs a fixed floor (an icon can't shrink below
   *  its own legibility just because the circle around it did). */
  iconClassName?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const reblurTimerRef = useRef<number | null>(null);

  const scheduleReblur = () => {
    if (reblurTimerRef.current !== null) window.clearTimeout(reblurTimerRef.current);
    reblurTimerRef.current = window.setTimeout(() => setRevealed(false), REVEAL_MS);
  };

  useEffect(() => {
    return () => {
      if (reblurTimerRef.current !== null) window.clearTimeout(reblurTimerRef.current);
    };
  }, []);

  const handleClick = () => {
    if (!revealed) {
      setRevealed(true);
      scheduleReblur();
    } else {
      setZoomOpen(true);
      if (reblurTimerRef.current !== null) window.clearTimeout(reblurTimerRef.current);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={
          revealed ? `${label}'s photo — tap to enlarge` : `Tap to reveal ${label}'s photo`
        }
        className={cn("relative shrink-0", size)}
      >
        <div
          className={cn(
            "absolute inset-0 overflow-hidden rounded-full [clip-path:circle(50%)]",
            bgClassName,
          )}
        >
          <Avatar
            value={avatar}
            className={cn(
              "h-full w-full object-cover transition-[filter] duration-300",
              !revealed && "blur-md",
            )}
          />
        </div>
        <div
          className={cn("absolute inset-0 rounded-full pointer-events-none", ringClassName)}
          aria-hidden
        />
        {!revealed && (
          // Centered (not corner-pinned) and bare — a corner badge got
          // clipped by the circle's own rounded edge (a square positioned
          // near a circle's bounding-box corner sits mostly outside the
          // circle itself), and the white pill/shadow behind it read as a
          // button when it's only ever a passive hint.
          <Eye
            className={cn("absolute inset-0 m-auto text-white opacity-50", iconClassName)}
            aria-hidden
          />
        )}
      </button>
      <PhotoZoomDialog
        open={zoomOpen}
        onOpenChange={(open) => {
          setZoomOpen(open);
          if (!open) scheduleReblur();
        }}
        avatar={avatar}
        label={label}
      />
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
            <Avatar
              value={avatar}
              kind={kind}
              className="max-h-[calc(70vh-8px)] w-full object-contain"
            />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
