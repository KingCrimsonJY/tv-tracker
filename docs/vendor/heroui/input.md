<page url="/en/docs/react/components/input">
# Input

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/input
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(forms)/input.mdx
> Primitive single-line text input component that accepts standard HTML attributes


## Usage

```tsx
import { Input } from '@heroui/react';

```

```tsx
import {Input} from "@heroui/react";

export function Basic() {
  return <Input aria-label="Name" className="w-64" placeholder="Enter your name" />;
}

```

<Callout>
  For validation, labels, and error messages, see **[TextField](/docs/react/components/text-field)**.
</Callout>

## Examples

### Variants

The Input component supports two visual variants:

* **`primary`** (default) - Standard styling with shadow, suitable for most use cases
* **`secondary`** - Lower emphasis variant without shadow, suitable for use in Surface components

```tsx
import {Input} from "@heroui/react";

export function Variants() {
  return (
    <div className="flex w-[240px] flex-col gap-2">
      <Input fullWidth placeholder="Primary input" variant="primary" />
      <Input fullWidth placeholder="Secondary input" variant="secondary" />
    </div>
  );
}

```

### In Surface

When used inside a [Surface](/docs/react/components/surface) component, use `variant="secondary"` to apply the lower emphasis variant suitable for surface backgrounds.

```tsx
import {Input, Surface} from "@heroui/react";

export function OnSurface() {
  return (
    <Surface className="flex h-[180px] w-[280px] items-center justify-center rounded-3xl bg-surface p-4">
      <Input className="w-full" placeholder="Your name" variant="secondary" />
    </Surface>
  );
}

```

### Full Width

```tsx
import {Input} from "@heroui/react";

export function FullWidth() {
  return (
    <div className="w-[400px] space-y-3">
      <Input fullWidth placeholder="Full width input" />
    </div>
  );
}

```

### Input Types

```tsx
import {Input, Label} from "@heroui/react";

export function Types() {
  return (
    <div className="flex w-80 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="input-type-email">Email</Label>
        <Input id="input-type-email" placeholder="jane@example.com" type="email" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="input-type-number">Age</Label>
        <Input id="input-type-number" min={0} placeholder="30" type="number" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="input-type-password">Password</Label>
        <Input id="input-type-password" placeholder="••••••••" type="password" />
      </div>
    </div>
  );
}

```

### Controlled

```tsx
"use client";

import {Input} from "@heroui/react";
import React from "react";

export function Controlled() {
  const [value, setValue] = React.useState("heroui.com");

  return (
    <div className="flex w-80 flex-col gap-2">
      <Input
        aria-label="Domain"
        placeholder="domain"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <span className="px-1 text-sm text-muted">https://{value || "your-domain"}</span>
    </div>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {Input} from "@heroui/react";

export function CustomStyles() {
  return (
    <Input
      aria-label="Search projects"
      className="w-64 rounded-xl border border-border/80 bg-default text-foreground placeholder:text-muted"
      placeholder="Search projects..."
    />
  );
}

```

### Global CSS

The base class `.input` powers every instance. Override it once with `@layer components`.

```css
@layer components {
  .input {
    @apply rounded-lg border border-border bg-surface px-4 py-2 text-sm shadow-sm transition-colors;

    &:hover,
    &[data-hovered="true"] {
      @apply bg-surface-secondary border-border/80;
    }

    &:focus-visible,
    &[data-focus-visible="true"] {
      @apply border-accent ring-2 ring-accent/20;
    }

    &[data-invalid="true"] {
      @apply border-danger bg-danger-soft text-danger;
    }
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

#### Base Classes \[!toc]

* `.input` – Native input element styling

### Interactive States

* **Hover**: `:hover` or `[data-hovered="true"]`
* **Focus Visible**: `:focus-visible` or `[data-focus-visible="true"]`
* **Invalid**: `[data-invalid="true"]` (also syncs with `aria-invalid`)
* **Disabled**: `:disabled` or `[aria-disabled="true"]`
* **Read Only**: `[aria-readonly="true"]`

## API Reference

### Input

Input accepts all standard HTML `<input>` attributes plus the following:

| Prop           | Type                                                   | Default     | Description                                                                                                                                                        |
| -------------- | ------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `className`    | `string`                                               | -           | Tailwind classes merged with the component styles.                                                                                                                 |
| `type`         | `string`                                               | `"text"`    | Input type (text, email, password, number, etc.).                                                                                                                  |
| `value`        | `string`                                               | -           | Controlled value.                                                                                                                                                  |
| `defaultValue` | `string`                                               | -           | Uncontrolled initial value.                                                                                                                                        |
| `onChange`     | `(event: React.ChangeEvent<HTMLInputElement>) => void` | -           | Change handler.                                                                                                                                                    |
| `placeholder`  | `string`                                               | -           | Placeholder text.                                                                                                                                                  |
| `disabled`     | `boolean`                                              | `false`     | Disables the input.                                                                                                                                                |
| `readOnly`     | `boolean`                                              | `false`     | Makes the input read-only.                                                                                                                                         |
| `required`     | `boolean`                                              | `false`     | Marks the input as required.                                                                                                                                       |
| `name`         | `string`                                               | -           | Name for form submission.                                                                                                                                          |
| `autoComplete` | `string`                                               | -           | Autocomplete hint for the browser.                                                                                                                                 |
| `maxLength`    | `number`                                               | -           | Maximum number of characters.                                                                                                                                      |
| `minLength`    | `number`                                               | -           | Minimum number of characters.                                                                                                                                      |
| `pattern`      | `string`                                               | -           | Regex pattern for validation.                                                                                                                                      |
| `min`          | `number \| string`                                     | -           | Minimum value (for number/date inputs).                                                                                                                            |
| `max`          | `number \| string`                                     | -           | Maximum value (for number/date inputs).                                                                                                                            |
| `step`         | `number \| string`                                     | -           | Stepping interval (for number inputs).                                                                                                                             |
| `fullWidth`    | `boolean`                                              | `false`     | Whether the input should take full width of its container                                                                                                          |
| `variant`      | `"primary" \| "secondary"`                             | `"primary"` | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |

> For validation props like `isInvalid`, `isRequired`, and error handling, use **[TextField](/docs/react/components/text-field)** with Input as a child component.

## Related Components

## Related Components

* **TextField**: Composition-friendly fields with labels and validation
* **TextArea**: Multiline text input with focus management
* **Label**: Accessible label for form controls

</page>