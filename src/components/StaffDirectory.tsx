import { useState } from "react";
import { User, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PhoneIcon } from "./icons/PhoneIcon";
import { EmailIcon } from "./icons/EmailIcon";
import { ChatIcon } from "./icons/ChatIcon";
import { PhotoZoomButton } from "@/components/PhotoZoom";
import { cn } from "@/lib/utils";
import doofenshmirtzPhoto from "@/assets/images/people/doofenshmirtz.jpeg";
import perryPhoto from "@/assets/images/people/perry.jpeg";
import isabellaPhoto from "@/assets/images/people/isabella.jpeg";
import baljeetPhoto from "@/assets/images/people/baljeet.jpeg";
import vanessaPhoto from "@/assets/images/people/vanessa.jpeg";
import jeremyPhoto from "@/assets/images/people/jeremy.jpeg";

interface StaffRecord {
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
const STAFF_DIRECTORY: Record<string, StaffRecord> = {
  "Heinz Doofenshmirtz": {
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
  "Perry Plat": {
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
  "Isabella Garcia-Shapiro": {
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
  "Baljeet Tjinder": {
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
  "Vanessa Doofenshmirtz": {
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
  "Jeremy Johnson": {
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

/** A person's name, styled as a pill — same look everywhere it appears
 *  (Info tab's plan/BCBA/team rows). Staff members (anyone with a
 *  `STAFF_DIRECTORY` entry) open a small Profile/Phone/Email/Chat menu;
 *  the client themself has no staff record, so their pill stays a plain,
 *  non-interactive label. */
export function PersonPill({ name }: { name: string }) {
  const staff = STAFF_DIRECTORY[name];
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  if (!staff) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-sm">
        <User className="size-3" fill="currentColor" strokeWidth={0} />
        <span>{name}</span>
      </span>
    );
  }

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm"
          >
            <User className="size-3" fill="currentColor" strokeWidth={0} />
            <span>{name}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="center"
          sideOffset={8}
          className="group w-48 rounded-xl border-2 border-blue-300 bg-card p-1 shadow-[0_10px_30px_-4px_rgba(0,0,0,0.25)]"
        >
          <MenuButton
            icon={<User className="size-3.5" />}
            label="Profile"
            onClick={() => {
              setMenuOpen(false);
              setProfileOpen(true);
            }}
          />
          <MenuLink icon={<PhoneIcon className="size-3.5" />} label="Phone" href={`tel:${staff.phone}`} />
          <MenuLink icon={<EmailIcon className="size-3.5" />} label="Email" href={`mailto:${staff.email}`} />
          {/* No chat surface exists in this app yet — closes the menu rather
              than linking anywhere real. */}
          <MenuButton icon={<ChatIcon className="size-3.5" />} label="Chat" onClick={() => setMenuOpen(false)} />
          {/* Arrow — same rotated-square idiom as every other popup in the
              app (NumberKeypad, the filter popover, the rating picker),
              flipping which edge is drawn depending on which side Radix
              actually placed the content. */}
          <div
            className={cn(
              "absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-blue-300 bg-card",
              "-top-[6px] border-l-2 border-t-2",
              "group-data-[side=top]:top-auto group-data-[side=top]:-bottom-[6px]",
              "group-data-[side=top]:border-l-0 group-data-[side=top]:border-t-0",
              "group-data-[side=top]:border-r-2 group-data-[side=top]:border-b-2",
            )}
          />
        </PopoverContent>
      </Popover>
      <StaffProfileDialog staff={staff} open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 hover:bg-stone-100 hover:text-foreground transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

function MenuLink({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <a
      href={href}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 hover:bg-stone-100 hover:text-foreground transition-colors"
    >
      {icon}
      {label}
    </a>
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
          <DialogTitle className="mt-1">{staff.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">{staff.title}</p>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2">
          <ContactButton icon={<PhoneIcon className="size-4" />} label="Phone" href={`tel:${staff.phone}`} />
          <ContactButton icon={<EmailIcon className="size-4" />} label="Email" href={`mailto:${staff.email}`} />
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
            <ChevronDown className={cn("size-4 transition-transform", clientsOpen && "rotate-180")} />
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

function ContactButton({ icon, label, href }: { icon: React.ReactNode; label: string; href?: string }) {
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
