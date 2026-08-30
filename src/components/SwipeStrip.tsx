import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SwipeStripProps {
  count: number;
  current: number;
  onCurrentChange: (index: number) => void;
  /** "centered" (bubbles/steps) pads each side so any item — including the
   *  first/last — can sit dead-center, and highlights whichever item is
   *  nearest that center as the user scrolls. "paged" (duration instances)
   *  has no such highlight — each item is its own full-width page, snapping
   *  edge-to-edge like a plain carousel. */
  variant: "centered" | "paged";
  className?: string;
  /** Extra classes on each item's own wrapper (the swipe strip supplies
   *  shrink/snap/paging itself; this is for cross-axis alignment etc.). */
  itemWrapperClassName?: string;
  /** Gap between items — meaningless for "paged" (each item is its own
   *  full-width page, nothing to space out) but matters for "centered",
   *  where items otherwise render edge-to-edge with nothing marking where
   *  one ends and the next begins. */
  gapClassName?: string;
  children: (index: number, isCenter: boolean) => ReactNode;
}

/** A native-scroll, scroll-snap swipeable strip shared by every card kind's
 *  quick-action tile rendering (Percent Correct's trial bubbles, Task
 *  Analysis's step names, Duration's instance pages) — real touch scrolling
 *  handles the swipe gesture itself; this just tracks which item ends up
 *  centered/paged-to and syncs that back into the same `current`/`goTo`
 *  state each card's full-size view already drives via its nav arrows, so
 *  both stay in agreement regardless of which one last moved it. Plain
 *  scroll-snap (not Motion's drag system) because bubble/step items have
 *  non-uniform widths that don't fit Motion's fixed-step track-offset math
 *  the full-size cards use. */
