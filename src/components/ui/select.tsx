"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { TimeChevronIcon } from "@/components/icons/TimeChevronIcon";
import { DialogContentContext } from "@/components/ui/dialog";

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

// Radix only exposes the flipped-open side (`data-side`) on the portaled
// Content element, not on the Trigger — but the chevron icon lives in the
// Trigger. This context lets SelectContent report which side it actually
// rendered on so the Trigger's chevron can mirror it (pointing up instead
// of down when the list had to flip open upward).
const SelectSideContext = React.createContext<{
  side: "top" | "bottom";
  setSide: (side: "top" | "bottom") => void;
}>({ side: "bottom", setSide: () => {} });

const Select = ({ children, ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) => {
  const [side, setSide] = React.useState<"top" | "bottom">("bottom");
  return (
    <SelectSideContext.Provider value={{ side, setSide }}>
      <SelectPrimitive.Root {...props}>{children}</SelectPrimitive.Root>
    </SelectSideContext.Provider>
  );
};

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const { side } = React.useContext(SelectSideContext);
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        // relative + the open-only z-[60] keeps the pill stacked above its
        // OWN portaled content (z-50) while it's open — the content tucks up
        // under the trigger's lower half (see SelectContent's translate)
        // instead of leaving a visible gap where the pill's curvature peels
        // away from a flat-topped list. Scoped to data-[state=open] (not a
        // permanent z-index) so a closed trigger doesn't sit above unrelated
        // z-50 content elsewhere on the page, like an open Dialog.
        // The blue pill look is the app's one Select style — every trigger
        // gets it by default rather than each call site repeating it.
        "group relative data-[state=open]:z-[60] flex h-8 w-full items-center justify-between whitespace-nowrap rounded-full border-2 border-blue-400 bg-white px-3 py-1.5 text-sm text-blue-700 shadow-sm ring-offset-background cursor-pointer data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        {/* Same shape as the schedule timeline's "now" chevron, resting in
            its native orientation (pointing right); rotates 90° to point
            down as the list opens below, or up when it had to flip open
            above (see SelectSideContext). */}
        <TimeChevronIcon
          className={cn(
            "h-3 w-3 shrink-0 opacity-60 transition-transform duration-200",
            side === "top" ? "group-data-[state=open]:-rotate-90" : "group-data-[state=open]:rotate-90",
          )}
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => {
  const { setSide } = React.useContext(SelectSideContext);
  const dialogContainer = React.useContext(DialogContentContext);
  // Mirrors the same value pushed up to SelectSideContext (for the Trigger's
  // chevron), but kept locally too — the Viewport below needs it to flip its
  // padding, and Viewport is a plain nested div with no `data-side` of its
  // own to select against in CSS.
  const [contentSide, setContentSide] = React.useState<"top" | "bottom">("bottom");
  const observerRef = React.useRef<MutationObserver | null>(null);

  // Radix sets `data-side` on this element directly (not as a prop we can
  // read) once its collision detection picks an actual side, and can update
  // it again later if the trigger's position changes while open. The
  // observer is wired up right here in the ref callback — rather than in a
  // separate effect — because Radix mounts/measures/remounts this element
  // through several passes as it positions itself, and a plain effect (keyed
  // on a dependency array) only fires once for the whole sequence, missing
  // the node reference by the time it runs.
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (!node) return;
      const readSide = () => {
        const value = node.getAttribute("data-side");
        if (value === "top" || value === "bottom") {
          setSide(value);
          setContentSide(value);
        }
      };
      readSide();
      const observer = new MutationObserver(readSide);
      observer.observe(node, { attributes: true, attributeFilter: ["data-side"] });
      observerRef.current = observer;
    },
    [ref, setSide],
  );

  return (
    // Default to document.body (Radix's own default) outside of a Dialog.
    // Inside one, portal into the Dialog's own content element instead —
    // otherwise this list and DialogContent end up as same-z-index body
    // siblings, and whichever mounts later wins the tie everywhere,
    // including at the seam where the trigger pill is meant to show
    // through on top (see DialogContentContext for the full explanation).
    <SelectPrimitive.Portal container={dialogContainer ?? undefined}>
      <SelectPrimitive.Content
        ref={setRefs}
        className={cn(
          "relative z-50 max-h-(--radix-select-content-available-height) overflow-y-auto overflow-x-hidden border-2 border-blue-400 bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[side=bottom]:slide-in-from-top-4 data-[side=top]:slide-in-from-bottom-4 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 origin-(--radix-select-content-transform-origin)",
          // Normal case: list hangs below the pill, flat top tucks under
          // it, rounded bottom. Flipped case (opened upward because there's
          // no room below): mirror it — flat bottom tucks under the pill
          // from above, rounded top.
          "data-[side=bottom]:rounded-t-none data-[side=bottom]:rounded-b-2xl data-[side=top]:rounded-b-none data-[side=top]:rounded-t-2xl",
          position === "popper"
            ? // Match the trigger's own width exactly (not just a min-width)
              // so the list reads as part of the same pill, not a wider card.
              // Pulling the list up to the trigger's vertical center (see
              // below) is what makes it look attached — the pill, stacked
              // above via z-[60] on SelectTrigger, covers the overlap.
              "w-(--radix-select-trigger-width) data-[side=bottom]:-translate-y-[calc(var(--radix-select-trigger-height)/2)] data-[side=left]:-translate-x-0 data-[side=right]:translate-x-0 data-[side=top]:translate-y-[calc(var(--radix-select-trigger-height)/2)]"
            : "min-w-[8rem]",
          className,
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
            // The extra padding pushes the item nearest the pill (first item
            // when hanging below, last item when flipped above) past the
            // zone hidden behind the trigger (see the content's own
            // translate above) — without it, that item is both invisible
            // AND unclickable, sitting behind the opaque pill. Viewport is a
            // plain nested div (no `data-side` of its own), so which side
            // gets the padding is driven by contentSide instead of CSS.
            position === "popper" &&
              (contentSide === "top"
                ? "pb-[calc(var(--radix-select-trigger-height)/2+0.25rem)]"
                : "pt-[calc(var(--radix-select-trigger-height)/2+0.25rem)]"),
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      // The theme's --accent is a warm amber, which reads as a stray orange
      // highlight in an otherwise all-blue interface — blue directly here
      // instead, so every Select gets it without each call site re-adding it.
      // The selected item's own blue background is enough of a marker on
      // its own, so there's no separate checkmark glyph next to it.
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none focus:bg-blue-100 focus:text-blue-700 data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
