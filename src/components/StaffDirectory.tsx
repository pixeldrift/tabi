import { useState } from "react";
import { User, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PhoneIcon } from "./icons/PhoneIcon";
import { EmailIcon } from "./icons/EmailIcon";
import { ChatIcon } from "./icons/ChatIcon";
import { PhotoZoomButton } from "@/components/PhotoZoom";
import { cn } from "@/lib/utils";
import { CURRENT_STAFF_ID } from "./SessionContext";
import doofenshmirtzPhoto from "@/assets/images/people/doofenshmirtz.jpeg";
import perryPhoto from "@/assets/images/people/perry.jpeg";
import isabellaPhoto from "@/assets/images/people/isabella.jpeg";
import baljeetPhoto from "@/assets/images/people/baljeet.jpeg";
import vanessaPhoto from "@/assets/images/people/vanessa.jpeg";
import jeremyPhoto from "@/assets/images/people/jeremy.jpeg";

interface StaffRecord {
  /** Stable lookup key — a real backend's primary key, e.g. an employee id.
   *  Everything that refers to a staff member (session attribution,
   *  presence, "current user") should pass this around instead of `name`:
   *  names collide and change, ids don't — see `PersonPill`'s own comment. */
  id: string;
  name: string;
  title: string;
  role: string;
  npi: string;
  location: string;
  bio: string;
  /** Stands in for a photo — no real headshots in a demo dataset. */
  avatar: string;
  phone: string;
  email: string;
  assignedClients: string[];
}

// Every name already used elsewhere in the header (Phineas Flynn, Perry
// Plat) comes from the same show — kept to one consistent universe rather
// than mixing in generic placeholder names.
export const STAFF_DIRECTORY: Record<string, StaffRecord> = {
  "heinz-doofenshmirtz": {
    id: "heinz-doofenshmirtz",
    name: "Heinz Doofenshmirtz",
    title: "Board Certified Behavior Analyst (BCBA)",
    role: "Lead BCBA",
    npi: "1720394856",
    location: "Nashville Clinic",
    bio: "Designs and oversees the treatment plan, with a flair for elaborate, multi-step interventions that — much to his own surprise — usually work on the first try.",
    avatar: doofenshmirtzPhoto,
    phone: "+16155550142",
    email: "h.doofenshmirtz@abadaba.clinic",
    assignedClients: ["Phineas Flynn"],
  },
  "perry-plat": {
    id: "perry-plat",
    name: "Perry Plat",
    title: "Registered Behavior Technician (RBT)",
    role: "RBT",
    npi: "2938471650",
    location: "Nashville Clinic",
    bio: "Quiet, focused, and unflappable in session — the kind of technician who somehow always turns up exactly where the treatment plan needs him.",
    avatar: perryPhoto,
    phone: "+16155550198",
    email: "p.plat@abadaba.clinic",
    assignedClients: ["Phineas Flynn", "Buford Van Stomm"],
  },
  "isabella-garcia-shapiro": {
    id: "isabella-garcia-shapiro",
    name: "Isabella Garcia-Shapiro",
    title: "Registered Behavior Technician (RBT)",
    role: "RBT",
    npi: "3847561029",
    location: "Nashville Clinic",
    bio: "Runs a tight, well-organized session and never misses a data point — the kind of technician other techs go to for advice.",
    avatar: isabellaPhoto,
    phone: "+16155550176",
    email: "i.garciashapiro@abadaba.clinic",
    assignedClients: ["Phineas Flynn", "Stacy Hirano"],
  },
  "baljeet-tjinder": {
    id: "baljeet-tjinder",
    name: "Baljeet Tjinder",
    title: "Board Certified Assistant Behavior Analyst (BCaBA)",
    role: "BCaBA",
    npi: "4756102938",
    location: "Nashville Clinic",
    bio: "Meticulous with programming and progress monitoring — happiest when a graph trends exactly the way the plan predicted it would.",
    avatar: baljeetPhoto,
    phone: "+16155550163",
    email: "b.tjinder@abadaba.clinic",
    assignedClients: ["Phineas Flynn"],
  },
  // Related-service providers (see ClientInfoPane's ABOUT_ME.relatedServices)
  // — external, not clinic staff, but reuse this same directory/PersonPill
  // machinery since a bio popup is all either one needs.
  "vanessa-doofenshmirtz": {
    id: "vanessa-doofenshmirtz",
    name: "Vanessa Doofenshmirtz",
    title: "Speech-Language Pathologist (SLP)",
    role: "SLP",
    npi: "5647382910",
    location: "Nashville Speech Partners",
    bio: "Dry, no-nonsense, and allergic to sugar-coating feedback — articulation homework somehow always gets done.",
    avatar: vanessaPhoto,
    phone: "+16155550184",
    email: "vanessa@nashvillespeechpartners.com",
    assignedClients: ["Phineas Flynn"],
  },
  "jeremy-johnson": {
    id: "jeremy-johnson",
    name: "Jeremy Johnson",
    title: "Occupational Therapist (OTR/L)",
    role: "OT",
    npi: "6758493021",
    location: "Midtown Pediatric OT",
    bio: "Easygoing and quick to build rapport — turns fine-motor drills into something closer to a jam session.",
    avatar: jeremyPhoto,
    phone: "+16155550157",
    email: "jeremy@midtownpediatricot.com",
    assignedClients: ["Phineas Flynn"],
  },
};

/** The current user's display name, derived from the directory rather than
 *  hardcoded a second time — SessionContext only owns the id (the actual
 *  "who's logged in" primitive; see its own comment), everything that needs
 *  the name for display or free-text matching (NotificationBar's known-name
 *  highlighting, `displayName` below) reads it from here. */
export const CURRENT_STAFF_NAME = STAFF_DIRECTORY[CURRENT_STAFF_ID].name;

