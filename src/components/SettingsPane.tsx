import { useState, type RefObject } from "react";
import { BookOpen, Lightbulb, RotateCcw, UserCog, Volume2 } from "lucide-react";
import {
  ALARM_SOUND_OPTIONS,
  COLOR_THEME_OPTIONS,
  DEFAULT_DAY_END,
  DEFAULT_DAY_START,
  SETTINGS,
  useSettings,
  type AlarmSoundStyle,
} from "./SettingsContext";
import { DISPLAY_MODES } from "./DataToolbarContext";
import { TABS } from "./StatusBar";
import { TimeOfDayKeypad, formatTimeOfDay } from "./TimeOfDayKeypad";
import { IconsShowcase } from "./IconsShowcase";
import { ColorPaletteShowcase } from "./ColorPaletteShowcase";
import { SectionJumpBar } from "@/components/SectionJumpBar";
import { useTour } from "./TourContext";
import { useTip } from "./TipContext";
import { AddCardDialog } from "./AddCardDialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { playAlarmSound } from "@/lib/alarmSounds";
import { cn } from "@/lib/utils";
import type { CardConfig } from "@/routes/index";

// GitHub, not an in-app route — the field reference is developer/BCBA
// documentation checked into the repo (docs/CARD-TYPES.md), not something
// this prototype has a content-management view for.
const CARD_TYPE_DOCS_URL = "https://github.com/pixeldrift/tabi/blob/main/docs/CARD-TYPES.md";

// One id per jump-bar chip, matching whatever <section id="..."> each
// heading below actually renders — group names come from SETTINGS' own
// data (currently just "Notifications"), so those get slugified rather
// than hardcoded, the same as their heading text already is.
const slugifyGroup = (group: string) => `settings-${group.toLowerCase().replace(/\s+/g, "-")}`;

function SettingsTimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TimeOfDayKeypad value={value} onChange={onChange}>
      {({ isEditing, open }) => (
        <button
          type="button"
          onClick={open}
          className={cn(
            "flex h-9 w-[110px] items-center justify-center rounded-full border-2 bg-white px-2 text-sm tabular-nums shadow-[inset_0_2px_5px_rgba(0,0,0,0.22)] transition-colors text-blue-700",
            isEditing ? "border-blue-400" : "border-blue-300",
          )}
        >
          {formatTimeOfDay(value)}
        </button>
      )}
    </TimeOfDayKeypad>
  );
}

