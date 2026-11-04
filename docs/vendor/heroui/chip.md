<page url="/en/docs/react/components/chip">
# Chip

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/chip
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(data-display)/chip.mdx
> Small informational badges for displaying labels, statuses, and categories


## Usage

```tsx
import { Chip } from '@heroui/react';

```

```tsx
import {Chip} from "@heroui/react";

export function ChipBasic() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Chip>Default</Chip>
      <Chip color="accent">Accent</Chip>
      <Chip color="success">Success</Chip>
      <Chip color="warning">Warning</Chip>
      <Chip color="danger">Danger</Chip>
    </div>
  );
}

```

## Anatomy

> Plain-text children are automatically wrapped in `<Chip.Label>`.

```tsx
<Chip>
  Label text
</Chip>

```

## Examples

### Variants

```tsx
import {CircleDashed} from "@gravity-ui/icons";
import {Chip, Separator} from "@heroui/react";
import React from "react";

export function ChipVariants() {
  const sizes = ["lg", "md", "sm"] as const;
  const variants = ["primary", "secondary", "tertiary", "soft"] as const;
  const colors = ["accent", "default", "success", "warning", "danger"] as const;

  return (
    <div className="flex flex-col gap-8 overflow-x-auto">
      {sizes.map((size, index) => (
        <React.Fragment key={size}>
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-muted capitalize">{size}</h3>
            {/* Color labels header */}
            <div className="flex items-center gap-3">
              <div className="w-24 shrink-0" />
              {colors.map((color) => (
                <div
                  key={color}
                  className="flex shrink-0 items-center justify-center"
                  style={{width: "130px"}}
                >
                  <span className="text-xs text-muted capitalize">{color}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {variants.map((variant) => (
                <div key={variant} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-sm text-muted capitalize">{variant}</div>
                  {colors.map((color) => (
                    <div
                      key={color}
                      className="flex shrink-0 items-center justify-center"
                      style={{width: "130px"}}
                    >
                      <Chip color={color} size={size} variant={variant}>
                        <CircleDashed />
                        <Chip.Label>Label</Chip.Label>
                        <CircleDashed />
                      </Chip>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {index < sizes.length - 1 && <Separator />}
        </React.Fragment>
      ))}
    </div>
  );
}

```

### Statuses

```tsx
import {Ban, Check, CircleFill, CircleInfo, TriangleExclamation} from "@gravity-ui/icons";
import {Chip} from "@heroui/react";

export function ChipStatuses() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Chip variant="primary">
          <CircleFill width={6} />
          <Chip.Label>Default</Chip.Label>
        </Chip>
        <Chip color="success" variant="primary">
          <CircleFill width={6} />
          <Chip.Label>Active</Chip.Label>
        </Chip>
        <Chip color="warning" variant="primary">
          <CircleFill width={6} />
          <Chip.Label>Pending</Chip.Label>
        </Chip>
        <Chip color="danger" variant="primary">
          <CircleFill width={6} />
          <Chip.Label>Inactive</Chip.Label>
        </Chip>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Chip>
          <CircleInfo width={12} />
          <Chip.Label>New Feature</Chip.Label>
        </Chip>
        <Chip color="success">
          <Check width={12} />
          <Chip.Label>Available</Chip.Label>
        </Chip>
        <Chip color="warning">
          <TriangleExclamation width={12} />
          <Chip.Label>Beta</Chip.Label>
        </Chip>
        <Chip color="danger">
          <Ban width={12} />
          <Chip.Label>Deprecated</Chip.Label>
        </Chip>
      </div>
    </div>
  );
}

```

### With Icons

