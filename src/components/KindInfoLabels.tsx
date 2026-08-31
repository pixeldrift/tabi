import { useState, type ReactNode } from "react";
import { PHASE_ICONS } from "@/lib/phaseIcons";
import { DATA_TYPE_INFO, PHASE_INFO } from "@/lib/dataTypeInfo";
import { DrawerInfoModal } from "./DrawerInfoModal";
import type { CardKind } from "./DataToolbarContext";
import { cn } from "@/lib/utils";

/** Phase label shown in a card's own header (CardShell/TrialCard) or the
 *  drawer's quick facts (DrawerQuickFacts) — same clickable icon+text
 *  everywhere, opening the shared "what does this phase mean" modal (see
 *  DrawerInfoModal). Kept as one component (rather than copy-pasted at
 *  each call site) so every surface the phase appears on triggers the
 *  identical popup instead of subtly drifting apart. */
export function PhaseInfoLabel({
  phase,
  className,
  iconClassName = "shrink-0 not-italic [&>svg]:size-3",
  labelClassName,
}: {
  phase: string;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const PhaseIcon = PHASE_ICONS[phase];
  const info = PHASE_INFO[phase];
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        disabled={!info}
        data-tour="card-phase-label"
        className={cn(className, "disabled:pointer-events-none")}
      >
        {PhaseIcon && (
          <span className={iconClassName}>
            <PhaseIcon />
          </span>
        )}
        <span className={labelClassName}>{phase}</span>
      </button>
      {info && (
        <DrawerInfoModal
          open={open}
          onOpenChange={setOpen}
          icon={PhaseIcon ? <PhaseIcon /> : null}
          kindLabel="Phase"
          title={phase}
          description={info.description}
        />
      )}
    </>
  );
}

/** Data-type label shown in a card's own header, a list row's leading
 *  icon, or the drawer's quick facts — same idea as PhaseInfoLabel above.
 *  `showLabel={false}` (DataListRow's bare-icon case) still gets a title/
 *  aria-label so the value is discoverable without the visible text.
 *  `label` is the short, card-facing name (what's actually displayed here);
 *  the modal it opens always titles itself with the kind's own full name
 *  from DATA_TYPE_INFO instead, so a compact card can say "Task" while
 *  tapping it still explains itself as "Task Analysis". */
export function DataTypeInfoLabel({
  kind,
  label,
  icon,
  className,
  iconClassName = "shrink-0 [&>svg]:size-3",
  labelClassName,
  showLabel = true,
}: {
  kind: CardKind;
  label: string;
  icon: ReactNode;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const info = DATA_TYPE_INFO[kind];
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title={!showLabel ? label : undefined}
        aria-label={!showLabel ? label : undefined}
        data-tour="card-datatype-label"
        className={className}
      >
        <span className={iconClassName}>{icon}</span>
        {showLabel && <span className={labelClassName}>{label}</span>}
      </button>
      {info && (
        <DrawerInfoModal
          open={open}
          onOpenChange={setOpen}
          // The passed-in `icon`, not `info.icon` — for most kinds they're
          // the same, but Interval passes its own per-sampling-type variant
          // (Whole/Partial/Momentary), and info.icon here is only ever the
          // one generic icon keyed by CardKind, which would silently
          // override that back to a plain clock for every variant.
          icon={icon}
          kindLabel="Data Type"
          // info.label (full name), not the short `label` this button
          // itself displays — see this function's own doc comment.
          title={info.label}
          description={info.description}
        />
      )}
    </>
  );
}
