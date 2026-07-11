import type { AlarmSoundStyle } from "@/components/SettingsContext";
import chime01 from "@/assets/audio/chime01.wav";
import alert01 from "@/assets/audio/alert01.wav";
import alarm01 from "@/assets/audio/alarm01.wav";

const ALARM_SOUND_FILES: Record<AlarmSoundStyle, string> = {
  chime: chime01,
  alert: alert01,
  alarm: alarm01,
};

/** Plays the given alarm style's audio file — used both by the Settings
 *  pane (so picking a style is an audible choice, not a guess from its
 *  label alone) and by live in-app alerts. A fresh Audio() per call rather
 *  than one reused element, so overlapping triggers (e.g. picking two
 *  styles quickly) don't cut each other off. */
export function playAlarmSound(style: AlarmSoundStyle) {
  const audio = new Audio(ALARM_SOUND_FILES[style]);
  audio.play().catch(() => {});
}
