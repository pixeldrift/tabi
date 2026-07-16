import type { ReactNode } from "react";
import { PhaseInfoLabel, DataTypeInfoLabel } from "./KindInfoLabels";
import type { CardKind } from "./DataToolbarContext";

export interface DrawerStat {
  label: string;
  value: ReactNode;
}

/** Compact replacement for the old one-column Phase/Data-type/... dl — data
 *  type and phase are just two more entries in the same 2-column stats
 *  grid (each keeping its own icon next to the value), rather than a
 *  separately-styled block above it, so every fact in the drawer reads off
 *  the same label/value rhythm. Data type and Phase are both clickable
 *  (see PhaseInfoLabel/DataTypeInfoLabel), opening a modal explaining what
 *  that value means — the other stats are plain numbers specific to this
 *  one card, with nothing generic to explain. */
export function DrawerQuickFacts({
  icon,
  kind,
  dataTypeLabel,
  phase,
  stats,
}: {
  icon: ReactNode;
  kind: CardKind;
  dataTypeLabel: string;
  phase: string;
  stats: DrawerStat[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <div>
        <dt className="text-xs text-muted-foreground">Data type</dt>
        <dd>
          <DataTypeInfoLabel
            kind={kind}
            label={dataTypeLabel}
            icon={icon}
            className="font-medium flex items-center gap-1 min-w-0 max-w-full text-left hover:text-blue-600 transition-colors"
            iconClassName="shrink-0 [&>svg]:size-3.5"
            labelClassName="truncate"
          />
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Phase</dt>
        <dd>
          <PhaseInfoLabel
            phase={phase}
            className="font-medium flex items-center gap-1 min-w-0 max-w-full text-left hover:text-blue-600 transition-colors"
            iconClassName="shrink-0 [&>svg]:size-3.5"
            labelClassName="truncate"
          />
        </dd>
      </div>
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="font-medium tabular-nums">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