/** Best-effort reverse lookup for the one place a staff member's name
 *  arrives as free text instead of an id — an appointment's `provider`
 *  field (ClientInfoPane), which is a plain user-typed string and may not
 *  match anyone in the directory at all (a real external provider). Returns
 *  null rather than guessing, so the caller can fall back to a plain label. */
export function findStaffIdByName(name: string): string | null {
  return Object.values(STAFF_DIRECTORY).find((s) => s.name === name)?.id ?? null;
}

/** A staff member's plain display name by id, with no "(You)" suffix — for
 *  contexts that need real text (native `title`/`aria-label` attributes,
 *  notification copy) rather than a rendered pill. Falls back to the raw id
 *  for an unresolvable one rather than throwing, same defensive spirit as
 *  `PersonPill`'s own missing-record fallback. */
export function staffName(id: string): string {
  return STAFF_DIRECTORY[id]?.name ?? id;
}

// "(You)" after the real name, everywhere a name renders — not a bare
// "You" swapped in for it. A pill is often part of a record (who saved,
// who paused, who started) that reads fine in the moment but is meaningless
// out of context to anyone reviewing it later, or to a different staff
// member looking at the same shared session — the real name has to stay
// legible either way, with "(You)" just as a personalized cue on top of it.
// Name-based (not id-based) since NotificationBar's own use of this scans
// free-text notification titles for known name substrings, where an id was
// never in the picture to begin with.
export function displayName(name: string): string {
  return name === CURRENT_STAFF_NAME ? `${name} (You)` : name;
}

/** A staff member's name, styled as a pill and looked up by id — same look
 *  everywhere it appears (Info tab's plan/BCBA/team rows, session
 *  attribution). Opens their profile card directly on tap — its own
 *  Phone/Email/Chat buttons sit right at the top, so there's no separate
 *  menu step first. An id with no matching record (shouldn't happen for a
 *  real staff member, but see `findStaffIdByName` for the one place an id
 *  isn't guaranteed) falls back to a plain, non-interactive label rather
 *  than crashing. `size="sm"` matches the compact inline pills used in
 *  denser rows (StatusBar's "Previous Session ... by" line) — same
 *  interaction, just smaller text/icon/padding. */
export function PersonPill({ staffId, size = "md" }: { staffId: string; size?: "sm" | "md" }) {
  const staff = STAFF_DIRECTORY[staffId];
  const [profileOpen, setProfileOpen] = useState(false);
  const sizeClasses = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-sm";
  const iconSize = size === "sm" ? "size-2.5" : "size-3";

  if (!staff) {
    return (
      <span
        className={cn(
          "inline-flex items-baseline gap-1 rounded-md bg-blue-50 text-blue-700",
          sizeClasses,
        )}
      >
        <User className={iconSize} fill="currentColor" strokeWidth={0} />
        <span>{staffId}</span>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setProfileOpen(true)}
        className={cn(
          "inline-flex items-baseline gap-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors",
          sizeClasses,
        )}
      >
        <User className={iconSize} fill="currentColor" strokeWidth={0} />
        <span>{displayName(staff.name)}</span>
      </button>
      <StaffProfileDialog staff={staff} open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

function StaffProfileDialog({
  staff,
  open,
  onOpenChange,
}: {
  staff: StaffRecord;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [clientsOpen, setClientsOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-xl">
        <DialogHeader className="items-center text-center sm:text-center">
          <PhotoZoomButton
            avatar={staff.avatar}
            label={staff.name}
            size="size-16"
            ringClassName="border-2 border-blue-300 bg-blue-100"
          />
          <DialogTitle className="mt-1">{displayName(staff.name)}</DialogTitle>
          <p className="text-sm text-muted-foreground">{staff.title}</p>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2">
          <ContactButton
            icon={<PhoneIcon className="size-4" />}
            label="Phone"
            href={`tel:${staff.phone}`}
          />
          <ContactButton
            icon={<EmailIcon className="size-4" />}
            label="Email"
            href={`mailto:${staff.email}`}
          />
          <ContactButton icon={<ChatIcon className="size-4" />} label="Chat" href={undefined} />
        </div>

        <dl className="space-y-2 text-sm">
          <Row label="Role" value={staff.role} />
          <Row label="NPI" value={staff.npi} />
          <Row label="Location" value={staff.location} />
        </dl>

        <p className="text-sm text-foreground/80 leading-snug">{staff.bio}</p>

        <div className="border-t border-border pt-2">
          <button
            type="button"
            onClick={() => setClientsOpen((v) => !v)}
            aria-expanded={clientsOpen}
            className="flex w-full items-center justify-between text-sm font-semibold text-foreground/80"
          >
            Assigned Clients
            <ChevronDown
              className={cn("size-4 transition-transform", clientsOpen && "rotate-180")}
            />
          </button>
          {clientsOpen && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {/* Never a photo here, even for a client that has one
                  elsewhere — a client's photo is PHI, and this list is just
                  a passive caseload roster inside a staff member's own
                  profile popup, not a place anyone intentionally asked to
                  see a face. Only ClientAvatar's own tap-to-reveal flow on
                  the Info tab is an intentional-enough action for that. */}
              {staff.assignedClients.map((client) => (
                <span
                  key={client}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-sm"
                >
                  <User className="size-3" fill="currentColor" strokeWidth={0} />
                  <span>{client}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContactButton({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
}) {
  const className =
    "flex flex-1 flex-col items-center gap-1 rounded-lg border border-border py-2 text-[11px] font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors";
  if (!href) {
    return (
      <button type="button" className={className}>
        {icon}
        {label}
      </button>
    );
  }
  return (
    <a href={href} className={className}>
      {icon}
      {label}
    </a>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
