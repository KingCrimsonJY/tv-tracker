<page url="/en/docs/react/components/spinner">
# Spinner

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/spinner
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(feedback)/spinner.mdx
> A loading indicator component to show pending states


## Usage

```tsx
import { Spinner } from '@heroui/react';

```

```tsx
import {Spinner} from "@heroui/react";

export function SpinnerBasic() {
  return (
    <div className="flex items-center gap-4">
      <Spinner />
    </div>
  );
}

```

## Examples

### Colors

```tsx
import {Spinner} from "@heroui/react";

export function SpinnerColors() {
  return (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <Spinner color="current" />
        <span className="text-xs text-muted">Current</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner color="accent" />
        <span className="text-xs text-muted">Accent</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner color="success" />
        <span className="text-xs text-muted">Success</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner color="warning" />
        <span className="text-xs text-muted">Warning</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner color="danger" />
        <span className="text-xs text-muted">Danger</span>
      </div>
    </div>
  );
}

```

### Sizes

```tsx
import {Spinner} from "@heroui/react";

export function SpinnerSizes() {
  return (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <Spinner size="sm" />
        <span className="text-xs text-muted">Small</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner size="md" />
        <span className="text-xs text-muted">Medium</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner size="lg" />
        <span className="text-xs text-muted">Large</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner size="xl" />
        <span className="text-xs text-muted">Extra Large</span>
      </div>
    </div>
  );
}

```

### Speed

Apply an animation utility to change how fast a single spinner rotates. Pair it with
`motion-reduce:animate-none` so it stays still for users who prefer reduced motion.

```tsx
import {Spinner} from "@heroui/react";

export function SpinnerSpeed() {
  return (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <Spinner className="animate-[spin_1.5s_linear_infinite] motion-reduce:animate-none" />
        <span className="text-xs text-muted">Slow</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner />
        <span className="text-xs text-muted">Default</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner className="animate-[spin_0.4s_linear_infinite] motion-reduce:animate-none" />
        <span className="text-xs text-muted">Fast</span>
      </div>
    </div>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {Spinner} from "@heroui/react";

export function CustomStyles() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4">
      <Spinner className="text-accent" size="sm" />
      <Spinner className="text-muted" size="md" />
      <Spinner className="text-success" size="lg" />
    </div>
  );
}

```

### Global CSS

To customize the Spinner component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .spinner {
    @apply animate-spin;
  }

  .spinner--accent {
    color: var(--accent);
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Spinner component uses these CSS classes ([View source styles](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/spinner.css)):

#### Base & Size Classes \[!toc]

* `.spinner` - Base spinner styles with default size
* `.spinner--sm` - Small size variant
* `.spinner--md` - Medium size variant (default)
* `.spinner--lg` - Large size variant
* `.spinner--xl` - Extra large size variant

#### Color Classes \[!toc]

* `.spinner--current` - Inherits current text color
* `.spinner--accent` - Accent color variant
* `.spinner--danger` - Danger color variant
* `.spinner--success` - Success color variant
* `.spinner--warning` - Warning color variant

## API Reference

### Spinner

| Prop        | Type                                                          | Default    | Description                  |
| ----------- | ------------------------------------------------------------- | ---------- | ---------------------------- |
| `size`      | `"sm" \| "md" \| "lg" \| "xl"`                                | `"md"`     | Size of the spinner          |
| `color`     | `"current" \| "accent" \| "success" \| "warning" \| "danger"` | `"accent"` | Color variant of the spinner |
| `className` | `string`                                                      | -          | Additional CSS classes       |

## Related Components

</page>