import type { ReactNode } from "react";
import { PHASE_ICONS } from "@/lib/phaseIcons";

export interface DrawerStat {
  label: string;
  value: ReactNode;
}

/** Compact replacement for the old one-column Phase/Data-type/... dl —
 *  icon + data-type label sit on the left, phase (with its own icon) on the
 *  right of the same line, and the remaining numbers run in a 2-column grid
 *  instead of a full-width row each, so the whole block takes noticeably
 *  less vertical room in the details drawer. */
export function DrawerQuickFacts({
  icon,
  dataTypeLabel,
  phase,
  stats,
}: {
  icon: ReactNode;
  dataTypeLabel: string;
  phase: string;
  stats: DrawerStat[];
}) {
  const PhaseIcon = PHASE_ICONS[phase];
  return (
    <div>
      <div className="flex flex-col gap-0.5 text-sm text-foreground/80">
        <span className="flex items-center gap-1 min-w-0">
          <span className="shrink-0 [&>svg]:size-4" aria-hidden>
            {icon}
          </span>
          <span className="font-medium truncate">{dataTypeLabel}</span>
        </span>
        <span className="flex items-center gap-1 min-w-0 text-muted-foreground">
          {PhaseIcon && (
            <span className="shrink-0 [&>svg]:size-3.5" aria-hidden>
              <PhaseIcon />
            </span>
          )}
          <span className="truncate">{phase}</span>
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="font-medium tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
