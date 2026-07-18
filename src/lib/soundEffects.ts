export type SoundEffectKey =
  | "startup"
  | "sessionStart"
  | "sessionResume"
  | "sessionPause"
  | "sessionDiscard"
  | "submit"
  | "tallyUp"
  | "tallyDown"
  | "correct"
  | "error"
  | "noResponse"
  | "prompted"
  | "click"
  | "drawerSlide"
  | "twirldown"
  | "question"
  | "popup"
  | "warning"
  | "success";

// The filename (without extension) each key resolves to under
// src/assets/audio/ — same folder as the existing alarm sounds
// (chime01.wav etc. — see alarmSounds.ts), kebab-case. Drop a .wav or .mp3
// with one of these names in there and playSoundEffect() below picks it up
// automatically, no code changes needed — see the README's own "Sound
// effects" section for the full reference table.
const SOUND_EFFECT_FILENAMES: Record<SoundEffectKey, string> = {
  startup: "startup",
  sessionStart: "session-start",
  sessionResume: "session-resume",
  sessionPause: "session-pause",
  sessionDiscard: "session-discard",
  submit: "submit",
  tallyUp: "tally-up",
  tallyDown: "tally-down",
  correct: "correct",
  error: "error",
  noResponse: "no-response",
  prompted: "prompted",
  click: "click",
  drawerSlide: "drawer-slide",
  twirldown: "twirldown",
  question: "question",
  popup: "popup",
  warning: "warning",
  success: "success",
};

// Eagerly globs whatever audio files actually exist in src/assets/audio/ at
// build time, resolved to their served URL — e.g. "tally-up.wav" and
// "tally-up.mp3" both resolve to the "tally-up" key, so either format
// works. A key with no matching file simply isn't in this map; nothing
// errors at build or call time either way, which is what lets every
// trigger below be wired up before a single sound file exists. Also
// matches alarmSounds.ts's own chime01.wav etc. — those just aren't
// looked up by any key here, so they're harmless extra entries.
const effectUrls = import.meta.glob<string>("/src/assets/audio/*.{wav,mp3}", {
  eager: true,
  query: "?url",
  import: "default",
});
const urlByFilename = new Map<string, string>();
for (const [path, url] of Object.entries(effectUrls)) {
  const filename = path
    .split("/")
    .pop()!
    .replace(/\.(wav|mp3)$/, "");
  urlByFilename.set(filename, url);
}

const audioElements = new Map<SoundEffectKey, HTMLAudioElement>();
function getAudioElement(key: SoundEffectKey): HTMLAudioElement | null {
  const existing = audioElements.get(key);
  if (existing) return existing;
  const url = urlByFilename.get(SOUND_EFFECT_FILENAMES[key]);
  if (!url) return null;
  const el = new Audio(url);
  audioElements.set(key, el);
  return el;
}

/** Plays the named UI sound effect — a silent no-op until a matching file
 *  is dropped into src/assets/audio/ (see SOUND_EFFECT_FILENAMES and the
 *  README's "Sound effects" section). Every call site below is triggered
 *  directly by the user gesture that should play it (a tap, a toggle, a dialog
 *  opening), so — unlike alarmSounds.ts's timer-driven alerts — none of
 *  these need the priming/unlock dance; they're always already inside a
 *  gesture's own call stack. The one exception is "startup", which plays
 *  on mount before any gesture exists; browsers are free to silently block
 *  it, which just means no sound rather than an error. */
export function playSoundEffect(key: SoundEffectKey) {
  const audio = getAudioElement(key);
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
