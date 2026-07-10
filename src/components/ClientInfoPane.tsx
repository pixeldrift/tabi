import { useEffect, useRef, useState } from "react";
import { Eye, CheckCircle2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PersonPill } from "@/components/StaffDirectory";
import { PhoneIcon } from "./icons/PhoneIcon";
import { RequestEditIcon } from "./icons/RequestEditIcon";
import { useSession } from "@/components/SessionContext";
import { useNotifications } from "@/components/NotificationContext";
import { useStickyTop } from "@/hooks/use-sticky-top";
import { cn } from "@/lib/utils";

// How long a revealed client photo stays unblurred before hiding itself
// again — long enough to actually register a face, short enough that the
// screen doesn't sit showing it indefinitely.
const REVEAL_MS = 5000;

interface GuardianRecord {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  avatar: string;
  pickupAuthorized: boolean;
}

interface VehicleRecord {
  id: string;
  guardianId: string;
  color: string;
  make: string;
  model: string;
  plate: string;
  photo: string;
}

// Same show's universe as the BCBA/RBT names already used elsewhere
// (StaffDirectory, the header) — Phineas's actual family.
const CLIENT = {
  firstName: "Phineas",
  lastName: "Flynn",
  dob: "2016-06-16",
  avatar: "👦",
};

const GUARDIANS: GuardianRecord[] = [
  { id: "linda", name: "Linda Flynn-Fletcher", relationship: "Mother", phone: "+16155550111", avatar: "👩", pickupAuthorized: true },
  { id: "lawrence", name: "Lawrence Fletcher", relationship: "Stepfather", phone: "+16155550122", avatar: "👨", pickupAuthorized: true },
];

const VEHICLES: VehicleRecord[] = [
  { id: "v1", guardianId: "linda", color: "Silver", make: "Honda", model: "Odyssey", plate: "BJY-4471", photo: "🚐" },
  { id: "v2", guardianId: "lawrence", color: "Green", make: "Toyota", model: "Camry", plate: "HRT-2093", photo: "🚗" },
];

const TEAM_MEMBERS = ["Perry Plat", "Isabella Garcia-Shapiro", "Baljeet Tjinder"];

// Quick-orientation notes for anyone covering a session cold — same purpose
// as CentralReach's own "About Me (coverage notes)" panel. Anything already
// covered by its own dedicated section elsewhere on this page (DOB/age,
// caregivers/vehicles, lead BCBA) is left out rather than repeated here.
const ABOUT_ME = {
  seizureActionPlan: "No",
  allergies: "No known allergies.",
  favoriteActivities:
    "Building/inventing play, sketching blueprints, backyard rollercoaster models, bubbles, kazoo, being spun in the desk chair, tickles.",
  interferingBehaviors: "Tantrums, elopement, property destruction, climbing.",
  environment:
    "Keep the workbench and tool bin within reach. Sit facing the yard gate to prevent elopement mid-build.",
  mealTime:
    "On-site 9:00a–3:00p daily. Split snack/lunch into two portions — first half late morning, second half early afternoon.",
  successTips:
    '"What should we build today?" is a reliable opener. Snack is in the labeled bin in the kitchen; extra juice boxes in the fridge door (limit to one after any juice from the car).',
  toileting: "Fully independent; occasional reminders to wash hands after the workshop sink.",
  communicationExpressive:
    "Full vocal sentences; talks through the plan before starting a build. Gestures/points when overstimulated.",
  communicationReceptive:
    "Follows multi-step verbal instructions independently. Benefits from a visual schedule ahead of any transition away from a build.",
  transitions:
    'Show the "next activity" picture card 2 minutes before transitioning away from a build. If he protests, let him finish the current step first.',
  relatedServices: [
    { discipline: "Speech", provider: "Vanessa Doofenshmirtz", schedule: "Tuesdays 12:00p" },
    { discipline: "OT", provider: "Jeremy Johnson", schedule: "Wed 3:30–4:00p, Fri 1:30–2:00p" },
  ],
};

const JUMP_SECTIONS = [
  { id: "section-about-me", label: "About Me" },
  { id: "section-guardians", label: "Guardians" },
  { id: "section-vehicles", label: "Vehicles" },
  { id: "section-team", label: "Care Team" },
];

