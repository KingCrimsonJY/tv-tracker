<page url="/en/docs/react/components/drawer">
# Drawer

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/drawer
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(overlays)/drawer.mdx
> Slide-out panel for supplementary content and actions


## Usage

```tsx
import { Drawer, Button } from "@heroui/react";

```

```tsx
import {Button, Drawer} from "@heroui/react";

export function Basic() {
  return (
    <Drawer>
      <Button variant="secondary">Open Drawer</Button>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog>
            <Drawer.Header>
              <Drawer.Heading>Drawer Title</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <p>
                This is a bottom drawer built with React Aria's Modal component. It slides up from
                the bottom of the screen with a smooth CSS transition.
              </p>
            </Drawer.Body>
            <Drawer.Footer>
              <Button slot="close" variant="secondary">
                Cancel
              </Button>
              <Button slot="close">Confirm</Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

```

## Anatomy

```tsx
import { Drawer, Button } from "@heroui/react";

export default () => (
  <Drawer>
    <Button>Open Drawer</Button>
    <Drawer.Backdrop>
      <Drawer.Content>
        <Drawer.Dialog>
          <Drawer.Handle /> {/* Optional: Drag handle */}
          <Drawer.CloseTrigger /> {/* Optional: Close button */}
          <Drawer.Header>
            <Drawer.Heading />
          </Drawer.Header>
          <Drawer.Body />
          <Drawer.Footer />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  </Drawer>
);

```

## Examples

### Placement

```tsx
import {Button, Drawer} from "@heroui/react";

export function Placements() {
  const placements = ["bottom", "top", "left", "right"] as const;

  return (
    <div className="flex flex-wrap gap-4">
      {placements.map((placement) => (
        <Drawer key={placement}>
          <Button variant="secondary">
            {placement.charAt(0).toUpperCase() + placement.slice(1)}
          </Button>
          <Drawer.Backdrop>
            <Drawer.Content placement={placement}>
              <Drawer.Dialog>
                <Drawer.CloseTrigger />
                {placement === "bottom" && <Drawer.Handle />}
                <Drawer.Header>
                  <Drawer.Heading>
                    {placement.charAt(0).toUpperCase() + placement.slice(1)} Drawer
                  </Drawer.Heading>
                </Drawer.Header>
                <Drawer.Body>
                  <p>
                    This drawer slides in from the <strong>{placement}</strong> edge of the screen.
                  </p>
                </Drawer.Body>
                <Drawer.Footer>
                  <Button slot="close" variant="secondary">
                    Cancel
                  </Button>
                  <Button slot="close">Done</Button>
                </Drawer.Footer>
                {placement === "top" && <Drawer.Handle />}
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>
      ))}
    </div>
  );
}

```

### Non-Dismissable

Set `isDismissable={false}` on `Drawer.Backdrop` to prevent closing by clicking outside or dragging. The user must interact with the drawer's action buttons.

```tsx
import {Button, Drawer} from "@heroui/react";

export function NonDismissable() {
  return (
    <Drawer>
      <Button variant="secondary">Important Action</Button>
      <Drawer.Backdrop isDismissable={false}>
        <Drawer.Content>
          <Drawer.Dialog>
            <Drawer.Header>
              <Drawer.Heading>Confirm Action</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <p>
                This drawer cannot be dismissed by clicking outside or dragging. You must use one of
                the buttons below.
              </p>
            </Drawer.Body>
            <Drawer.Footer>
              <Button slot="close" variant="secondary">
                Cancel
              </Button>
              <Button slot="close">Confirm</Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

```

### Scrollable Content

The `Drawer.Body` automatically handles overflow with native scrolling. Drag-to-dismiss is excluded from the body area to avoid scroll conflicts.

```tsx
import {Button, Drawer} from "@heroui/react";

export function ScrollableContent() {
  return (
    <Drawer>
      <Button variant="secondary">Terms & Conditions</Button>
      <Drawer.Backdrop>
        <Drawer.Content>
          <Drawer.Dialog>
            <Drawer.Handle />
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>Terms & Conditions</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              {Array.from({length: 20}).map((_, i) => (
                <p key={i} className="mb-3">
                  Paragraph {i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam
                  pulvinar risus non risus hendrerit venenatis. Pellentesque sit amet hendrerit
                  risus, sed porttitor quam.
                </p>
              ))}
            </Drawer.Body>
            <Drawer.Footer>
              <Button slot="close" variant="secondary">
                Decline
              </Button>
              <Button slot="close">Accept</Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

```

### Controlled State