export function SettingsPane({
  contentRef,
  cards,
  onAddCard,
}: {
  /** The app-shell's own internally-scrolling content pane — this pane
   *  renders inside it, not the window, so the jump bar's targets are
   *  measured and scrolled relative to it rather than the document. */
  contentRef: RefObject<HTMLElement | null>;
  /** Every card currently defined (built-in + previously custom-created) —
   *  passed through to AddCardDialog purely so a freshly created card's id
   *  can be de-duplicated against ids that already exist. */
  cards: CardConfig[];
  onAddCard: (card: CardConfig) => void;
}) {
  const {
    values,
    setValue,
    resetOne,
    alarmSound,
    setAlarmSound,
    keepActiveCardCentered,
    setKeepActiveCardCentered,
    dayStart,
    setDayStart,
    dayEnd,
    setDayEnd,
    defaultTab,
    setDefaultTab,
    defaultDataView,
    setDefaultDataView,
    colorTheme,
    setColorTheme,
    tourHintsEnabled,
    setTourHintsEnabled,
    tipsEnabled,
    setTipsEnabled,
  } = useSettings();
  const { start: startTour } = useTour();
  const { nextTip } = useTip();
  const groups = Array.from(new Set(SETTINGS.map((s) => s.group)));
  const jumpSections = [
    { id: "settings-admin", label: "BCBA Tools" },
    { id: "settings-appearance", label: "Appearance" },
    ...groups.map((g) => ({ id: slugifyGroup(g), label: g })),
    { id: "settings-schedule", label: "Schedule" },
    { id: "settings-data", label: "Data" },
    { id: "settings-help", label: "Help" },
  ];

  const [addCardOpen, setAddCardOpen] = useState(false);
  // A quick "Added ✓" confirmation rather than a toast primitive this app
  // doesn't otherwise have — clears itself a few seconds after the dialog
  // hands back the new card's title.
  const [justAddedTitle, setJustAddedTitle] = useState<string | null>(null);

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <div className="mt-6 px-4 mb-1">
        <h2 className="font-display text-lg leading-tight">Settings</h2>
        <a
          href={CARD_TYPE_DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-600 transition-colors"
        >
          <BookOpen className="size-3.5" />
          Card type field reference
          <span aria-hidden>↗</span>
        </a>
      </div>

      <SectionJumpBar sections={jumpSections} contentRef={contentRef} />

      <div className="mt-6 px-4 space-y-8">
        <section id="settings-admin">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            BCBA Tools
          </h3>
          <div className="flex items-start gap-3 rounded-xl border border-border bg-stone-50/60 p-3.5">
            <span className="shrink-0 grid place-items-center size-9 rounded-full bg-blue-100 text-blue-700">
              <UserCog className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Define a new goal or behavior</p>
              <p className="text-xs text-muted-foreground/80 mt-0.5">
                Adds a new data card to the treatment plan — typically handled by the supervising
                BCBA when programming a new target, not day-to-day by the RBT running a session. See
                the{" "}
                <a
                  href={CARD_TYPE_DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-blue-600"
                >
                  full field reference
                </a>{" "}
                for what each data type supports.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => setAddCardOpen(true)}
                className="btn-bevel mt-3 rounded-full bg-blue-500 hover:bg-blue-600 text-white"
              >
                + Add New Card
              </Button>
              {justAddedTitle && (
                <p className="text-xs text-green-700 mt-2">
                  &ldquo;{justAddedTitle}&rdquo; added to the Data tab.
                </p>
              )}
            </div>
          </div>
        </section>

        <section id="settings-appearance">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Appearance
          </h3>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <label className="text-sm font-medium">Color theme</label>
              <p className="text-xs text-muted-foreground/80 mt-0.5">
                {COLOR_THEME_OPTIONS.find((o) => o.value === colorTheme)?.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setColorTheme("default")}
              disabled={colorTheme === "default"}
              aria-label="Reset color theme to default"
              className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-0 disabled:pointer-events-none"
            >
              <RotateCcw className="size-3" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1 rounded-full border border-border bg-stone-100/60 p-1 w-fit">
            {COLOR_THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColorTheme(opt.value)}
                aria-pressed={colorTheme === opt.value}
                className={cn(
                  "h-8 rounded-full px-4 text-sm font-medium transition-colors",
                  colorTheme === opt.value
                    ? "btn-bevel bg-blue-500 text-white"
                    : "text-stone-500 hover:text-stone-800",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {groups.map((group) => (
          <section key={group} id={slugifyGroup(group)}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {group}
            </h3>
            <div className="space-y-5">
              {SETTINGS.filter((s) => s.group === group).map((setting) => {
                const value = values[setting.key] ?? setting.default;
                const isDefault = value === setting.default;
                return (
                  <div key={setting.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <label htmlFor={setting.key} className="text-sm font-medium">
                        {setting.label}
                      </label>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {value}
                          {setting.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => resetOne(setting.key)}
                          disabled={isDefault}
                          aria-label={`Reset ${setting.label} to default`}
                          className={cn(
                            "text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-0 disabled:pointer-events-none",
                          )}
                        >
                          <RotateCcw className="size-3" />
                        </button>
                      </div>
                    </div>
                    {setting.description && (
                      <p className="text-xs text-muted-foreground/80 mt-0.5">
                        {setting.description}
                      </p>
                    )}
                    <Slider
                      id={setting.key}
                      className="mt-2"
                      min={setting.min}
                      max={setting.max}
                      step={setting.step}
                      value={[value]}
                      onValueChange={([v]) => setValue(setting.key, v)}
                    />
                  </div>
                );
              })}
              {/* Alarm sound is the one enum-valued setting, so it's rendered
                  directly here rather than folding a "choice" variant into
                  SettingDef for a single use case. */}
              {group === "Notifications" && (
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <label htmlFor="alarmSound" className="text-sm font-medium">
                      Default Alarm Sound
                    </label>
                    <button
                      type="button"
                      onClick={() => playAlarmSound(alarmSound)}
                      aria-label={`Play ${alarmSound} alarm sound`}
                      title="Play sound"
                      className="text-muted-foreground/60 hover:text-foreground transition-colors"
                    >
                      <Volume2 className="size-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground/80 mt-0.5">
                    Plays on a loop while an alert is live. Can be overridden per notification.
                  </p>
                  <Select
                    value={alarmSound}
                    onValueChange={(v) => {
                      const style = v as AlarmSoundStyle;
                      setAlarmSound(style);
                      // Auto-preview on selection — the whole point of
                      // choosing between "chime"/"alert"/"alarm" is how
                      // they actually sound, not their labels, so playing
                      // it immediately saves a separate confirm-then-play
                      // step.
                      playAlarmSound(style);
                    }}
                  >
                    <SelectTrigger id="alarmSound" className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALARM_SOUND_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </section>
        ))}

        <section id="settings-schedule">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Schedule
          </h3>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor="dayStart" className="text-sm font-medium">
                Clinic hours
              </label>
              <p className="text-xs text-muted-foreground/80 mt-0.5">
                The Schedule tab's grid — and its "Add Activity" gaps — are bounded to this range.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDayStart(DEFAULT_DAY_START);
                setDayEnd(DEFAULT_DAY_END);
              }}
              disabled={dayStart === DEFAULT_DAY_START && dayEnd === DEFAULT_DAY_END}
              aria-label="Reset clinic hours to default"
              className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-0 disabled:pointer-events-none"
            >
              <RotateCcw className="size-3" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Day Start</span>
              <SettingsTimeField value={dayStart} onChange={setDayStart} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Day End</span>
              <SettingsTimeField value={dayEnd} onChange={setDayEnd} />
            </div>
          </div>
        </section>

        <section id="settings-data">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Data
          </h3>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor="keepActiveCardCentered" className="text-sm font-medium">
                Keep active card centered
              </label>
              <p className="text-xs text-muted-foreground/80 mt-0.5">
                Smoothly scroll the Data tab so whichever card you select stays centered in view —
                the same kind of auto-scroll as the Schedule tab's "Now" button.
              </p>
            </div>
            <Switch
              id="keepActiveCardCentered"
              checked={keepActiveCardCentered}
              onCheckedChange={setKeepActiveCardCentered}
              className="shrink-0"
            />
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <label className="text-sm font-medium">Default tab</label>
                <p className="text-xs text-muted-foreground/80 mt-0.5">
                  The tab the app opens on — same options as the header's tab bar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDefaultTab("data")}
                disabled={defaultTab === "data"}
                aria-label="Reset Default tab to default"
                className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-0 disabled:pointer-events-none"
              >
                <RotateCcw className="size-3" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1 rounded-full border border-border bg-stone-100/60 p-1 w-fit">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDefaultTab(id)}
                  aria-pressed={defaultTab === id}
                  aria-label={label}
                  title={label}
                  className={cn(
                    "grid place-items-center size-8 rounded-full transition-colors",
                    defaultTab === id
                      ? "btn-bevel bg-blue-500 text-white"
                      : "text-stone-500 hover:text-stone-800",
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <label className="text-sm font-medium">Default data view</label>
                <p className="text-xs text-muted-foreground/80 mt-0.5">
                  The view the Data tab opens in — same options as the toolbar's view toggle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDefaultDataView("card")}
                disabled={defaultDataView === "card"}
                aria-label="Reset Default data view to default"
                className="shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-0 disabled:pointer-events-none"
              >
                <RotateCcw className="size-3" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1 rounded-full border border-border bg-stone-100/60 p-1 w-fit">
              {DISPLAY_MODES.map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDefaultDataView(mode)}
                  aria-pressed={defaultDataView === mode}
                  aria-label={`${label} view`}
                  title={`${label} view`}
                  className={cn(
                    "grid place-items-center size-8 rounded-full transition-colors",
                    defaultDataView === mode
                      ? "btn-bevel bg-blue-500 text-white"
                      : "text-stone-500 hover:text-stone-800",
                  )}
                >
                  {icon({ className: "size-4" })}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="settings-help">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Help
          </h3>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor="tourHintsEnabled" className="text-sm font-medium">
                Show welcome tour
              </label>
              <p className="text-xs text-muted-foreground/80 mt-0.5">
                Automatically walk through the app's main features the next time it opens fresh.
              </p>
            </div>
            <Switch
              id="tourHintsEnabled"
              checked={tourHintsEnabled}
              onCheckedChange={setTourHintsEnabled}
              className="shrink-0"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={startTour}
            className="mt-3 -ml-2 text-muted-foreground"
          >
            <RotateCcw className="size-3.5" />
            Replay welcome tour
          </Button>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor="tipsEnabled" className="text-sm font-medium">
                Show "Did you know?" tips
              </label>
              <p className="text-xs text-muted-foreground/80 mt-0.5">
                Surface a rotating tip about a less-obvious feature each time the app opens.
              </p>
            </div>
            <Switch
              id="tipsEnabled"
              checked={tipsEnabled}
              onCheckedChange={setTipsEnabled}
              className="shrink-0"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={nextTip}
            className="mt-3 -ml-2 text-muted-foreground"
          >
            <Lightbulb className="size-3.5" />
            Show a tip now
          </Button>
        </section>

        <IconsShowcase />
        <ColorPaletteShowcase />
      </div>

      <AddCardDialog
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        existingIds={new Set(cards.map((c) => c.id))}
        onCreate={(card) => {
          onAddCard(card);
          setJustAddedTitle(card.title);
          window.setTimeout(() => setJustAddedTitle(null), 4000);
        }}
      />
    </div>
  );
}
