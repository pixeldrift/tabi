import {
  GripVertical, Heart, EyeOff, Minus, Plus, X, ChevronUp, ChevronDown, Check, CircleSlash2,
  Frown, Pencil, Search, Star, Target, Delete, RotateCcw, Volume2, HandHelping, Play, Pause,
  Sparkles, Link2, Bell, BellRing, BellOff, MessageSquare, Megaphone, ArrowRight, VolumeX, User,
  Timer, ClipboardList, CalendarDays, Trash2, ArrowUp, ArrowLeft, RefreshCw, Upload,
  Settings as SettingsIcon, PencilOff, Pin, Rows3, TriangleAlert, ArrowLeftToLine, ArrowRightToLine, Copy,
} from "lucide-react";
import { PercentCorrectIcon } from "./PercentCorrectIcon";
import { FrequencyIcon } from "./FrequencyIcon";
import { DurationIcon } from "./DurationIcon";
import { RateIcon } from "./RateIcon";
import { TaskAnalysisIcon } from "./TaskAnalysisIcon";
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

const lucide = (name: string, usage: string, Icon: React.ComponentType<{ className?: string }>): IconEntry => ({
  name, usage, source: "lucide", Icon,
});

const custom = (name: string, usage: string, Icon: React.ComponentType<{ className?: string }>): IconEntry => ({
  name, usage, source: "custom", Icon,
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
      lucide("Star", "Rating card kind + rating selector", Star),
    ],
  },
  {
    group: "Phases",
    icons: [
      custom("Probing", "Phase indicator (drawer quick facts)", ProbingIcon),
      custom("Baseline", "Phase indicator (drawer quick facts)", BaselineIcon),
      custom("Intervention", "Phase indicator (drawer quick facts)", InterventionIcon),
      custom("Maintenance", "Phase indicator (drawer quick facts)", MaintenanceIcon),
      custom("Fading", "Not yet wired up — added for future use", FadingIcon),
      custom("Pairing", "Not yet wired up — added for future use", PairingIcon),
      custom("Antecedent", "Not yet wired up — added for future use", AntecedentIcon),
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
      lucide("HandHelping", "Task Analysis \"prompted\" response", HandHelping),
      lucide("CircleSlash2", "Trial \"no opportunity\" state", CircleSlash2),
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
    ],
  },
  {
    group: "Filters & search",
    icons: [
      custom("Filter", "Data toolbar filter popover", FilterIcon),
      lucide("Search", "Data toolbar search box", Search),
      lucide("Frown", "\"Interfering behavior\" filter", Frown),
      lucide("Target", "\"Target goal\" filter / notification", Target),
      lucide("Heart", "Favorite toggle", Heart),
      lucide("EyeOff", "Hidden toggle / \"Hidden\" filter chip", EyeOff),
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
      custom("Number Pad", "\"Tap to edit\" hint beside numeric values", NumberPadIcon),
      custom("Details", "Open card details drawer", DetailsIcon),
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
    ],
  },
  {
    group: "Navigation & misc",
    icons: [
      lucide("ClipboardList", "Data tab", ClipboardList),
      lucide("CalendarDays", "Schedule tab", CalendarDays),
      lucide("User", "Client profile", User),
      custom("Info", "Info tab / helper tooltips", InfoIcon),
      custom("Smiley", "Show/hide icons toggle", SmileyIcon),
      lucide("Sparkles", "Card shell decoration", Sparkles),
      lucide("RotateCcw", "Reset a setting to its default", RotateCcw),
    ],
  },
  {
    group: "Contact (BCBA info card)",
    icons: [
      custom("Chat", "Message the BCBA — Info tab (planned)", ChatIcon),
      custom("Email", "Email the BCBA — Info tab (planned)", EmailIcon),
      custom("Phone", "Call the BCBA — Info tab (planned)", PhoneIcon),
    ],
  },
];
