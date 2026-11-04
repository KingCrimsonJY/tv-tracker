<page url="/en/docs/react/components/description">
# Description

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/description
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(forms)/description.mdx
> Provides supplementary text for form fields and other components


## Usage

```tsx
import { Description } from '@heroui/react';

```

```tsx
import {Description, Input, Label} from "@heroui/react";

export function Basic() {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="email">Email</Label>
      <Input
        aria-describedby="email-description"
        className="w-64"
        id="email"
        placeholder="you@example.com"
        type="email"
      />
      <Description id="email-description">
        We'll never share your email with anyone else.
      </Description>
    </div>
  );
}

```

## Examples

### With Form Fields

```tsx
<div className="flex flex-col gap-1">
  <Label htmlFor="password">Password</Label>
  <Input id="password" type="password" aria-describedby="password-description" />
  <Description id="password-description">
    Must be at least 8 characters with one uppercase letter
  </Description>
</div>

```

### Integration with TextField

```tsx
import {TextField, Label, Input, Description} from '@heroui/react';

<TextField type="email">
  <Label>Email</Label>
  <Input placeholder="Enter your email" />
  <Description>We'll never share your email</Description>
</TextField>

```

When using the [TextField](./text-field) component, accessibility attributes are automatically applied to the label and description.

## Customization

### Tailwind CSS

```tsx
import {Description, Input, Label} from "@heroui/react";

export function CustomStyles() {
  return (
    <div className="flex w-64 flex-col gap-1">
      <Label htmlFor="workspace-slug">Workspace URL</Label>
      <Input id="workspace-slug" placeholder="acme" type="text" />
      <Description className="leading-relaxed tracking-wide" id="workspace-slug-hint">
        Lowercase letters and hyphens only. Used in app.heroui.com/acme
      </Description>
    </div>
  );
}

```

### Global CSS

To customize the Description component classes, you can use the `@layer components` directive. [Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .description {
    @apply text-muted;
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Description component uses these CSS classes ([View source styles](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/description.css)):

#### Base Classes \[!toc]

* `.description` - Base description styles with `muted` text color

## API Reference

### Description

| Prop        | Type        | Default | Description                    |
| ----------- | ----------- | ------- | ------------------------------ |
| `className` | `string`    | -       | Additional CSS classes         |
| `children`  | `ReactNode` | -       | The content of the description |

## Accessibility

The Description component enhances accessibility by:

* Using semantic HTML that screen readers can identify
* Providing the `slot="description"` attribute for React Aria integration
* Supporting proper text contrast ratios

## Related Components

## Related Components

* **TextField**: Composition-friendly fields with labels and validation
* **Input**: Single-line text input built on React Aria
* **TextArea**: Multiline text input with focus management

</page>