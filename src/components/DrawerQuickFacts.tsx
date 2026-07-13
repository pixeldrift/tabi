import type { ReactNode } from "react";

export interface DrawerStat {
  label: string;
  value: ReactNode;
}

/** Compact replacement for the old one-column Phase/Data-type/... dl —
 *  icon + data-type label + phase collapse onto a single line (the same
 *  icon each card's own header already uses), and the remaining numbers
 *  run in a 2-column grid instead of a full-width row each, so the whole
 *  block takes noticeably less vertical room in the details drawer. */
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
  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm text-foreground/80">
        <span className="shrink-0 [&>svg]:size-4" aria-hidden>
          {icon}
        </span>
        <span className="font-medium">{dataTypeLabel}</span>
        <span className="text-muted-foreground" aria-hidden>
          &middot;
        </span>
        <span className="text-muted-foreground">{phase}</span>
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