```tsx
"use client";

import {Button, Drawer, useOverlayState} from "@heroui/react";
import React from "react";

export function Controlled() {
  const [isOpen, setIsOpen] = React.useState(false);

  const state = useOverlayState();

  return (
    <div className="flex max-w-md flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-foreground">With React.useState()</h3>
        <p className="text-sm leading-relaxed text-pretty text-muted">
          Control the drawer using React's <code className="text-foreground">useState</code> hook
          for simple state management.
        </p>
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-surface p-4 shadow-sm">
          <div className="flex w-full items-center justify-between">
            <p className="text-xs text-muted">
              Status:{" "}
              <span className="font-mono font-medium text-foreground">
                {isOpen ? "open" : "closed"}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onPress={() => setIsOpen(true)}>
              Open Drawer
            </Button>
            <Button size="sm" variant="tertiary" onPress={() => setIsOpen(!isOpen)}>
              Toggle
            </Button>
          </div>
        </div>

        <Drawer.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
          <Drawer.Content placement="right">
            <Drawer.Dialog>
              <Drawer.CloseTrigger />
              <Drawer.Header>
                <Drawer.Heading>Controlled with useState()</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body>
                <p>
                  This drawer is controlled by React's <code>useState</code> hook. Pass{" "}
                  <code>isOpen</code> and <code>onOpenChange</code> props to manage the drawer state
                  externally.
                </p>
              </Drawer.Body>
              <Drawer.Footer>
                <Button slot="close" variant="secondary">
                  Close
                </Button>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-foreground">With useOverlayState()</h3>
        <p className="text-sm leading-relaxed text-pretty text-muted">
          Use the <code className="text-foreground">useOverlayState</code> hook for a cleaner API
          with convenient methods like <code>open()</code>, <code>close()</code>, and{" "}
          <code>toggle()</code>.
        </p>
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-surface p-4 shadow-sm">
          <div className="flex w-full items-center justify-between">
            <p className="text-xs text-muted">
              Status:{" "}
              <span className="font-mono font-medium text-foreground">
                {state.isOpen ? "open" : "closed"}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onPress={state.open}>
              Open Drawer
            </Button>
            <Button size="sm" variant="tertiary" onPress={state.toggle}>
              Toggle
            </Button>
          </div>
        </div>

        <Drawer.Backdrop isOpen={state.isOpen} onOpenChange={state.setOpen}>
          <Drawer.Content placement="right">
            <Drawer.Dialog>
              <Drawer.CloseTrigger />
              <Drawer.Header>
                <Drawer.Heading>Controlled with useOverlayState()</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body>
                <p>
                  The <code>useOverlayState</code> hook provides dedicated methods for common
                  operations. No need to manually create callbacks—just use{" "}
                  <code>state.open()</code>, <code>state.close()</code>, or{" "}
                  <code>state.toggle()</code>.
                </p>
              </Drawer.Body>
              <Drawer.Footer>
                <Button slot="close" variant="secondary">
                  Close
                </Button>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </div>
    </div>
  );
}

```

### With Form

```tsx
import {Button, Drawer, Input, Label, TextField} from "@heroui/react";

export function WithForm() {
  return (
    <Drawer>
      <Button variant="secondary">Edit Profile</Button>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog>
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>Edit Profile</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <form className="flex flex-col gap-4">
                <TextField className="w-full" name="name" type="text">
                  <Label>Name</Label>
                  <Input placeholder="Enter your name" variant="secondary" />
                </TextField>
                <TextField className="w-full" name="email" type="email">
                  <Label>Email</Label>
                  <Input placeholder="Enter your email" variant="secondary" />
                </TextField>
                <TextField className="w-full" name="bio">
                  <Label>Bio</Label>
                  <Input placeholder="Tell us about yourself" variant="secondary" />
                </TextField>
              </form>
            </Drawer.Body>
            <Drawer.Footer>
              <Button slot="close" variant="secondary">
                Cancel
              </Button>
              <Button slot="close">Save Changes</Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

```

### Navigation Drawer

```tsx
import type {ComponentType, SVGProps} from "react";

import {Bars, Bell, Envelope, Gear, House, Magnifier, Person} from "@gravity-ui/icons";
import {Button, Drawer} from "@heroui/react";

export function Navigation() {
  const navItems: {icon: ComponentType<SVGProps<SVGSVGElement>>; label: string}[] = [
    {icon: House, label: "Home"},
    {icon: Magnifier, label: "Search"},
    {icon: Bell, label: "Notifications"},
    {icon: Envelope, label: "Messages"},
    {icon: Person, label: "Profile"},
    {icon: Gear, label: "Settings"},
  ];

  return (
    <Drawer>
      <Button variant="secondary">
        <Bars />
        Menu
      </Button>
      <Drawer.Backdrop>
        <Drawer.Content placement="left">
          <Drawer.Dialog>
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>Navigation</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-default"
                    type="button"
                  >
                    <item.icon className="size-5 text-muted" />
                    {item.label}
                  </button>
                ))}
              </nav>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

```

