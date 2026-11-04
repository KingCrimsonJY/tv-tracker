<page url="/en/docs/react/components/text-area">
# TextArea

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/text-area
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(forms)/text-area.mdx
> Primitive multiline text input component that accepts standard HTML attributes


## Usage

```tsx
import { TextArea } from '@heroui/react';

```

```tsx
import {TextArea} from "@heroui/react";

export function Basic() {
  return (
    <TextArea
      aria-label="Quick project update"
      className="h-32 w-96"
      placeholder="Share a quick project update..."
    />
  );
}

```

<Callout>
  For validation, labels, and error messages, see **[TextField](/docs/react/components/text-field)**.
</Callout>

## Examples

### Variants

The TextArea component supports two visual variants:

* **`primary`** (default) - Standard styling with shadow, suitable for most use cases
* **`secondary`** - Lower emphasis variant without shadow, suitable for use in Surface components

```tsx
import {TextArea} from "@heroui/react";

export function Variants() {
  return (
    <div className="flex w-[280px] flex-col gap-2">
      <TextArea fullWidth placeholder="Primary textarea" variant="primary" />
      <TextArea fullWidth placeholder="Secondary textarea" variant="secondary" />
    </div>
  );
}

```

### In Surface

When used inside a [Surface](/docs/react/components/surface) component, use `variant="secondary"` to apply the lower emphasis variant suitable for surface backgrounds.

```tsx
import {Surface, TextArea} from "@heroui/react";

export function OnSurface() {
  return (
    <Surface className="w-full rounded-3xl p-6">
      <TextArea
        className="w-full min-w-[280px]"
        placeholder="Describe your product"
        variant="secondary"
      />
    </Surface>
  );
}

```

### Full Width

```tsx
import {TextArea} from "@heroui/react";

export function FullWidth() {
  return (
    <div className="w-[400px] space-y-3">
      <TextArea fullWidth placeholder="Full width textarea" />
    </div>
  );
}

```

### Controlled

```tsx
"use client";

import {Description, TextArea} from "@heroui/react";
import React from "react";

export function Controlled() {
  const [value, setValue] = React.useState("");

  return (
    <div className="flex w-96 flex-col gap-2">
      <TextArea
        aria-describedby="textarea-controlled-description"
        aria-label="Announcement"
        placeholder="Compose an announcement..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <Description id="textarea-controlled-description">
        Characters: {value.length} / 280
      </Description>
    </div>
  );
}

```

### Rows and Resizing

```tsx
import {Label, TextArea} from "@heroui/react";

export function Rows() {
  return (
    <div className="flex w-96 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="textarea-rows-3">Short feedback</Label>
        <TextArea
          aria-label="Short feedback"
          id="textarea-rows-3"
          placeholder="This week's highlights..."
          rows={3}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="textarea-rows-6">Detailed notes</Label>
        <TextArea
          aria-label="Detailed notes"
          id="textarea-rows-6"
          placeholder="Write out the full meeting notes..."
          rows={6}
          style={{resize: "vertical"}}
        />
      </div>
    </div>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {TextArea} from "@heroui/react";

const fieldClass =
  "rounded-xl border border-border/80 bg-surface shadow-sm ring-1 ring-black/5 transition-[box-shadow,border-color] focus-visible:ring-2 focus-visible:ring-neutral-400/25 dark:ring-white/10 dark:focus-visible:ring-neutral-500/30";

export function CustomStyles() {
  return (
    <TextArea
      aria-label="Notes"
      className={`h-28 w-full max-w-xs text-sm text-neutral-800 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500 ${fieldClass}`}
      placeholder="Add a note..."
    />
  );
}

```

### Global CSS

Override the shared `.textarea` class once with Tailwind's `@layer components`.

```css
@layer components {
  .textarea {
    @apply rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-6 shadow-sm;

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

* `.textarea` – Underlying `<textarea>` element styling

### Interactive States

* **Hover**: `:hover` or `[data-hovered="true"]`
* **Focus Visible**: `:focus-visible` or `[data-focus-visible="true"]`
* **Invalid**: `[data-invalid="true"]`
* **Disabled**: `:disabled` or `[aria-disabled="true"]`

## API Reference

### TextArea

TextArea accepts all standard HTML `<textarea>` attributes plus the following:

| Prop           | Type                                                      | Default     | Description                                                                                                                                                        |
| -------------- | --------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `className`    | `string`                                                  | -           | Tailwind classes merged with the base styles.                                                                                                                      |
| `rows`         | `number`                                                  | `3`         | Number of visible text lines.                                                                                                                                      |
| `cols`         | `number`                                                  | -           | Visible width of the text control.                                                                                                                                 |
| `value`        | `string`                                                  | -           | Controlled value for the textarea.                                                                                                                                 |
| `defaultValue` | `string`                                                  | -           | Initial uncontrolled value.                                                                                                                                        |
| `onChange`     | `(event: React.ChangeEvent<HTMLTextAreaElement>) => void` | -           | Change handler.                                                                                                                                                    |
| `placeholder`  | `string`                                                  | -           | Placeholder text.                                                                                                                                                  |
| `disabled`     | `boolean`                                                 | `false`     | Disables the textarea.                                                                                                                                             |
| `readOnly`     | `boolean`                                                 | `false`     | Makes the textarea read-only.                                                                                                                                      |
| `required`     | `boolean`                                                 | `false`     | Marks the textarea as required.                                                                                                                                    |
| `name`         | `string`                                                  | -           | Name for form submission.                                                                                                                                          |
| `autoComplete` | `string`                                                  | -           | Autocomplete hint for the browser.                                                                                                                                 |
| `maxLength`    | `number`                                                  | -           | Maximum number of characters.                                                                                                                                      |
| `minLength`    | `number`                                                  | -           | Minimum number of characters.                                                                                                                                      |
| `wrap`         | `'soft' \| 'hard'`                                        | -           | How text wraps when submitted.                                                                                                                                     |
| `fullWidth`    | `boolean`                                                 | `false`     | Whether the textarea should take full width of its container                                                                                                       |
| `variant`      | `"primary" \| "secondary"`                                | `"primary"` | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |

> For validation props like `isInvalid`, `isRequired`, and error handling, use **[TextField](/docs/react/components/text-field)** with TextArea as a child component.

## Related Showcases



## Related Components

## Related Components

* **TextField**: Composition-friendly fields with labels and validation
* **Input**: Single-line text input built on React Aria
* **Label**: Accessible label for form controls

</page>