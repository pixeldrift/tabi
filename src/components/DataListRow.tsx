import { useRef, type ReactNode } from "react";
import { CardEditControls } from "./CardEditControls";
import { DataDetailsDrawer } from "./DataDetailsDrawer";
import { type CardEditAndDrawerProps } from "./CardShell";
import { renderBreakableTitle } from "./BreakableTitle";
import { DataTypeInfoLabel } from "./KindInfoLabels";
import type { CardKind } from "./DataToolbarContext";
import { cn } from "@/lib/utils";

export interface DataListRowProps extends CardEditAndDrawerProps {
  title: string;
  description?: string;
  /** Which data-type info modal to open when the leading icon is tapped —
   *  see DataTypeInfoLabel. */
  kind: CardKind;
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
  /** 0–100 progress — a thin, color-coded bar flush to the row's bottom
   *  edge, no label. Omit for kinds where a running percentage isn't
   *  meaningful (mirrors CardShell's own `progress={null}` for those). */
  progress?: number | null;
  isComplete?: boolean;
  /** Forwarded straight through to the shared drawer — same content each
   *  card kind already builds for CardShell/MiniTileShell's own `details`.
   *  Without this the drawer opens in list mode with a title but a
   *  permanently empty body, since there'd be nothing to forward. */
  details?: ReactNode;
}

/** The list `displayMode`'s row: a bare data-type icon then the title, no
 *  phase, no inline data-entry controls — there's no room for those in a
 *  single line. A tap selects the row; the drawer itself (once the row is
 *  active) is opened via its own pull-tab, not a per-row button — that
 *  would just duplicate the pull-tab in a view where space is tight. */
export function DataListRow({
  title,
  description,
  kind,
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
  progress,
  isComplete = false,
  onPrevCard,
  onNextCard,
  slideFrom,
  widthMode,
  onWidthModeChange,
  details,
}: DataListRowProps) {
  const rowRef = useRef<HTMLElement | null>(null);
  const showActions = actions && !reorderEditing;
  const showProgress = typeof progress === "number";
  const pct = showProgress ? Math.min(100, Math.max(0, progress!)) : 0;
  const barColor = isComplete ? "bg-green-500" : pct >= 50 ? "bg-yellow-400/30" : "bg-blue-400";

  return (
    <article
      ref={rowRef}
      onClick={onActivate}
      className={cn(
        // Border is ALWAYS 1px — see CardShell's own version of this
        // comment (the same ring-based fix, applied here for consistency
        // even though this row has no progress bar of its own yet to
        // reveal the shadow-clip half of that bug).
        "relative w-full max-w-md rounded-xl bg-card text-card-foreground transition-all duration-200",
        isActive
          ? "border border-blue-400/80 ring-2 ring-inset ring-blue-400/80 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.18)]"
          : "border border-border opacity-80 hover:opacity-95",
      )}
    >
      <div className="relative rounded-xl overflow-hidden">
      <div
        className={cn(
          // relative z-10: keeps this in-flow content painting above the
          // progress bar below, which is deliberately an absolutely
          // positioned background wash now (not a layout sibling the row
          // grows to fit) — see that div's own comment.
          "relative z-10 flex items-start gap-1.5 pl-2 py-2",
          reorderEditing ? "pr-3" : showActions ? "pr-32" : "pr-9",
        )}
      >
        {/* Unconditional — CardEditControls now lives in its own slot on
            the right (see below), so there's no layout conflict keeping
            this off during editing like there was when both shared one
            slot. */}
        <DataTypeInfoLabel
          kind={kind}
          label={dataTypeLabel}
          icon={dataTypeIcon}
          showLabel={false}
          className="shrink-0 text-muted-foreground hover:text-blue-600 transition-colors"
          iconClassName="[&>svg]:size-4"
        />
        <h2 className="font-display text-sm leading-[1.15] flex-1 min-w-0 break-words">
          {renderBreakableTitle(title)}
        </h2>
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
          this same vertically-centered right edge regardless of whether the
          title above it wraps to one line or two — centered against the
          row's full height (not the header alone) so it reads as equal top
          and bottom margins within the box either way. */}
      {showActions && <div className="absolute z-10 top-1/2 -translate-y-1/2 right-0.5">{actions}</div>}

      {/* A background wash tucked under the title only — stops well short
          of the floated actions cluster (rather than running the row's
          full width) so it never sits behind/underneath the buttons.
          Inset from the edges and rounded-full (rather than flush
          corner-to-corner) so it reads as sitting inside the row's own
          border instead of touching/merging into it — most visible once a
          selected row's ring makes that border more prominent. Only
          rendered where a running percentage is meaningful for the data
          type (Trial, Task Analysis); other kinds pass no `progress`. */}
      {showProgress && (
        <div
          className={cn(
            // left-[30px]: lines up with the title's own left edge (pl-2's
            // 8px + the data-type icon's 16px + the gap-1.5 between them),
            // not the icon's — the bar reads as belonging to the title, not
            // as a random line starting under an unrelated icon.
            "absolute left-[30px] bottom-1 z-0 h-0.5 rounded-full overflow-hidden bg-stone-200/80",
            showActions ? "right-32" : "right-9",
          )}
        >
          <div className={cn("h-full transition-[width]", barColor)} style={{ width: `${pct}%` }} />
        </div>
      )}
      </div>

      {isActive && (
        <DataDetailsDrawer
          open={detailsOpen}
          onOpenChange={onDetailsOpenChange ?? (() => {})}
          title={title}
          description={description}
          details={details}
          onPrevCard={onPrevCard}
          onNextCard={onNextCard}
          slideFrom={slideFrom}
          top={stickyTop}
          toolbarHeight={toolbarHeight}
          cardRef={rowRef}
          widthMode={widthMode}
          onWidthModeChange={onWidthModeChange}
        />
      )}
    </article>
  );
}
