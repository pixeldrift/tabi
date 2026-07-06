import { useRef, type ReactNode } from "react";
import { DetailsIcon } from "./icons/DetailsIcon";
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
}

/** The list `displayMode`'s row: a bare data-type icon then the title, no
 *  phase, no inline data-entry controls — there's no room for those in a
 *  single line. A tap just selects the row (matching every other card
 *  kind's own whole-card click); its own "info" button — same circle/border
 *  style as a full card's — is what opens the shared details drawer, rather
 *  than the row itself auto-opening it. */
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
  onOpenDetails,
  stickyTop = 0,
  toolbarHeight = 0,
}: DataListRowProps) {
  const rowRef = useRef<HTMLElement | null>(null);

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
      <div className={cn("flex items-start gap-1.5 pl-2 py-2", reorderEditing ? "pr-3" : "pr-9")}>
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

      {/* Same circle/border "info" button every full card shows — hidden in
          edit mode along with the drag/favorite/hide row it'd otherwise sit
          alongside, same as CardShell. */}
      {!reorderEditing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails?.();
          }}
          aria-label="Card details"
          className="absolute right-1 top-1/2 -translate-y-1/2 grid size-6 place-items-center rounded-full border border-current text-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <DetailsIcon className="size-4" strokeWidth={1.5} />
        </button>
      )}

      {isActive && (
        <DataDetailsDrawer
          open={detailsOpen}
          onOpenChange={onDetailsOpenChange ?? (() => {})}
          title={title}
          description={description}
          top={stickyTop}
          toolbarHeight={toolbarHeight}
          cardRef={rowRef}
          // Past half the viewport — extra reach past the list's own
          // compressed width (see the width calc above) so the panel's left
          // edge fully covers a row's "info" button rather than leaving a
          // sliver of it exposed (the button's own right-1 inset plus its
          // 24px width lands just past a flat +10px, so a little more is
          // needed for full coverage rather than a hairline gap).
          widthClassName="w-[calc(50%+14px)]"
        />
      )}
    </article>
  );
}