export function SwipeStrip({
  count,
  current,
  onCurrentChange,
  variant,
  className,
  itemWrapperClassName,
  gapClassName = "gap-1.5",
  children,
}: SwipeStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isFirstRender = useRef(true);
  const rafRef = useRef(0);
  const dragRef = useRef<{ startX: number; startScroll: number } | null>(null);
  // Set right before every programmatic scroll (the effect below, reacting
  // to an external `current` change — e.g. Duration auto-advancing to a
  // fresh instance after a pause) and cleared once it actually finishes.
  // Without this, the "scroll" events that scroll itself fires while
  // animating are indistinguishable from a genuine user swipe, so
  // handleScroll's own onCurrentChange call was reporting the
  // (mid-animation, not-yet-settled) scroll position right back as if the
  // user had dragged there — clobbering the very update that caused the
  // scroll in the first place, sometimes right back to where it started.
  const programmaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef(0);
  // The index the most recent programmatic scroll was asked to reach —
  // compared against where the strip actually lands (see the "scrollend"
  // effect below) so a premature/misfired settle can be told apart from a
  // genuine one instead of being taken at face value.
  const targetIndexRef = useRef<number | null>(null);
  // The index handleScroll itself most recently reported via
  // onCurrentChange — set right before that call, consumed by the
  // `current`-driven effect below. Without this, EVERY `current` update
  // (regardless of where it came from) re-issues a fresh programmatic
  // `scrollToIndex`, including the one caused by the user's own live
  // swipe/drag reporting its own position back up. That forced scroll then
  // fights the still-in-progress native touch scroll/momentum for control
  // of the same element, which is what actually produced this component's
  // reported symptoms — a mid-gesture jerk/stutter that can read as
  // "clipped," and, worse, a scroll that settles wherever the two competing
  // animations happened to cancel out instead of on a real snap point
  // ("stuck between" two items) even though CSS scroll-snap alone would
  // have settled it correctly once left uncontested. Consulted only to
  // decide whether THIS render's `current` change was self-reported; an
  // externally-driven change (a nav-arrow tap, a dot click, another
  // component's own `current` prop advancing) still gets the corrective
  // scroll it needs.
  const selfReportedIndexRef = useRef<number | null>(null);

  const computeClosestIndex = (el: HTMLDivElement): number => {
    if (variant === "paged") {
      const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      return Math.max(0, Math.min(count - 1, idx));
    }
    const rect = el.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    let closest = -1;
    let closestDist = Infinity;
    itemRefs.current.forEach((item, i) => {
      if (!item) return;
      const r = item.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - mid);
      if (d < closestDist) {
        closestDist = d;
        closest = i;
      }
    });
    return closest;
  };

  const scrollToIndex = (el: HTMLDivElement, index: number, behavior: ScrollBehavior) => {
    if (variant === "paged") {
      el.scrollTo({ left: index * el.clientWidth, behavior });
    } else {
      itemRefs.current[index]?.scrollIntoView({ inline: "center", block: "nearest", behavior });
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Read (and consume) the first-mount flag here, in the same effect that
    // uses it — a separate `[]`-deps effect for this used to fire and flip
    // it to false BEFORE this one ever read it (React runs a component's
    // effects in declaration order within the same commit), so `behavior`
    // was silently always "smooth", never "auto", even on true first mount.
    const behavior: ScrollBehavior = isFirstRender.current ? "auto" : "smooth";
    isFirstRender.current = false;
    // This `current` is just handleScroll's own live report of where the
    // user has already scrolled to — the element is already there (or the
    // browser's own native scroll/snap is already carrying it there), so
    // forcing another programmatic scroll on top of it would only fight
    // that in-progress gesture. See selfReportedIndexRef's own comment.
    if (selfReportedIndexRef.current === current) {
      selfReportedIndexRef.current = null;
      return;
    }
    targetIndexRef.current = current;
    programmaticScrollRef.current = true;
    window.clearTimeout(programmaticScrollTimeoutRef.current);
    // "scrollend" is the precise signal, but isn't universally supported —
    // this timeout is a backstop so the flag can't get stuck true forever
    // on a browser that never fires it.
    programmaticScrollTimeoutRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 500);
    scrollToIndex(el, current, behavior);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, variant]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScrollEnd = () => {
      // CSS scroll-snap can end an in-flight smooth scroll early — e.g. a
      // layout shift mid-animation (a sibling ResizeObserver update, a
      // width still settling right after mount) makes the browser treat
      // the nearest snap point as "arrived" and fire scrollend well short
      // of the actual target. Trusting that blindly let handleScroll read
      // the (wrong, barely-moved) settle position and report it back as if
      // the user had swiped there, silently overwriting real `current`
      // state on nothing more than a display-mode remount. Verifying we
      // actually reached the requested index — and retrying once,
      // instantly, if not — makes this self-correct instead.
      const target = targetIndexRef.current;
      if (target !== null && computeClosestIndex(el) !== target) {
        scrollToIndex(el, target, "auto");
        return;
      }
      window.clearTimeout(programmaticScrollTimeoutRef.current);
      programmaticScrollRef.current = false;
    };
    el.addEventListener("scrollend", onScrollEnd);
    return () => el.removeEventListener("scrollend", onScrollEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  const handleScroll = () => {
    if (programmaticScrollRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      const closest = computeClosestIndex(el);
      if (closest !== -1 && closest !== current) {
        selfReportedIndexRef.current = closest;
        // Backstop for a caller that clamps/rejects this index (e.g.
        // TrialCard's own goTo refusing to jump past the last completed
        // trial) — `current` then never actually changes, so the
        // `current`-driven effect above never runs to consume (and clear)
        // this ref itself, which would otherwise wrongly suppress a real
        // future correction that happens to land on the same index.
        window.setTimeout(() => {
          if (selfReportedIndexRef.current === closest) selfReportedIndexRef.current = null;
        }, 50);
        onCurrentChange(closest);
      }
    });
  };

  // Touch already scrolls the strip natively — this just lets a mouse do the
  // same (for desktop/trackpad use and Playwright testing), matching the
  // design mockup's own drag shim.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    // Duration's instance pages embed a real play/pause button directly
    // inside the strip's own items (unlike the bubble/step strips, whose
    // buttons live outside it in the tile's `actions` row) — capturing the
    // pointer unconditionally would reroute that button's own click to this
    // container instead, silently swallowing it. Letting the click through
    // untouched here is safe either way: a genuine drag starts moving the
    // pointer before any click fires, so a real button press is never
    // mistaken for one.
    if ((e.target as HTMLElement).closest("button")) return;
    const el = scrollRef.current;
    if (!el) return;
    // Without this, a mouse-based drag also kicks off the browser's native
    // text-selection drag as the pointer crosses over the item labels —
    // touch doesn't have this problem since it never selects text on scroll.
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startScroll: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const el = scrollRef.current;
    if (!drag || !el) return;
    el.scrollLeft = drag.startScroll - (e.clientX - drag.startX);
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      // touchAction: "pan-x" — this strip scrolls natively (real
      // `overflow-x-auto`, no Framer drag involved — unlike the app's other
      // draggable carousels, which get Framer's own automatic touch-action
      // handling for free). Left at the browser's default "auto", a touch
      // starting here makes the browser disambiguate between this
      // element's own horizontal scroll and the PAGE's vertical scroll
      // purely from the gesture's initial angle — occasionally guessing
      // wrong, or settling on one only after a visible catch/stutter, on a
      // diagonal-enough swipe. "pan-x" (not "pan-y") declares which native
      // gesture this element itself claims — horizontal, since that's the
      // only direction it actually scrolls — so any vertical component of
      // the gesture is immediately the PAGE's to handle, never this strip's
      // to first contest and then release.
      style={{ touchAction: "pan-x" }}
      className={cn(
        "no-scrollbar flex items-center overflow-x-auto snap-x snap-mandatory cursor-grab active:cursor-grabbing",
        variant === "centered" && ["px-[50%]", gapClassName],
        className,
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          className={cn(
            "shrink-0",
            variant === "centered" ? "snap-center" : "snap-start w-full",
            itemWrapperClassName,
          )}
        >
          {children(i, i === current)}
        </div>
      ))}
    </div>
  );
}