function calculateAge(dobIso: string): number {
  const dob = new Date(dobIso);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function formatUpdated(d: Date | null) {
  if (!d) return "—";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return sameDay ? `today (${date}) at ${time}` : `${date} at ${time}`;
}

export function ClientInfoPane() {
  const { lastUpdated } = useSession();
  // The fixed header (previous-session banner + tabs) varies in height by
  // session state — a fixed scroll-margin guess undershoots it whenever the
  // banner's expanded, leaving a jumped-to section's heading tucked out of
  // sight underneath. Same live measurement DataDetailsDrawer already uses.
  const stickyTop = useStickyTop();
  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - stickyTop - 8;
    window.scrollTo({ top, behavior: "smooth" });
  };
  return (
    <div className="max-w-2xl mx-auto mt-6 px-4 pb-8 space-y-6">
      <ClientHeader />
      <div className="flex flex-wrap gap-1.5 text-xs">
        {JUMP_SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => jumpTo(s.id)}
            className="px-2 py-1 rounded-full border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-800 transition-colors"
          >
            {s.label}
          </button>
        ))}
      </div>

      <Section id="section-about-me" title="About Me (Coverage Notes)">
        <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white overflow-hidden text-sm">
          <NoteRow label="Seizure Action Plan?" value={ABOUT_ME.seizureActionPlan} />
          <NoteRow label="Allergies" value={ABOUT_ME.allergies} />
          <NoteRow label="Favorite Toys/Activities" value={ABOUT_ME.favoriteActivities} />
          <NoteRow label="Interfering Behaviors" value={ABOUT_ME.interferingBehaviors} />
          <NoteRow label="Environment" value={ABOUT_ME.environment} />
          <NoteRow label="Meal Time/Snack" value={ABOUT_ME.mealTime} />
          <NoteRow label="Session Success Tips/Pairing" value={ABOUT_ME.successTips} />
          <NoteRow label="Toileting" value={ABOUT_ME.toileting} />
          <NoteRow
            label="Mode of Communication"
            value={`Expressive: ${ABOUT_ME.communicationExpressive}\n\nReceptive: ${ABOUT_ME.communicationReceptive}`}
          >
            <p>
              <span className="font-semibold">Expressive: </span>
              {ABOUT_ME.communicationExpressive}
            </p>
            <p className="mt-1.5">
              <span className="font-semibold">Receptive: </span>
              {ABOUT_ME.communicationReceptive}
            </p>
          </NoteRow>
          <NoteRow label="Transitions" value={ABOUT_ME.transitions} />
          <NoteRow
            label="Related Service Times"
            value={ABOUT_ME.relatedServices.map((s) => `${s.discipline}: ${s.provider} · ${s.schedule}`).join("\n")}
          >
            <div className="space-y-1">
              {ABOUT_ME.relatedServices.map((s) => (
                <div key={s.discipline} className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-semibold">{s.discipline}:</span>
                  <span>
                    {s.provider} &middot; {s.schedule}
                  </span>
                </div>
              ))}
            </div>
          </NoteRow>
          <NoteRow label="Session Structure/Schedule" value="See the Schedule tab." />
        </div>
      </Section>

      <Section id="section-guardians" title="Guardians">
        <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white overflow-hidden">
          {GUARDIANS.map((g) => (
            <div key={g.id} className="flex items-center gap-3 p-3">
              <PhotoZoomButton avatar={g.avatar} label={g.name} size="size-10" textSize="text-xl" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{g.name}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{g.relationship}</span>
                  {g.pickupAuthorized && (
                    <span
                      title="Authorized for pickup"
                      className="inline-flex items-center gap-0.5 text-green-700"
                    >
                      <CheckCircle2 className="size-3" />
                      Pickup OK
                    </span>
                  )}
                </div>
              </div>
              <a
                href={`tel:${g.phone}`}
                aria-label={`Call ${g.name}`}
                className="shrink-0 grid place-items-center size-8 rounded-full text-stone-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <PhoneIcon className="size-4" />
              </a>
            </div>
          ))}
        </div>
      </Section>

      <Section id="section-vehicles" title="Authorized Pickup Vehicles">
        <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white overflow-hidden">
          {VEHICLES.map((v) => {
            const guardian = GUARDIANS.find((g) => g.id === v.guardianId);
            return (
              <div key={v.id} className="flex items-center gap-3 p-3">
                <PhotoZoomButton
                  avatar={v.photo}
                  label={`${v.color} ${v.make} ${v.model}`}
                  size="size-10"
                  textSize="text-xl"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {v.color} {v.make} {v.model}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{guardian?.name ?? "Unknown"}</p>
                </div>
                <span className="shrink-0 font-mono text-xs font-semibold text-stone-600 bg-stone-100 px-2 py-1 rounded-md tracking-wide">
                  {v.plate}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="section-team" title="Care Team">
        <div className="rounded-xl border border-stone-200 bg-white p-3 space-y-2 text-sm">
          <InfoRow label="Lead BCBA:">
            <PersonPill name="Heinz Doofenshmirtz" />
          </InfoRow>
          <InfoRow label="Team:">
            {TEAM_MEMBERS.map((name) => (
              <PersonPill key={name} name={name} />
            ))}
          </InfoRow>
        </div>
      </Section>

      {/* Metadata about the record, not something a BCBA needs up front —
          stays last. */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-muted-foreground">
        <span>Last updated {formatUpdated(lastUpdated)} by</span>
        <PersonPill name="Perry Plat" />
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">{title}</h2>
      {children}
    </section>
  );
}

// Label-over-value row for About Me — unlike InfoRow's inline label
// (fine for a short pill list), these values run to full paragraphs, so
// label and value need their own stacked lines rather than fighting for
// space side by side. `value` is the plain-text version a covering tech's
// edit request preloads into its textarea; `children`, when given, is a
// richer rendering of the same fact (e.g. Mode of Communication's two
// paragraphs) — otherwise `value` itself is rendered directly.
function NoteRow({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  const [requestOpen, setRequestOpen] = useState(false);
  return (
    <div className="relative p-3 pr-9">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <div className="mt-1 leading-snug text-foreground/90">{children ?? value}</div>
      {/* Bare icon, no button chrome — a passive "you can suggest a change
          here" hint, not a primary action, so it stays out of the way of
          the actual content above it. */}
      <button
        type="button"
        onClick={() => setRequestOpen(true)}
        aria-label={`Request an edit to ${label}`}
        className="absolute bottom-1.5 right-1.5 grid place-items-center size-6 text-blue-400/70 hover:text-blue-600 transition-colors"
      >
        <RequestEditIcon className="size-4" />
      </button>
      <RequestEditDialog open={requestOpen} onOpenChange={setRequestOpen} label={label} currentValue={value} />
    </div>
  );
}

// Submits a request rather than editing directly — this client record has
// no real access-control yet (see README: Editing Allowed / Not Allowed /
// Approval Required is future scope), so for now every request just goes
// to the same place a supervisor would actually see it: a live
// notification, the same way an approval request would surface once that
// workflow exists. There's no approve/deny action on it yet either.
function RequestEditDialog({
  open,
  onOpenChange,
  label,
  currentValue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  currentValue: string;
}) {
  const { push } = useNotifications();
  const [text, setText] = useState(currentValue);

  // Re-seed from the live value each time the dialog opens, rather than
  // carrying over whatever was left in the box from a prior cancelled
  // request (or a since-changed field) the last time it was open.
  useEffect(() => {
    if (open) setText(currentValue);
  }, [open, currentValue]);

  const handleSave = () => {
    push({
      kind: "message",
      icon: "message",
      title: `Edit requested: ${label}`,
      body: text.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-xl">
        <DialogHeader className="text-left">
          <DialogTitle>Request Edit</DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          className="w-full rounded-xl border-2 border-blue-300 bg-white px-3 py-2 text-sm leading-snug shadow-[inset_0_2px_5px_rgba(0,0,0,0.22)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            variant="outline"
            className="rounded-full border-2 border-blue-300 text-blue-700 hover:bg-blue-50 gap-1.5"
            onClick={() => onOpenChange(false)}
          >
            Cancel <X className="size-4" />
          </Button>
          <Button
            className="rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none"
            disabled={!text.trim()}
            onClick={handleSave}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      <span className="font-semibold text-foreground/80 shrink-0">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function ClientHeader() {
  const age = calculateAge(CLIENT.dob);
  const birthday = new Date(CLIENT.dob).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="flex items-center gap-4">
      <ClientAvatar />
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold leading-none truncate">{CLIENT.firstName}</h1>
        <p className="mt-1 text-lg text-muted-foreground leading-tight truncate">{CLIENT.lastName}</p>
        <p className="mt-1.5 text-sm text-foreground/70">
          Age {age} &middot; Born {birthday}
        </p>
      </div>
    </div>
  );
}

// Starts blurred with a small "tap to reveal" hint; a tap unblurs it for
// REVEAL_MS before it hides itself again. A SECOND tap while it's revealed
// doesn't just re-blur early — it opens the same full-size zoom every other
// photo in this pane uses (see PhotoZoomButton), since at that point the
// user has already chosen to look at it and is asking to look closer.
function ClientAvatar() {
  const [revealed, setRevealed] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const reblurTimerRef = useRef<number | null>(null);

  const scheduleReblur = () => {
    if (reblurTimerRef.current !== null) window.clearTimeout(reblurTimerRef.current);
    reblurTimerRef.current = window.setTimeout(() => setRevealed(false), REVEAL_MS);
  };

  useEffect(() => {
    return () => {
      if (reblurTimerRef.current !== null) window.clearTimeout(reblurTimerRef.current);
    };
  }, []);

  const handleClick = () => {
    if (!revealed) {
      setRevealed(true);
      scheduleReblur();
    } else {
      setZoomOpen(true);
      if (reblurTimerRef.current !== null) window.clearTimeout(reblurTimerRef.current);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={revealed ? `${CLIENT.firstName}'s photo — tap to enlarge` : `Tap to reveal ${CLIENT.firstName}'s photo`}
        className="relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-blue-300 bg-blue-100 grid place-items-center text-4xl"
      >
        <span className={cn("transition-[filter] duration-300", !revealed && "blur-md")}>{CLIENT.avatar}</span>
        {!revealed && (
          // Centered (not corner-pinned) and bare — a corner badge got
          // clipped by the circle's own rounded edge (a square positioned
          // near a circle's bounding-box corner sits mostly outside the
          // circle itself), and the white pill/shadow behind it read as a
          // button when it's only ever a passive hint.
          <Eye className="absolute inset-0 m-auto size-6 text-white opacity-50" aria-hidden />
        )}
      </button>
      <PhotoZoomDialog
        open={zoomOpen}
        onOpenChange={(open) => {
          setZoomOpen(open);
          if (!open) scheduleReblur();
        }}
        avatar={CLIENT.avatar}
        label={`${CLIENT.firstName} ${CLIENT.lastName}`}
      />
    </>
  );
}

// Plain (non-blurred) tap-to-zoom trigger — used by guardian rows, and
// internally by ClientAvatar's own second-tap zoom.
function PhotoZoomButton({
  avatar,
  label,
  size,
  textSize,
}: {
  avatar: string;
  label: string;
  size: string;
  textSize: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge photo of ${label}`}
        className={cn("shrink-0 rounded-full border border-stone-200 bg-blue-50 grid place-items-center", size, textSize)}
      >
        {avatar}
      </button>
      <PhotoZoomDialog open={open} onOpenChange={setOpen} avatar={avatar} label={label} />
    </>
  );
}

// Full-size lightbox shared by every photo in the pane — tapping the photo
// itself closes it, same as the dialog's own X (DialogContent already
// renders one in the corner) or tapping outside.
function PhotoZoomDialog({
  open,
  onOpenChange,
  avatar,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatar: string;
  label: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-auto max-w-[min(85vw,320px)] rounded-3xl border-none bg-transparent p-0 shadow-none grid place-items-center [&>button]:bg-white/90 [&>button]:rounded-full [&>button]:p-1.5 [&>button]:right-3 [&>button]:top-3">
        <DialogTitle className="sr-only">{label}'s photo</DialogTitle>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Shrink photo"
          className="grid aspect-square w-[min(85vw,320px)] place-items-center rounded-full border-4 border-white bg-blue-100 text-[100px] leading-none shadow-2xl"
        >
          {avatar}
        </button>
      </DialogContent>
    </Dialog>
  );
}
