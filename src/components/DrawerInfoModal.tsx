import type { ReactNode } from "react";
import { Play } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Shared "what does this mean" popup for the drawer's Data type / Phase
 *  rows (see DrawerQuickFacts) — same content shape for both, just
 *  different icon/title/description. The video slot is a static
 *  placeholder (16:9, black, centered play glyph) standing in for a real
 *  tutorial clip that doesn't exist yet — not wired to play anything. */
export function DrawerInfoModal({
  open,
  onOpenChange,
  icon,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-xl">
        <DialogHeader className="items-center text-center sm:text-center">
          <span
            className="grid place-items-center size-14 rounded-full bg-blue-50 text-blue-600 [&>svg]:size-8"
            aria-hidden
          >
            {icon}
          </span>
          <DialogTitle className="mt-1">{title}</DialogTitle>
        </DialogHeader>

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
