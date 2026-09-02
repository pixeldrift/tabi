import {
  GripVertical,
  Bookmark,
  EyeOff,
  Minus,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Check,
  CircleSlash2,
  Frown,
  Pencil,
  Search,
  Stamp,
  Star,
  Target,
  Delete,
  RotateCcw,
  Volume2,
  HandHelping,
  Play,
  Pause,
  Sparkles,
  Link2,
  Bell,
  BellRing,
  BellOff,
  MessageSquare,
  Megaphone,
  ArrowRight,
  VolumeX,
  User,
  Timer,
  ClipboardList,
  CalendarDays,
  Trash2,
  ArrowUp,
  ArrowLeft,
  RefreshCw,
  Upload,
  Settings as SettingsIcon,
  PencilOff,
  Pin,
  Rows3,
  TriangleAlert,
  ArrowLeftToLine,
  ArrowRightToLine,
  Copy,
  CheckCircle2,
  ChevronsUpDown,
  ChevronsDownUp,
  ChevronLeft,
  ChevronRight,
  Brain,
  Ruler,
  Package,
  AlignLeft,
  Video,
  Lightbulb,
  Ban,
  LockKeyholeOpen,
  Clock,
  BookOpen,
  UserCog,
  Compass,
  Eye,
  Group,
  ArrowDownToLine,
  CircleDashed,
  ClipboardCheck,
  ClipboardX,
  PanelBottomClose,
  PanelBottomOpen,
  GraduationCap,
} from "lucide-react";
import { PercentCorrectIcon } from "./PercentCorrectIcon";
import { FrequencyIcon } from "./FrequencyIcon";
import { DurationIcon } from "./DurationIcon";
import { RateIcon } from "./RateIcon";
import { TaskAnalysisIcon } from "./TaskAnalysisIcon";
import { IntervalIcon } from "./IntervalIcon";
import { IntervalWholeIcon } from "./IntervalWholeIcon";
import { IntervalPartialIcon } from "./IntervalPartialIcon";
import { IntervalMomentaryIcon } from "./IntervalMomentaryIcon";
import { VerbalPromptIcon } from "./VerbalPromptIcon";
import { GesturalPromptIcon } from "./GesturalPromptIcon";
import { ModelingPromptIcon } from "./ModelingPromptIcon";
import { PartialPhysicalPromptIcon } from "./PartialPhysicalPromptIcon";
import { FullPhysicalPromptIcon } from "./FullPhysicalPromptIcon";
import { ProbingIcon } from "./ProbingIcon";
import { BaselineIcon } from "./BaselineIcon";
import { InterventionIcon } from "./InterventionIcon";
import { MaintenanceIcon } from "./MaintenanceIcon";
import { FadingIcon } from "./FadingIcon";
import { PairingIcon } from "./PairingIcon";
import { AntecedentIcon } from "./AntecedentIcon";
import { FunctionIcon } from "./FunctionIcon";
import { ListViewIcon } from "./ListViewIcon";
import { CardViewIcon } from "./CardViewIcon";
import { GridViewIcon } from "./GridViewIcon";
import { SmallGridViewIcon } from "./SmallGridViewIcon";
import { ProportionalRowsIcon } from "./ProportionalRowsIcon";
import { CollapseIcon } from "./CollapseIcon";
import { TimeChevronIcon } from "./TimeChevronIcon";
import { FilterIcon } from "./FilterIcon";
import { NumberPadIcon } from "./NumberPadIcon";
import { DetailsIcon } from "./DetailsIcon";
import { InfoIcon } from "./InfoIcon";
import { SmileyIcon } from "./SmileyIcon";
import { ChatIcon } from "./ChatIcon";
import { EmailIcon } from "./EmailIcon";
import { PhoneIcon } from "./PhoneIcon";
import { RequestEditIcon } from "./RequestEditIcon";
import { ChecklistIcon } from "./ChecklistIcon";
import { ProductIcon } from "./ProductIcon";
import { DailyIcon } from "./DailyIcon";
import { HandshakeIcon } from "./HandshakeIcon";
import { ApproveEditIcon } from "./ApproveEditIcon";
import { ForwardChainingIcon } from "./ForwardChainingIcon";
import { BackwardChainingIcon } from "./BackwardChainingIcon";
import { MergeArrowIcon } from "./MergeArrowIcon";
import { ExitIcon } from "./ExitIcon";

