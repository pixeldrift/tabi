import type { ReactNode } from "react";
import { Lightbulb, Play } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Shared "what does this mean" popup for a card's Phase / Data type
 *  details — invoked identically whether tapped from the drawer's own
 *  quick facts (see DrawerQuickFacts) or straight off the card/row itself
 *  (see PhaseInfoLabel/DataTypeInfoLabel). The video slot is a static
 *  placeholder (16:9, black, centered play glyph) standing in for a real
 *  tutorial clip that doesn't exist yet — not wired to play anything. The
 *  lightbulb next to the title is the app-wide marker for this kind of
 *  hint/tip/learning content, distinct from the value's own icon above it. */
export function DrawerInfoModal({
  open,
  onOpenChange,
  icon,
  kindLabel,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: ReactNode;
  /** "Phase" or "Data Type" — prefixed onto the title as "Phase: Baseline". */
  kindLabel: string;
  title: string;
  description: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-xl">
        <DialogHeader className="items-start text-left">
          <DialogTitle className="flex items-center gap-1.5">
            <Lightbulb className="size-4 shrink-0 text-stone-500" aria-hidden />
            <span>
              {kindLabel}: {title}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* No circle backdrop — a plain, unboxed glyph in a quiet slate tone
            reads as an illustration of the concept rather than a button or
            badge. mx-auto (not a flex/grid alignment utility) centers it
            horizontally regardless of DialogContent's own grid layout,
            since this element's fixed size means "stretch" alignment
            wouldn't otherwise do anything — its own row, beneath the
            (left-aligned) title bar above it rather than part of it. */}
        <span
          className="grid place-items-center mx-auto size-12 text-stone-500 [&>svg]:size-8"
          aria-hidden
        >
          {icon}
        </span>

        <p className="text-sm text-foreground/80 leading-snug">{description}</p>

        {/* Placeholder for a future short tutorial clip — no real video
            source yet, so this is just a static 16:9 box, not a functioning
            player. */}
        <div
          className="relative aspect-video w-full overflow-hidden rounded-lg bg-black"
          role="img"
          aria-label={`Tutorial video placeholder for ${title}`}
        >
          <span className="absolute inset-0 grid place-items-center">
            <Play className="size-10 text-blue-500" fill="currentColor" strokeWidth={0} />
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
