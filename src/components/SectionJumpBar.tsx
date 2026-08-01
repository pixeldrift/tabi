import { useRef, type RefObject } from "react";
import { useStickyCompact } from "@/hooks/use-sticky-compact";
import { cn } from "@/lib/utils";

export interface JumpSection {
  id: string;
  label: string;
}

/** Sticky bar of internal short-links to a tab's own main sections — same
 *  visual idiom as NotificationBar's filter bar and ScheduleView's toggles
 *  row (full-bleed background via the negative margins below, pinned at
 *  top-0 of the shared content pane, a subtle shadow once actually stuck —
 *  see useStickyCompact). Unlike those two, there's no icon-only "compact"
 *  collapse here: a jump chip's label IS its content, so `stuck` only
 *  drives the shadow. Shared between Info and Settings, which both just
 *  need "jump to this heading," nothing bar-specific enough to warrant its
 *  own bespoke markup. */
export function SectionJumpBar({
  sections,
  contentRef,
}: {
  sections: JumpSection[];
  contentRef: RefObject<HTMLElement | null>;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const stuck = useStickyCompact(sentinelRef, contentRef);

  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    const container = contentRef.current;
    if (!el || !container) return;
    const containerTop = container.getBoundingClientRect().top;
    const top = el.getBoundingClientRect().top - containerTop + container.scrollTop - 8;
    container.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <>
      <div className="mt-1" />
      <div ref={sentinelRef} className="h-0" aria-hidden />
      <div
        className={cn(
          "sticky top-0 z-40 ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] overflow-x-hidden bg-background border-b border-border/70 py-1.5 px-4",
          stuck ? "shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1)]" : "shadow-none",
        )}
      >
        <div className="flex items-center gap-1.5 text-xs max-w-2xl mx-auto overflow-x-auto">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jumpTo(s.id)}
              className="shrink-0 px-2 py-1 rounded-full border border-border bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-800 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
