import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Tap-and-drag horizontally to scrub through truncated text.
 * Drag distance is clamped 0..-(scrollWidth - clientWidth). After release,
 * the text eases back to start after 3s of idle.
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
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const idleTimerRef = useRef<number | null>(null);

  const clamp = (v: number) => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return 0;
    const max = 0;
    const min = Math.min(0, wrap.clientWidth - inner.scrollWidth);
    return Math.max(min, Math.min(max, v));
  };

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  const scheduleReset = () => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setX(0), 3000);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    if (inner.scrollWidth <= wrap.clientWidth) return; // not truncated
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

  return (
    <div
      ref={wrapRef}
      className={cn("relative overflow-hidden touch-pan-y select-none", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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
