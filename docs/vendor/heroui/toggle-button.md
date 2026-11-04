<page url="/en/docs/react/components/toggle-button">
# ToggleButton

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/toggle-button
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(buttons)/toggle-button.mdx
> An interactive toggle control for on/off or selected/unselected states


## Usage

```tsx
import { ToggleButton } from '@heroui/react';

```

```tsx
import {Heart} from "@gravity-ui/icons";
import {ToggleButton} from "@heroui/react";

export function Basic() {
  return (
    <ToggleButton>
      <Heart />
      Like
    </ToggleButton>
  );
}

```

## Examples

### Variants

```tsx
import {Heart} from "@gravity-ui/icons";
import {ToggleButton} from "@heroui/react";

export function Variants() {
  return (
    <div className="flex items-center gap-3">
      <ToggleButton>
        <Heart />
        Default
      </ToggleButton>
      <ToggleButton variant="ghost">
        <Heart />
        Ghost
      </ToggleButton>
    </div>
  );
}

```

### Icon Only

```tsx
import {Bookmark, Heart} from "@gravity-ui/icons";
import {ToggleButton} from "@heroui/react";

export function IconOnly() {
  return (
    <div className="flex items-center gap-3">
      <ToggleButton isIconOnly aria-label="Like">
        <Heart />
      </ToggleButton>
      <ToggleButton isIconOnly aria-label="Bookmark" variant="ghost">
        <Bookmark />
      </ToggleButton>
    </div>
  );
}

```

### Sizes

```tsx
import {Heart} from "@gravity-ui/icons";
import {ToggleButton} from "@heroui/react";

export function Sizes() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <ToggleButton size="sm">
          <Heart />
          Small
        </ToggleButton>
        <ToggleButton size="md">
          <Heart />
          Medium
        </ToggleButton>
        <ToggleButton size="lg">
          <Heart />
          Large
        </ToggleButton>
      </div>
      <div className="flex items-center gap-3">
        <ToggleButton isIconOnly aria-label="Like" size="sm">
          <Heart />
        </ToggleButton>
        <ToggleButton isIconOnly aria-label="Like" size="md">
          <Heart />
        </ToggleButton>
        <ToggleButton isIconOnly aria-label="Like" size="lg">
          <Heart />
        </ToggleButton>
      </div>
    </div>
  );
}

```

### Disabled

```tsx
import {Heart, HeartFill} from "@gravity-ui/icons";
import {ToggleButton} from "@heroui/react";

export function Disabled() {
  return (
    <div className="flex items-center gap-3">
      <ToggleButton isDisabled>
        <Heart />
        Like
      </ToggleButton>
      <ToggleButton defaultSelected isDisabled>
        <HeartFill />
        Like
      </ToggleButton>
    </div>
  );
}

```

### Controlled

```tsx
"use client";

import {Heart, HeartFill} from "@gravity-ui/icons";
import {ToggleButton} from "@heroui/react";
import {useState} from "react";

export function Controlled() {
  const [isSelected, setIsSelected] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <ToggleButton isSelected={isSelected} onChange={setIsSelected}>
        {({isSelected: selected}) => (
          <>
            {selected ? <HeartFill /> : <Heart />}
            {selected ? "Liked" : "Like"}
          </>
        )}
      </ToggleButton>
      <p className="text-sm text-muted">
        Status: <span className="font-medium">{isSelected ? "Selected" : "Not selected"}</span>
      </p>
    </div>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {Heart} from "@gravity-ui/icons";
import {ToggleButton} from "@heroui/react";

export function CustomStyles() {
  return (
    <ToggleButton className="gap-2 rounded-full border border-border/80 bg-surface px-4 text-foreground shadow-sm data-[selected=true]:border-accent/30 data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent-soft-foreground [&_svg]:text-muted data-[selected=true]:[&_svg]:text-accent">
      <Heart />
      Save article
    </ToggleButton>
  );
}

```

### Global CSS

To customize the ToggleButton component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .toggle-button {
    @apply bg-purple-500 text-white;
  }

  .toggle-button--icon-only {
    @apply rounded-lg;
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ToggleButton component uses these CSS classes ([View source styles](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/toggle-button.css)):

#### Base & Size Classes \[!toc]

* `.toggle-button` - Base toggle button styles
* `.toggle-button--sm` - Small size variant
* `.toggle-button--md` - Medium size variant (default)
* `.toggle-button--lg` - Large size variant

#### Variant Classes \[!toc]

* `.toggle-button--default` - Default variant with filled background
* `.toggle-button--ghost` - Ghost variant with transparent background

#### Modifier Classes \[!toc]

* `.toggle-button--icon-only` - Icon-only toggle button
* `.toggle-button--icon-only.toggle-button--sm` - Small icon-only
* `.toggle-button--icon-only.toggle-button--lg` - Large icon-only

### Interactive States

The toggle button supports both CSS pseudo-classes and data attributes for flexibility:

* **Selected**: `[data-selected="true"]` (accent background and foreground)
* **Hover**: `:hover` or `[data-hovered="true"]`
* **Active/Pressed**: `:active` or `[data-pressed="true"]` (includes scale transform)
* **Focus**: `:focus-visible` or `[data-focus-visible="true"]` (shows focus ring)
* **Disabled**: `:disabled` or `[aria-disabled="true"]` (reduced opacity, no pointer events)

## API Reference

### ToggleButton

Inherits from [React Aria ToggleButton](https://react-spectrum.adobe.com/react-aria/ToggleButton.html).

| Prop              | Type                                                                      | Default     | Description                               |
| ----------------- | ------------------------------------------------------------------------- | ----------- | ----------------------------------------- |
| `variant`         | `'default' \| 'ghost'`                                                    | `'default'` | Visual style variant                      |
| `size`            | `'sm' \| 'md' \| 'lg'`                                                    | `'md'`      | Size of the toggle button                 |
| `isIconOnly`      | `boolean`                                                                 | `false`     | Whether the button contains only an icon  |
| `isSelected`      | `boolean`                                                                 | -           | Controlled selected state                 |
| `defaultSelected` | `boolean`                                                                 | `false`     | Default selected state (uncontrolled)     |
| `isDisabled`      | `boolean`                                                                 | `false`     | Whether the toggle button is disabled     |
| `onChange`        | `(isSelected: boolean) => void`                                           | -           | Handler called when selection changes     |
| `onPress`         | `(e: PressEvent) => void`                                                 | -           | Handler called when the button is pressed |
| `children`        | `React.ReactNode \| (values: ToggleButtonRenderProps) => React.ReactNode` | -           | Button content or render prop             |

### Render Props

When using the render prop pattern, these values are provided:

| Prop             | Type      | Description                                    |
| ---------------- | --------- | ---------------------------------------------- |
| `isSelected`     | `boolean` | Whether the button is currently selected       |
| `isPressed`      | `boolean` | Whether the button is currently pressed        |
| `isHovered`      | `boolean` | Whether the button is hovered                  |
| `isFocused`      | `boolean` | Whether the button is focused                  |
| `isFocusVisible` | `boolean` | Whether the button should show focus indicator |
| `isDisabled`     | `boolean` | Whether the button is disabled                 |

## Related Components

## Related Components

* **Button**: Allows a user to perform an action
* **Switch**: Toggle between two states
* **Checkbox**: Binary choice input control

</page>