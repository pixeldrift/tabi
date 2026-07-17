import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

// Tracks how much the OS on-screen keyboard has eaten into the viewport
// (window.innerHeight minus the visualViewport's visible height/offset), so
// a centered modal can shift itself up to stay clear of it — the keyboard
// resizes/offsets the visualViewport but not the fixed-position layout
// viewport a centered dialog is normally positioned against.
export function useKeyboardInset(active: boolean) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (!active) {
      setInset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);
  return inset;
}

// Shared with every text-entry dialog: shifts the modal up by half the
// keyboard's height so it stays centered in the space actually left visible
// above it, instead of the keyboard covering its buttons. The base
// DialogContent centers via Tailwind's `translate-x-[-50%] translate-y-[-50%]`
// classes — Tailwind v4 compiles those to the standalone CSS `translate`
// property, not `transform`, so an inline `transform` here would compose
// with (not replace) it and double the offset. Overriding the same
// `translate` property is what actually wins.
export function keyboardInsetStyle(inset: number): CSSProperties | undefined {
  return inset > 0 ? { translate: `-50% calc(-50% - ${inset / 2}px)` } : undefined;
}
