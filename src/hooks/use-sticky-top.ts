import { useEffect, useState } from "react";

/** Height of the fixed `[data-status-bar]` header, kept in sync via ResizeObserver. */
export function useStickyTop() {
  const [stickyTop, setStickyTop] = useState(0);

  useEffect(() => {
    const bar = document.querySelector("[data-status-bar]") as HTMLElement | null;
    if (!bar) return;
    const update = () => setStickyTop(bar.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(bar);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return stickyTop;
}
