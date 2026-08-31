import type { ComponentType } from "react";
import { GraduationCap } from "lucide-react";
import { ProbingIcon } from "@/components/icons/ProbingIcon";
import { BaselineIcon } from "@/components/icons/BaselineIcon";
import { InterventionIcon } from "@/components/icons/InterventionIcon";
import { MaintenanceIcon } from "@/components/icons/MaintenanceIcon";
import { FadingIcon } from "@/components/icons/FadingIcon";

/** Only covers the phases this app actually ships with — an unrecognized
 *  custom phase just renders with no icon rather than needing this map kept
 *  exhaustively in sync. Typed as a plain component-with-className (rather
 *  than `typeof ProbingIcon`, this file's own custom-svg component type) so
 *  a stock lucide-react icon like Mastered's GraduationCap — same precedent
 *  as DATA_TYPE_INFO's own Score/Timestamp entries — fits alongside the
 *  custom SVGs without a wrapper. */
export const PHASE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Probing: ProbingIcon,
  Baseline: BaselineIcon,
  Intervention: InterventionIcon,
  Fading: FadingIcon,
  Maintenance: MaintenanceIcon,
  Mastered: GraduationCap,
};
