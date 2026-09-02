import Icon from "./svg/exit.svg?react";

/** A closed room with an arrow passing through its wall — "step away, the
 *  session keeps running for whoever's still in it" (StatusBar's
 *  pause-or-leave dialog), distinct from Pause's own "stop the timer for
 *  everyone" option in that same dialog. Deliberately not lucide's own
 *  LogOut (an open-sided box) — this one stays a fully closed room, since
 *  the point is that leaving doesn't tear anything down behind you. Same
 *  2.6 stroke as every other custom icon here. Source: ./svg/exit.svg (edit
 *  there — this file just re-exports it). */
export const ExitIcon = Icon;
