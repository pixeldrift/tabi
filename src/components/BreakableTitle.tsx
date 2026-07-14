import { Fragment } from "react";

/** Splits a title on "/" and inserts an explicit <wbr /> right after each
 *  slash, so a compound name (e.g. "Property destruction/throwing") gets a
 *  real line-break opportunity there instead of the browser falling back to
 *  an arbitrary mid-word cut (or, without any break opportunity at all,
 *  just overflowing) wherever the line runs out of room. */
export function renderBreakableTitle(title: string) {
  const parts = title.split("/");
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 && <wbr />}
      {part}
      {i < parts.length - 1 && "/"}
    </Fragment>
  ));
}
