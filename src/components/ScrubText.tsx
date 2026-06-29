import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Tap-and-drag horizontally to scrub through truncated text.
 * Shows a right-edge fade mask only when text actually overflows.
 * After release, eases back to start after 3s idle.
 */
export function ScrubText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const idleTimerRef = useRef<number | null>(null);

  const clamp = (v: number) => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return 0;
    const min = Math.min(0, wrap.clientWidth - inner.scrollWidth);
    return Math.max(min, Math.min(0, v));
  };

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    setOverflowing(inner.scrollWidth > wrap.clientWidth + 1);
  }, [text]);

  useEffect(() => {
    const onResize = () => {
      const wrap = wrapRef.current;
      const inner = innerRef.current;
      if (!wrap || !inner) return;
      setOverflowing(inner.scrollWidth > wrap.clientWidth + 1);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  const scheduleReset = () => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setX(0), 3000);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!overflowing) return;
    setDragging(true);
    startXRef.current = e.clientX;
    startOffsetRef.current = x;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const delta = e.clientX - startXRef.current;
    setX(clamp(startOffsetRef.current + delta));
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    scheduleReset();
  };

  // Fade only the visible end(s) when overflowing.
  const fadeRight = overflowing && x > -1; // not fully scrolled to the end
  const fadeLeft = overflowing && x < -1; // user scrubbed in from the right
  const mask = overflowing
    ? `linear-gradient(to right, ${fadeLeft ? "transparent" : "black"} 0, black 8px, black calc(100% - 12px), ${fadeRight ? "transparent" : "black"} 100%)`
    : undefined;

  return (
    <div
      ref={wrapRef}
      className={cn("relative overflow-hidden touch-pan-y select-none", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={mask ? { WebkitMaskImage: mask, maskImage: mask } : undefined}
    >
      <span
        ref={innerRef}
        className="inline-block whitespace-nowrap"
        style={{
          transform: `translateX(${x}px)`,
          transition: dragging ? "none" : "transform 0.45s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {text}
      </span>
    </div>
  );
}
