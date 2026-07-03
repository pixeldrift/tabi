import { RotateCcw } from "lucide-react";
import { ALARM_SOUND_OPTIONS, SETTINGS, useSettings, type AlarmSoundStyle } from "./SettingsContext";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function SettingsPane() {
  const { values, setValue, resetAll, resetOne, alarmSound, setAlarmSound } = useSettings();
  const groups = Array.from(new Set(SETTINGS.map((s) => s.group)));

  return (
    <div className="max-w-2xl mx-auto mt-6 px-4 pb-16">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="font-display text-lg leading-tight">Settings</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Notification behavior.</p>
        </div>
        {groups.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetAll}
            className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            Reset all
          </Button>
        )}
      </div>

      <div className="mt-6 space-y-8">
        {groups.map((group) => (
          <section key={group}>
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
                      <p className="text-xs text-muted-foreground/80 mt-0.5">{setting.description}</p>
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
                      Alarm sound
                    </label>
                    <button
                      type="button"
                      onClick={() => setAlarmSound("normal")}
                      disabled={alarmSound === "normal"}
                      aria-label="Reset Alarm sound to default"
                      className="text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-0 disabled:pointer-events-none"
                    >
                      <RotateCcw className="size-3" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground/80 mt-0.5">
                    How urgent an alert's chime sounds while it's live.
                  </p>
                  <Select value={alarmSound} onValueChange={(v) => setAlarmSound(v as AlarmSoundStyle)}>
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
      </div>
    </div>
  );
}
