<page url="/en/docs/react/components/skeleton">
# Skeleton

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/skeleton
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(feedback)/skeleton.mdx
> Skeleton is a placeholder to show a loading state and the expected shape of a component.


## Usage

```tsx
import { Skeleton } from '@heroui/react';

```

```tsx
import {Skeleton} from "@heroui/react";

export function Basic() {
  return (
    <div className="shadow-panel w-[250px] space-y-5 rounded-lg bg-transparent p-4">
      <Skeleton className="h-32 rounded-lg" />
      <div className="space-y-3">
        <Skeleton className="h-3 w-3/5 rounded-lg" />
        <Skeleton className="h-3 w-4/5 rounded-lg" />
        <Skeleton className="h-3 w-2/5 rounded-lg" />
      </div>
    </div>
  );
}

```

## Examples

### Text Content

```tsx
import {Skeleton} from "@heroui/react";

export function TextContent() {
  return (
    <div className="w-full max-w-md space-y-3">
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-5/6 rounded" />
      <Skeleton className="h-4 w-4/6 rounded" />
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-3/6 rounded" />
    </div>
  );
}

```

### User Profile

```tsx
import {Skeleton} from "@heroui/react";

export function UserProfile() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-36 rounded-lg" />
        <Skeleton className="h-3 w-24 rounded-lg" />
      </div>
    </div>
  );
}

```

### List Items

```tsx
import {Skeleton} from "@heroui/react";

export function List() {
  return (
    <div className="w-full max-w-sm space-y-4">
      {Array.from({length: 3}).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-4/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

```

### Grid

```tsx
import {Skeleton} from "@heroui/react";

export function Grid() {
  return (
    <div className="grid w-full max-w-xl grid-cols-3 gap-4">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}

```

### Single Shimmer

A synchronized shimmer effect that passes over all skeleton elements at once. Apply the `skeleton--shimmer` class to a parent container and set `animationType="none"` on child skeletons.

```tsx
import {Skeleton} from "@heroui/react";

export function SingleShimmer() {
  return (
    <div className="skeleton--shimmer relative grid w-full max-w-xl grid-cols-3 gap-4 overflow-hidden rounded-xl">
      <Skeleton animationType="none" className="h-24 rounded-xl" />
      <Skeleton animationType="none" className="h-24 rounded-xl" />
      <Skeleton animationType="none" className="h-24 rounded-xl" />
    </div>
  );
}

```

### Animation Types

```tsx
import {Skeleton} from "@heroui/react";

export function AnimationTypes() {
  return (
    <div className="grid w-full max-w-xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-2">
        <p className="truncate text-xs text-muted">Shimmer</p>
        <div className="shadow-panel space-y-3 rounded-lg bg-transparent p-4">
          <Skeleton animationType="shimmer" className="h-20 rounded-lg" />
          <Skeleton animationType="shimmer" className="h-3 w-3/5 rounded-lg" />
          <Skeleton animationType="shimmer" className="h-3 w-4/5 rounded-lg" />
        </div>
      </div>

      <div className="space-y-2">
        <p className="truncate text-xs text-muted">Pulse</p>
        <div className="shadow-panel space-y-3 rounded-lg bg-transparent p-4">
          <Skeleton animationType="pulse" className="h-20 rounded-lg" />
          <Skeleton animationType="pulse" className="h-3 w-3/5 rounded-lg" />
          <Skeleton animationType="pulse" className="h-3 w-4/5 rounded-lg" />
        </div>
      </div>

      <div className="space-y-2">
        <p className="truncate text-xs text-muted">None</p>
        <div className="shadow-panel space-y-3 rounded-lg bg-transparent p-4">
          <Skeleton animationType="none" className="h-20 rounded-lg" />
          <Skeleton animationType="none" className="h-3 w-3/5 rounded-lg" />
          <Skeleton animationType="none" className="h-3 w-4/5 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {Skeleton} from "@heroui/react";

const bone = "animate-shine rounded-lg bg-neutral-200/90 dark:bg-neutral-800/90";

export function CustomStyles() {
  return (
    <div className="w-[250px] space-y-5 rounded-xl border border-border/80 bg-surface p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
      <Skeleton className={`h-32 ${bone}`} />
      <div className="space-y-3">
        <Skeleton className={`h-3 w-3/5 ${bone}`} />
        <Skeleton className={`h-3 w-4/5 ${bone}`} />
        <Skeleton className={`h-3 w-2/5 ${bone}`} />
      </div>
    </div>
  );
}

```

### Global CSS

To customize the Skeleton component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  /* Base skeleton styles */
  .skeleton {
    @apply bg-surface-secondary/50; /* Change base background */
  }

  /* Shimmer animation gradient */
  .skeleton--shimmer:before {
    @apply viasurface; /* Change shimmer gradient color */
  }

  /* Pulse animation */
  .skeleton--pulse {
    @apply animate-pulse opacity-75; /* Customize pulse animation */
  }

  /* No animation variant */
  .skeleton--none {
    @apply opacity-50; /* Style for static skeleton */
  }
}

```

### Global Animation Configuration

You can set a default animation type for all Skeleton components in your application by defining the `--skeleton-animation` CSS variable:

```css
/* In your global CSS file */
:root {
  /* Possible values: shimmer, pulse, none */
  --skeleton-animation: pulse;
}

/* You can also set different values for light/dark themes */
.light, [data-theme="light"] {
  --skeleton-animation: shimmer;
}

.dark, [data-theme="dark"] {
  --skeleton-animation: pulse;
}

```

This global setting will be overridden by the `animationType` prop when specified on individual components.

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Skeleton component uses these CSS classes ([View source styles](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/skeleton.css)):

#### Base Class \[!toc]

`.skeleton` - Base skeleton styles with background and rounded corners

#### Animation Variant Classes \[!toc]

* `.skeleton--shimmer` - Adds shimmer animation with gradient effect (default)
* `.skeleton--pulse` - Adds pulse animation using Tailwind's animate-pulse
* `.skeleton--none` - No animation, static skeleton

### Animation

The Skeleton component supports three animation types, each with different visual effects:

#### Shimmer Animation \[!toc]

The shimmer effect creates a gradient that moves across the skeleton element:

```css
.skeleton--shimmer:before {
  @apply animate-skeleton via-surface-3 absolute inset-0 -translate-x-full
         bg-gradient-to-r from-transparent to-transparent content-[''];
}

```

The shimmer animation is defined in the theme using:

```css
@theme inline {
  --animate-skeleton: skeleton 2s linear infinite;

  @keyframes skeleton {
    100% {
      transform: translateX(200%);
    }
  }
}

```

#### Pulse Animation \[!toc]

The pulse animation uses Tailwind's built-in `animate-pulse` utility:

```css
.skeleton--pulse {
  @apply animate-pulse;
}

```

#### No Animation \[!toc]

For static skeletons without any animation:

```css
.skeleton--none {
  /* No animation styles applied */
}

```

## API Reference

### Skeleton

| Prop            | Type                             | Default                     | Description                                                                                             |
| --------------- | -------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `animationType` | `"shimmer" \| "pulse" \| "none"` | `"shimmer"` or CSS variable | The animation type for the skeleton. Can be globally configured via `--skeleton-animation` CSS variable |
| `className`     | `string`                         | -                           | Additional CSS classes                                                                                  |

## Related Components

## Related Components

* **Card**: Content container with header, body, and footer
* **Avatar**: Display user profile images

</page>