### Backdrop Variants

```tsx
import {Button, Drawer} from "@heroui/react";

export function BackdropVariants() {
  const variants = ["opaque", "blur", "transparent"] as const;

  return (
    <div className="flex flex-wrap gap-4">
      {variants.map((variant) => (
        <Drawer key={variant}>
          <Button variant="secondary">{variant.charAt(0).toUpperCase() + variant.slice(1)}</Button>
          <Drawer.Backdrop variant={variant}>
            <Drawer.Content>
              <Drawer.Dialog>
                <Drawer.Handle />
                <Drawer.CloseTrigger />
                <Drawer.Header>
                  <Drawer.Heading>
                    Backdrop: {variant.charAt(0).toUpperCase() + variant.slice(1)}
                  </Drawer.Heading>
                </Drawer.Header>
                <Drawer.Body>
                  <p>
                    This drawer uses the <code>{variant}</code> backdrop variant.
                  </p>
                </Drawer.Body>
                <Drawer.Footer>
                  <Button className="w-full" slot="close">
                    Close
                  </Button>
                </Drawer.Footer>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>
      ))}
    </div>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {Button, Drawer} from "@heroui/react";

export function CustomStyles() {
  return (
    <Drawer>
      <Button variant="secondary">Open filters</Button>
      <Drawer.Backdrop variant="blur">
        <Drawer.Content placement="right">
          <Drawer.Dialog className="border-l border-border/80 bg-surface">
            <Drawer.Header>
              <Drawer.Heading className="text-foreground">Filters</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <p className="text-sm text-muted">Narrow results by status, owner, or date.</p>
            </Drawer.Body>
            <Drawer.Footer>
              <Button slot="close" variant="secondary">
                Cancel
              </Button>
              <Button slot="close">Apply</Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

```

### Global CSS

To customize the Drawer component classes, you can use the `@layer components` directive.

