import { useState, type ReactNode } from "react";
import { PHASE_ICONS } from "@/lib/phaseIcons";
import { DATA_TYPE_INFO, PHASE_INFO } from "@/lib/dataTypeInfo";
import { DrawerInfoModal } from "./DrawerInfoModal";
import type { CardKind } from "./DataToolbarContext";

export interface DrawerStat {
  label: string;
  value: ReactNode;
}

/** Compact replacement for the old one-column Phase/Data-type/... dl — data
 *  type and phase are just two more entries in the same 2-column stats
 *  grid (each keeping its own icon next to the value), rather than a
 *  separately-styled block above it, so every fact in the drawer reads off
 *  the same label/value rhythm. Data type and Phase are both clickable,
 *  opening a modal explaining what that value means (see DrawerInfoModal) —
 *  the other stats are plain numbers specific to this one card, with
 *  nothing generic to explain. */
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
  const PhaseIcon = PHASE_ICONS[phase];
  const [openModal, setOpenModal] = useState<"dataType" | "phase" | null>(null);
  const dataTypeInfo = DATA_TYPE_INFO[kind];
  const phaseInfo = PHASE_INFO[phase];
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Data type</dt>
          <dd>
            <button
              type="button"
              onClick={() => setOpenModal("dataType")}
              className="font-medium flex items-center gap-1 min-w-0 max-w-full text-left hover:text-blue-600 transition-colors"
            >
              <span className="shrink-0 [&>svg]:size-3.5" aria-hidden>
                {icon}
              </span>
              <span className="truncate">{dataTypeLabel}</span>
            </button>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Phase</dt>
          <dd>
            <button
              type="button"
              onClick={() => setOpenModal("phase")}
              disabled={!phaseInfo}
              className="font-medium flex items-center gap-1 min-w-0 max-w-full text-left hover:text-blue-600 transition-colors disabled:pointer-events-none"
            >
              {PhaseIcon && (
                <span className="shrink-0 [&>svg]:size-3.5" aria-hidden>
                  <PhaseIcon />
                </span>
              )}
              <span className="truncate">{phase}</span>
            </button>
          </dd>
        </div>
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="font-medium tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {dataTypeInfo && (
        <DrawerInfoModal
          open={openModal === "dataType"}
          onOpenChange={(v) => setOpenModal(v ? "dataType" : null)}
          icon={dataTypeInfo.icon}
          title={dataTypeInfo.label}
          description={dataTypeInfo.description}
        />
      )}
      {phaseInfo && (
        <DrawerInfoModal
          open={openModal === "phase"}
          onOpenChange={(v) => setOpenModal(v ? "phase" : null)}
          icon={PhaseIcon ? <PhaseIcon /> : null}
          title={phase}
          description={phaseInfo.description}
        />
      )}
    </>
  );
}
