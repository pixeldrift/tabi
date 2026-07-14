import { ProbingIcon } from "@/components/icons/ProbingIcon";
import { BaselineIcon } from "@/components/icons/BaselineIcon";
import { InterventionIcon } from "@/components/icons/InterventionIcon";
import { MaintenanceIcon } from "@/components/icons/MaintenanceIcon";

/** Only covers the phases this app actually ships with — an unrecognized
 *  custom phase just renders with no icon rather than needing this map kept
 *  exhaustively in sync. */
export const PHASE_ICONS: Record<string, typeof ProbingIcon> = {
  Probing: ProbingIcon,
  Baseline: BaselineIcon,
  Intervention: InterventionIcon,
  Maintenance: MaintenanceIcon,
};