[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .drawer__backdrop {
    @apply bg-gradient-to-br from-black/50 to-black/70;
  }

  .drawer__dialog {
    @apply rounded-2xl border border-white/10 shadow-2xl;
  }

  .drawer__header {
    @apply text-center;
  }

  .drawer__close-trigger {
    @apply rounded-full bg-white/10 hover:bg-white/20;
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Drawer component uses these CSS classes ([View source styles](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/drawer.css)):

#### Base Classes \[!toc]

* `.drawer__trigger` - Trigger element that opens the drawer
* `.drawer__backdrop` - Overlay backdrop behind the drawer
* `.drawer__content` - Positioning wrapper for the drawer panel
* `.drawer__dialog` - The drawer panel itself
* `.drawer__header` - Header section for titles
* `.drawer__heading` - Main title text
* `.drawer__body` - Main scrollable content area
* `.drawer__footer` - Footer section for actions
* `.drawer__handle` - Visual drag handle indicator
* `.drawer__close-trigger` - Close button element

#### Backdrop Variants \[!toc]

* `.drawer__backdrop--opaque` - Opaque colored backdrop (default)
* `.drawer__backdrop--blur` - Blurred backdrop with glass effect
* `.drawer__backdrop--transparent` - Transparent backdrop (no overlay)

#### Placement Variants \[!toc]

* `.drawer__content--bottom` - Slides up from the bottom edge (default)
* `.drawer__content--top` - Slides down from the top edge
* `.drawer__content--left` - Slides in from the left edge
* `.drawer__content--right` - Slides in from the right edge

#### Dialog Variants \[!toc]

* `.drawer__dialog--top` - Slides down from the top edge
* `.drawer__dialog--bottom` - Slides up from the bottom edge
* `.drawer__dialog--left` - Slides in from the left edge
* `.drawer__dialog--right` - Slides in from the right edge

### Interactive States

The component supports these interactive states:

* **Focus**: `:focus-visible` or `[data-focus-visible="true"]` - Applied to trigger and close button
* **Hover**: `:hover` or `[data-hovered="true"]` - Applied to close button on hover
* **Active**: `:active` or `[data-pressed="true"]` - Applied to trigger and close button when pressed
* **Entering**: `[data-entering]` - Applied during drawer opening animation
* **Exiting**: `[data-exiting]` - Applied during drawer closing animation
* **Placement**: `[data-placement="*"]` - Applied based on drawer position (top, bottom, left, right)

## API Reference

### Drawer

| Prop       | Type                    | Default | Description                   |
| ---------- | ----------------------- | ------- | ----------------------------- |
| `children` | `ReactNode`             | -       | Trigger and backdrop elements |
| `state`    | `UseOverlayStateReturn` | -       | Controlled overlay state      |

### Drawer.Trigger

| Prop        | Type        | Default | Description            |
| ----------- | ----------- | ------- | ---------------------- |
| `children`  | `ReactNode` | -       | Custom trigger content |
| `className` | `string`    | -       | CSS classes            |

### Drawer.Backdrop

| Prop                        | Type                                  | Default    | Description               |
| --------------------------- | ------------------------------------- | ---------- | ------------------------- |
| `variant`                   | `"opaque" \| "blur" \| "transparent"` | `"opaque"` | Backdrop overlay style    |
| `isDismissable`             | `boolean`                             | `true`     | Close on backdrop click   |
| `isKeyboardDismissDisabled` | `boolean`                             | `false`    | Disable ESC key to close  |
| `isOpen`                    | `boolean`                             | -          | Controlled open state     |
| `onOpenChange`              | `(isOpen: boolean) => void`           | -          | Open state change handler |
| `className`                 | `string \| (values) => string`        | -          | Backdrop CSS classes      |

### Drawer.Content

| Prop        | Type                                     | Default    | Description                 |
| ----------- | ---------------------------------------- | ---------- | --------------------------- |
| `placement` | `"top" \| "bottom" \| "left" \| "right"` | `"bottom"` | Edge the drawer slides from |
| `className` | `string \| (values) => string`           | -          | Content CSS classes         |

### Drawer.Dialog

| Prop              | Type        | Default    | Description         |
| ----------------- | ----------- | ---------- | ------------------- |
| `children`        | `ReactNode` | -          | Dialog content      |
| `className`       | `string`    | -          | CSS classes         |
| `role`            | `string`    | `"dialog"` | ARIA role           |
| `aria-label`      | `string`    | -          | Accessibility label |
| `aria-labelledby` | `string`    | -          | ID of label element |

### Drawer.Header

| Prop        | Type        | Default | Description    |
| ----------- | ----------- | ------- | -------------- |
| `children`  | `ReactNode` | -       | Header content |
| `className` | `string`    | -       | CSS classes    |

### Drawer.Heading

| Prop        | Type        | Default | Description |
| ----------- | ----------- | ------- | ----------- |
| `children`  | `ReactNode` | -       | Title text  |
| `className` | `string`    | -       | CSS classes |

### Drawer.Body

| Prop        | Type        | Default | Description  |
| ----------- | ----------- | ------- | ------------ |
| `children`  | `ReactNode` | -       | Body content |
| `className` | `string`    | -       | CSS classes  |

### Drawer.Footer

| Prop        | Type        | Default | Description    |
| ----------- | ----------- | ------- | -------------- |
| `children`  | `ReactNode` | -       | Footer content |
| `className` | `string`    | -       | CSS classes    |

### Drawer.Handle

| Prop        | Type     | Default | Description |
| ----------- | -------- | ------- | ----------- |
| `className` | `string` | -       | CSS classes |

### Drawer.CloseTrigger

| Prop        | Type                           | Default | Description         |
| ----------- | ------------------------------ | ------- | ------------------- |
| `children`  | `ReactNode`                    | -       | Custom close button |
| `className` | `string \| (values) => string` | -       | CSS classes         |

### useOverlayState Hook

```tsx
import { useOverlayState } from "@heroui/react";

const state = useOverlayState({
  defaultOpen: false,
  onOpenChange: (isOpen) => console.log(isOpen),
});

state.isOpen; // Current state
state.open(); // Open drawer
state.close(); // Close drawer
state.toggle(); // Toggle state
state.setOpen(); // Set state directly

```

## Accessibility

Implements [WAI-ARIA Dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/):

* **Focus trap**: Focus locked within drawer when open
* **Keyboard**: `ESC` closes (when dismissable), `Tab` cycles elements
* **Screen readers**: Proper ARIA attributes via React Aria
* **Scroll lock**: Body scroll disabled when open
* **Drag to dismiss**: Supports pointer-based drag gestures on handle, header, and footer areas

## Related Components

## Related Components

* **Modal**: Displays content in a modal overlay
* **Button**: Allows a user to perform an action
* **CloseButton**: Button for dismissing overlays

</page>