```tsx
import {ChevronDown, CircleCheckFill, CircleFill, Clock, Xmark} from "@gravity-ui/icons";
import {Chip} from "@heroui/react";

export function ChipWithIcon() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Chip>
        <CircleFill width={6} />
        <Chip.Label>Information</Chip.Label>
      </Chip>
      <Chip color="success">
        <CircleCheckFill width={12} />
        <Chip.Label>Completed</Chip.Label>
      </Chip>
      <Chip color="warning">
        <Clock width={12} />
        <Chip.Label>Pending</Chip.Label>
      </Chip>
      <Chip color="danger">
        <Xmark width={12} />
        <Chip.Label>Failed</Chip.Label>
      </Chip>
      <Chip color="accent">
        <Chip.Label>Label</Chip.Label>
        <ChevronDown width={12} />
      </Chip>
    </div>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {Chip} from "@heroui/react";

export function CustomStyles() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip className="rounded-full bg-default-soft px-3 text-default-soft-foreground">Draft</Chip>
      <Chip className="rounded-full bg-warning-soft px-3 text-warning-soft-foreground">
        In review
      </Chip>
      <Chip className="rounded-full bg-success-soft px-3 text-success-soft-foreground">
        Published
      </Chip>
    </div>
  );
}

```

### Global CSS

To customize the Chip component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .chip {
    @apply rounded-full text-xs;
  }

  .chip__label {
    @apply font-medium;
  }

  .chip--accent {
    @apply border-accent/20;
  }

  .chip--accent .chip__label {
    @apply text-accent;
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Chip component uses these CSS classes ([View source styles](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/chip.css)):

#### Base Classes \[!toc]

* `.chip` - Base chip container styles
* `.chip__label` - Label text slot styles

#### Color Classes \[!toc]

* `.chip--accent` - Accent color variant
* `.chip--danger` - Danger color variant
* `.chip--default` - Default color variant
* `.chip--success` - Success color variant
* `.chip--warning` - Warning color variant

#### Variant Classes \[!toc]

* `.chip--primary` - Primary variant with filled background
* `.chip--secondary` - Secondary variant with border
* `.chip--tertiary` - Tertiary variant with transparent background
* `.chip--soft` - Soft variant with lighter background

#### Size Classes \[!toc]

* `.chip--sm` - Small size
* `.chip--md` - Medium size (default)
* `.chip--lg` - Large size

#### Compound Variant Classes \[!toc]

Chips support combining variant and color classes (e.g., `.chip--secondary.chip--accent`). The following combinations have default styles defined:

**Primary Variants:**

* `.chip--primary.chip--accent` - Primary accent combination with filled background
* `.chip--primary.chip--success` - Primary success combination with filled background
* `.chip--primary.chip--warning` - Primary warning combination with filled background
* `.chip--primary.chip--danger` - Primary danger combination with filled background

**Soft Variants:**

* `.chip--accent.chip--soft` - Soft accent combination with lighter background
* `.chip--success.chip--soft` - Soft success combination with lighter background
* `.chip--warning.chip--soft` - Soft warning combination with lighter background
* `.chip--danger.chip--soft` - Soft danger combination with lighter background

**Note:** You can apply custom styles to any variant-color combination (e.g., `.chip--secondary.chip--accent`, `.chip--tertiary.chip--success`) using the `@layer components` directive in your CSS.

## API Reference

### Chip

| Prop        | Type                                                          | Default       | Description                                 |
| ----------- | ------------------------------------------------------------- | ------------- | ------------------------------------------- |
| `children`  | `React.ReactNode`                                             | -             | Content to display inside the chip          |
| `className` | `string`                                                      | -             | Additional CSS classes for the root element |
| `color`     | `"default" \| "accent" \| "success" \| "warning" \| "danger"` | `"default"`   | Color variant of the chip                   |
| `variant`   | `"primary" \| "secondary" \| "tertiary" \| "soft"`            | `"secondary"` | Visual style variant                        |
| `size`      | `"sm" \| "md" \| "lg"`                                        | `"md"`        | Size of the chip                            |

### Chip.Label

| Prop        | Type              | Default | Description                               |
| ----------- | ----------------- | ------- | ----------------------------------------- |
| `children`  | `React.ReactNode` | -       | Label text content                        |
| `className` | `string`          | -       | Additional CSS classes for the label slot |

## Related Components

## Related Components

* **Avatar**: Display user profile images
* **CloseButton**: Button for dismissing overlays
* **Separator**: Visual divider between content

</page>