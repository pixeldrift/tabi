"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { TimeChevronIcon } from "@/components/icons/TimeChevronIcon";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
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
      "group relative data-[state=open]:z-[60] flex h-8 w-full items-center justify-between whitespace-nowrap rounded-full border-2 border-blue-300 bg-white px-3 py-1.5 text-sm text-blue-700 shadow-sm ring-offset-background cursor-pointer data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      {/* Same shape as the schedule timeline's "now" chevron, resting in
          its native orientation (pointing right); rotates 90° to point
          down as the list opens. */}
      <TimeChevronIcon className="h-3 w-3 shrink-0 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-90" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
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
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-(--radix-select-content-available-height) overflow-y-auto overflow-x-hidden rounded-t-none rounded-b-2xl border-2 border-blue-300 bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[side=bottom]:slide-in-from-top-4 data-[side=top]:slide-in-from-bottom-4 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 origin-(--radix-select-content-transform-origin)",
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
            // The extra top padding pushes the first real item down past the
            // zone hidden behind the trigger (see the content's own
            // translate above) — without it, the top ~half of the list is
            // both invisible AND unclickable, sitting behind the opaque pill.
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] pt-[calc(var(--radix-select-trigger-height)/2+0.25rem)]",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
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
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none focus:bg-blue-100 focus:text-blue-900 data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
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