export interface IconEntry {
  name: string;
  /** Where in the app this icon is used, for orientation. */
  usage: string;
  source: "custom" | "lucide";
  Icon: React.ComponentType<{ className?: string }>;
}

export interface IconGroup {
  group: string;
  icons: IconEntry[];
}

const lucide = (
  name: string,
  usage: string,
  Icon: React.ComponentType<{ className?: string }>,
): IconEntry => ({
  name,
  usage,
  source: "lucide",
  Icon,
});

const custom = (
  name: string,
  usage: string,
  Icon: React.ComponentType<{ className?: string }>,
): IconEntry => ({
  name,
  usage,
  source: "custom",
  Icon,
});

/** Every icon used anywhere in the app, grouped by what it's for — the data
 *  backing the Settings "Icons" showcase. Update alongside the icon set
 *  itself (new custom SVG, or a newly-imported lucide-react icon) so the
 *  showcase stays a real inventory instead of drifting out of date. */
export const ICON_GROUPS: IconGroup[] = [
  {
    group: "Data type icons",
    icons: [
      custom("Percent Correct", "Trial/percent-correct card kind", PercentCorrectIcon),
      custom("Frequency", "Frequency card kind", FrequencyIcon),
      custom("Duration", "Duration card kind", DurationIcon),
      custom("Rate", "Rate card kind", RateIcon),
      custom("Task Analysis", "Task Analysis card kind", TaskAnalysisIcon),
      custom("Interval", "Interval card kind", IntervalIcon),
      custom("Interval — Whole", "Whole Interval Recording corner icon", IntervalWholeIcon),
      custom("Interval — Partial", "Partial Interval Recording corner icon", IntervalPartialIcon),
      custom("Interval — Momentary", "Momentary Time Sampling corner icon", IntervalMomentaryIcon),
      custom("Checklist", "Checklist card kind", ChecklistIcon),
      lucide("Star", "Score card kind + score selector", Star),
      lucide("Stamp", "Timestamp card kind", Stamp),
      custom("Product", "Permanent Work Product card kind", ProductIcon),
    ],
  },
  {
    group: "Phases",
    icons: [
      custom("Probing", "Phase indicator (drawer quick facts)", ProbingIcon),
      custom("Baseline", "Phase indicator (drawer quick facts)", BaselineIcon),
      custom("Intervention", "Phase indicator (drawer quick facts)", InterventionIcon),
      custom("Maintenance", "Phase indicator (drawer quick facts)", MaintenanceIcon),
      custom("Fading", "Phase indicator (drawer quick facts)", FadingIcon),
      lucide("GraduationCap", "Mastered phase indicator (drawer quick facts)", GraduationCap),
      custom("Pairing", "Not yet wired up — added for future use", PairingIcon),
      custom("Antecedent", "Not yet wired up — added for future use", AntecedentIcon),
      custom("Function", "Not yet wired up — added for future use", FunctionIcon),
    ],
  },
  {
    group: "Prompt levels",
    icons: [
      custom("Verbal Prompt", "Trial prompt-level picker", VerbalPromptIcon),
      custom("Gestural Prompt", "Trial prompt-level picker", GesturalPromptIcon),
      custom("Modeling Prompt", "Trial prompt-level picker", ModelingPromptIcon),
      custom("Partial Physical Prompt", "Trial prompt-level picker", PartialPhysicalPromptIcon),
      custom("Full Physical Prompt", "Trial prompt-level picker", FullPhysicalPromptIcon),
      lucide("HandHelping", 'Task Analysis "prompted" response', HandHelping),
      lucide("CircleSlash2", 'Trial "no opportunity" state', CircleSlash2),
    ],
  },
  {
    group: "View & layout",
    icons: [
      custom("List View", "Data toolbar view toggle", ListViewIcon),
      custom("Card View", "Data toolbar view toggle", CardViewIcon),
      custom("Grid View", "Data toolbar view toggle (large grid)", GridViewIcon),
      custom("Small Grid View", "Data toolbar view toggle (small grid)", SmallGridViewIcon),
      custom("Proportional Rows", "Schedule proportional/collapsed toggle", ProportionalRowsIcon),
      custom("Collapse", "Schedule row collapse toggle", CollapseIcon),
      custom("Time Chevron", "Select dropdown chevron", TimeChevronIcon),
      lucide("ChevronUp", "Details drawer / dropdowns", ChevronUp),
      lucide("ChevronDown", "Details drawer / dropdowns", ChevronDown),
      lucide("Rows3", "Schedule proportional rows view", Rows3),
      lucide("PanelBottomClose", "Hide bookmark bar toggle", PanelBottomClose),
      lucide("PanelBottomOpen", "Show bookmark bar toggle", PanelBottomOpen),
    ],
  },
  {
    group: "Filters & search",
    icons: [
      custom("Filter", "Data toolbar filter popover", FilterIcon),
      lucide("Search", "Data toolbar search box", Search),
      lucide("Frown", '"Interfering behavior" filter', Frown),
      lucide("Target", '"Target goal" filter / notification', Target),
      lucide("Bookmark", "Favorite toggle", Bookmark),
      lucide("EyeOff", 'Hidden toggle / "Hidden" filter chip', EyeOff),
      lucide("ClipboardCheck", '"With Data" filter chip', ClipboardCheck),
      lucide("ClipboardX", '"No Data" filter chip', ClipboardX),
      lucide("CircleDashed", '"Incomplete" completion filter chip', CircleDashed),
    ],
  },
  {
    group: "Card & row actions",
    icons: [
      lucide("GripVertical", "Edit-mode drag handle", GripVertical),
      lucide("Pencil", "Edit-mode toggle", Pencil),
      lucide("PencilOff", "Exit Schedule edit mode", PencilOff),
      lucide("Pin", "Pinned Schedule appointment", Pin),
      lucide("Copy", "Duplicate Schedule appointment", Copy),
      lucide("Trash2", "Delete session / appointment", Trash2),
      lucide("RefreshCw", "Resume session", RefreshCw),
      custom("Number Pad", '"Tap to edit" hint beside numeric values', NumberPadIcon),
      custom("Details", "Open card details drawer", DetailsIcon),
      custom("Handshake", "Co-treat appointment indicator (Schedule)", HandshakeIcon),
      custom("Forward Chaining", "Task Analysis chaining-direction indicator", ForwardChainingIcon),
      custom(
        "Backward Chaining",
        "Task Analysis chaining-direction indicator",
        BackwardChainingIcon,
      ),
    ],
  },
  {
    group: "Data entry & keypad",
    icons: [
      lucide("Delete", "Keypad backspace key", Delete),
      lucide("Plus", "Increment / Add value", Plus),
      lucide("Minus", "Decrement value", Minus),
      lucide("Check", "Confirm / correct response", Check),
      lucide("X", "Cancel / incorrect response / dismiss", X),
    ],
  },
  {
    group: "Timers & session",
    icons: [
      lucide("Play", "Start/resume a timer", Play),
      lucide("Pause", "Pause a timer", Pause),
      lucide("Timer", "Active-duration header indicator", Timer),
      lucide("Link2", "Synced session timer (Rate card)", Link2),
      lucide("ArrowUp", "Collapse / scroll to top", ArrowUp),
      lucide("ArrowLeft", "Back navigation", ArrowLeft),
      lucide("ArrowRight", "Notification / step forward", ArrowRight),
      lucide("Upload", "Submit session data", Upload),
      lucide("Settings", "Settings tab", SettingsIcon),
      lucide("Ban", '"Minimums Not Met" section — End Session review', Ban),
      lucide("LockKeyholeOpen", "Unlock Review Mode button", LockKeyholeOpen),
      lucide("Clock", "Per-timed-period unit hint (Rate card)", Clock),
      custom("Merge Arrow", "Join-session button on the big session pill", MergeArrowIcon),
      custom("Exit", "'Exit and leave running' — pause-or-leave dialog", ExitIcon),
    ],
  },
  {
    group: "Notifications & alerts",
    icons: [
      lucide("Bell", "Active notification", Bell),
      lucide("BellRing", "Ringing/urgent notification", BellRing),
      lucide("BellOff", "Muted notifications", BellOff),
      lucide("VolumeX", "Silenced alert", VolumeX),
      lucide("Volume2", "Play alarm-sound preview", Volume2),
      lucide("MessageSquare", "Message-type notification", MessageSquare),
      lucide("Megaphone", "Announcement notification", Megaphone),
      lucide("TriangleAlert", "Schedule conflict warning", TriangleAlert),
      lucide("ArrowLeftToLine", "Collapse appointment to edge", ArrowLeftToLine),
      lucide("ArrowRightToLine", "Collapse appointment to edge", ArrowRightToLine),
      lucide("Group", "Group-by-type toggle — notifications panel", Group),
      lucide("ArrowDownToLine", '"Tap to jump" badge on a checkpoint-alert row', ArrowDownToLine),
      custom("Approve Edit", "'edit-approved' notification icon", ApproveEditIcon),
    ],
  },
  {
    group: "Navigation & misc",
    icons: [
      lucide("ClipboardList", "Data tab", ClipboardList),
      custom("Daily", "Schedule tab (today's rotation, not a real calendar)", DailyIcon),
      lucide(
        "CalendarDays",
        "Not yet wired up — reserved for a future full calendar view",
        CalendarDays,
      ),
      lucide("User", "Client profile", User),
      custom("Info", "Info tab / helper tooltips", InfoIcon),
      custom("Smiley", "Show/hide icons toggle", SmileyIcon),
      lucide("Sparkles", "Card shell decoration", Sparkles),
      lucide("RotateCcw", "Reset a setting to its default", RotateCcw),
      lucide("BookOpen", "Card-type field reference link — Settings", BookOpen),
      lucide("UserCog", "BCBA Tools section — Settings", UserCog),
      lucide("Compass", "Preview guided tour — Welcome screen", Compass),
      lucide("Eye", "Tap-to-zoom hint on a staff/client photo", Eye),
    ],
  },
  {
    group: "Contact (staff mini bio)",
    icons: [
      custom("Chat", "Message a staff member — mini bio popup (StaffDirectory)", ChatIcon),
      custom("Email", "Email a staff member — mini bio popup (StaffDirectory)", EmailIcon),
      custom(
        "Phone",
        "Call a staff member — mini bio popup, also guardian rows on Info tab",
        PhoneIcon,
      ),
    ],
  },
  {
    group: "Client Info tab",
    icons: [
      lucide("CheckCircle2", '"Pickup OK" badge — Guardians row', CheckCircle2),
      lucide("ChevronsUpDown", "Expand All — About Me section", ChevronsUpDown),
      lucide("ChevronsDownUp", "Collapse All — About Me section", ChevronsDownUp),
      custom("Request Edit", "Suggest a change to an About Me field", RequestEditIcon),
    ],
  },
  {
    group: "Card details drawer",
    icons: [
      lucide("Video", "Video row (tutorial-clip placeholder)", Video),
      lucide("AlignLeft", "Description row", AlignLeft),
      lucide("Brain", "Rationale row", Brain),
      lucide("Ruler", "Measurement row", Ruler),
      lucide("Package", "Materials row", Package),
      lucide(
        "Lightbulb",
        "Instructional Notes row; also the Phase/Data-type info popup",
        Lightbulb,
      ),
      lucide("ChevronLeft", "Previous card, within the drawer", ChevronLeft),
      lucide("ChevronRight", "Next card, within the drawer", ChevronRight),
    ],
  },
];
