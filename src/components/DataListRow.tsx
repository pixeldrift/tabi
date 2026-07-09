import { useRef, type ReactNode } from "react";
import { CardEditControls } from "./CardEditControls";
import { DataDetailsDrawer } from "./DataDetailsDrawer";
import { type CardEditAndDrawerProps } from "./CardShell";
import { cn } from "@/lib/utils";

export interface DataListRowProps extends CardEditAndDrawerProps {
  title: string;
  description?: string;
  /** Shown alone (no label), ahead of the title — phase and the data-type
   *  name itself aren't worth the space in a condensed list. */
  dataTypeIcon: ReactNode;
  dataTypeLabel: string;
  isActive?: boolean;
  onActivate?: () => void;
  /** Each card kind's own compact data-entry controls (a number/count badge
   *  plus a couple of small circular buttons, or a timer pill) — floated
   *  top-right rather than laid out in the header's normal flex flow, so it
   *  stays put in the same corner even when the title wraps to a second
   *  line instead of push down alongside it. */
  actions?: ReactNode;
}

/** The list `displayMode`'s row: a bare data-type icon then the title, no
 *  phase, no inline data-entry controls — there's no room for those in a
 *  single line. A tap selects the row; the drawer itself (once the row is
 *  active) is opened via its own pull-tab, not a per-row button — that
 *  would just duplicate the pull-tab in a view where space is tight. */
export function DataListRow({
  title,
  description,
  dataTypeIcon,
  dataTypeLabel,
  isActive = true,
  onActivate,
  reorderEditing = false,
  favorited = false,
  onToggleFavorite,
  cardHidden = false,
  onToggleHidden,
  dragControls,
  detailsOpen = false,
  onDetailsOpenChange,
  stickyTop = 0,
  toolbarHeight = 0,
  actions,
}: DataListRowProps) {
  const rowRef = useRef<HTMLElement | null>(null);
  const showActions = actions && !reorderEditing;

  return (
    <article
      ref={rowRef}
      onClick={onActivate}
      className={cn(
        "relative w-full max-w-md rounded-xl bg-card text-card-foreground transition-all duration-200",
        // Same rule every other card kind follows: 1px border by default,
        // 2px only for the active/selected blue highlight.
        isActive
          ? "border-2 border-blue-400/80 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.18)]"
          : "border border-stone-200 opacity-80 hover:opacity-95",
      )}
    >
      <div
        className={cn(
          "flex items-start gap-1.5 pl-2 py-2",
          reorderEditing ? "pr-3" : showActions ? "pr-32" : "pr-9",
        )}
      >
        {/* Unconditional — CardEditControls now lives in its own slot on
            the right (see below), so there's no layout conflict keeping
            this off during editing like there was when both shared one
            slot. */}
        <span
          className="shrink-0 text-muted-foreground [&>svg]:size-4"
          title={dataTypeLabel}
          aria-label={dataTypeLabel}
        >
          {dataTypeIcon}
        </span>
        <h2 className="font-display text-sm leading-[1.15] flex-1 min-w-0">{title}</h2>
        {/* Trails the title (not leading it, like the data-type icon does)
            so it sits at the row's right edge — same side CardShell's own
            edit controls occupy — and inherits this row's items-start,
            keeping it pinned to the top rather than centering across a
            title that's wrapped the row taller. */}
        {reorderEditing && (
          <CardEditControls
            favorited={favorited}
            onToggleFavorite={onToggleFavorite ?? (() => {})}
            cardHidden={cardHidden}
            onToggleHidden={onToggleHidden ?? (() => {})}
            dragControls={dragControls}
          />
        )}
      </div>

      {/* Floated (not part of the header's flex flow) so it stays pinned to
          this same top-right corner regardless of whether the title above
          it wraps to one line or two. */}
      {showActions && <div className="absolute top-1.5 right-1.5">{actions}</div>}

      {isActive && (
        <DataDetailsDrawer
          open={detailsOpen}
          onOpenChange={onDetailsOpenChange ?? (() => {})}
          title={title}
          description={description}
          top={stickyTop}
          toolbarHeight={toolbarHeight}
          cardRef={rowRef}
        />
      )}
    </article>
  );
}
