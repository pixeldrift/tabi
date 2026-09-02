import Icon from "./svg/exit.svg?react";

/** A closed room with an arrow passing through its wall — "step away, the
 *  session keeps running for whoever's still in it" (StatusBar's
 *  pause-or-leave dialog), distinct from Pause's own "stop the timer for
 *  everyone" option in that same dialog. Deliberately not lucide's own
 *  LogOut (an open-sided box) — this one stays a fully closed room, since
 *  the point is that leaving doesn't tear anything down behind you. Bolder
 *  stroke (4, vs. the app's usual 2.6) and a squarer box than the rest of
 *  the custom icon set, matching the reference this was drawn from — at
 *  this icon's small render size a thinner box wall was hard to tell apart
 *  from the arrow crossing it. Source: ./svg/exit.svg (edit there — this
 *  file just re-exports it). */
export const ExitIcon = Icon;
