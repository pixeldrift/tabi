import { useRef, type ReactNode } from "react";
import { CardEditControls } from "./CardEditControls";
import { DataDetailsDrawer } from "./DataDetailsDrawer";
import { type CardEditAndDrawerProps } from "./CardShell";
import { cn } from "@/lib/utils";

export interface DataListRowProps extends CardEditAndDrawerProps {
  title: string;
  description?: string;
  /** Shown alone (no label) at the row's far right — phase and the
   *  data-type name itself aren't worth the space in a condensed list. */
  dataTypeIcon: ReactNode;
  dataTypeLabel: string;
  isActive?: boolean;
}

/** The list `displayMode`'s row: title plus a bare data-type icon, no phase,
 *  no inline data-entry controls — there's no room for those in a single
 *  line, so a tap opens the same shared details drawer every other card
 *  kind's own "info" button opens, rather than just toggling `isActive`
 *  with nothing else visibly changing. */
export function DataListRow({
  title,
  description,
  dataTypeIcon,
  dataTypeLabel,
  isActive = true,
  reorderEditing = false,
  favorited = false,
  onToggleFavorite,
  cardHidden = false,
  onToggleHidden,
  dragControls,
  detailsOpen = false,
  onDetailsOpenChange,
  onOpenDetails,
  stickyTop = 0,
  toolbarHeight = 0,
}: DataListRowProps) {
  const rowRef = useRef<HTMLElement | null>(null);

  return (
    <article
      ref={rowRef}
      className={cn(
        "relative w-full max-w-md rounded-xl bg-card text-card-foreground border-2 transition-all duration-200",
        isActive
          ? "border-blue-400/80 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.18)]"
          : "border-stone-200 opacity-80 hover:opacity-95",
      )}
    >
      <button
        type="button"
        // Suppressed while editing — same as every other card kind's own
        // "info" button, which reorderEditing hides outright rather than
        // leave reachable alongside the drag handle.
        onClick={reorderEditing ? undefined : onOpenDetails}
        className="flex w-full items-center gap-2 pl-4 pr-3 py-2.5 text-left"
      >
        <h2 className="font-display text-sm leading-tight flex-1 min-w-0 truncate mr-auto">{title}</h2>
        {reorderEditing ? (
          <CardEditControls
            favorited={favorited}
            onToggleFavorite={onToggleFavorite ?? (() => {})}
            cardHidden={cardHidden}
            onToggleHidden={onToggleHidden ?? (() => {})}
            dragControls={dragControls}
          />
        ) : (
          <span
            className="shrink-0 text-muted-foreground [&>svg]:size-4"
            title={dataTypeLabel}
            aria-label={dataTypeLabel}
          >
            {dataTypeIcon}
          </span>
        )}
      </button>

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
