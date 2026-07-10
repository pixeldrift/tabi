import { useEffect, useRef, useState } from "react";
import { Eye, Car, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PersonPill } from "@/components/StaffDirectory";
import { PhoneIcon } from "./icons/PhoneIcon";
import { useSession } from "@/components/SessionContext";
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
  { id: "v1", guardianId: "linda", color: "Silver", make: "Honda", model: "Odyssey", plate: "BJY-4471" },
  { id: "v2", guardianId: "lawrence", color: "Green", make: "Toyota", model: "Camry", plate: "HRT-2093" },
];

const TEAM_MEMBERS = ["Perry Plat", "Isabella Garcia-Shapiro", "Baljeet Tjinder"];

const JUMP_SECTIONS = [
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
  if (sameDay) return `today at ${time}`;
  return `${d.toLocaleDateString()} ${time}`;
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
                <span className="shrink-0 grid place-items-center size-10 rounded-full bg-stone-100 text-stone-500">
                  <Car className="size-4" />
                </span>
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
          <span className="absolute bottom-0.5 right-0.5 grid place-items-center size-5 rounded-full bg-white/80 text-stone-500 shadow">
            <Eye className="size-3" />
          </span>
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
