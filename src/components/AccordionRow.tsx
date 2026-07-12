import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccordionRowProps {
  id: string;
  emoji: string;
  label: string;
  collapsed: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
  /** Optional slot rendered in the row's bottom-right corner while expanded
   *  (e.g. About Me's "Request an edit" affordance) — omitted entirely for
   *  plain reference content that has nothing to act on. */
  action?: React.ReactNode;
}

/** A single twirldown row — chevron + emoji + label toggles content that
 *  unmounts (not just hides) while collapsed, so a long list of them
 *  collapses down to something actually short. Shared by About Me's notes
 *  list and the teaching-procedure accordion in card details drawers. */
export function AccordionRow({ id, emoji, label, collapsed, onToggle, children, action }: AccordionRowProps) {
  return (
    <div className={cn("relative p-3", !collapsed && action && "pr-9")}>
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-1 text-left"
      >
        <ChevronDown
          className={cn("size-3.5 shrink-0 text-stone-400 transition-transform", collapsed && "-rotate-90")}
        />
        <span aria-hidden>{emoji}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</span>
      </button>
      {!collapsed && (
        <>
          <div className="mt-1 pl-[18px] leading-snug text-foreground/90">{children}</div>
          {action}
        </>
      )}
    </div>
  );
}
