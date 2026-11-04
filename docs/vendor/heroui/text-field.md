<page url="/en/docs/react/components/text-field">
# TextField

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/text-field
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(forms)/text-field.mdx
> Composition-friendly text fields with labels, descriptions, and inline validation


## Usage

```tsx
import { TextField } from '@heroui/react';

```

```tsx
import {Input, Label, TextField} from "@heroui/react";

export function Basic() {
  return (
    <TextField className="w-full max-w-64" name="email" type="email">
      <Label>Email</Label>
      <Input placeholder="Enter your email" />
    </TextField>
  );
}

```

## Anatomy

```tsx
import {TextField, Label, Input, Description, FieldError} from '@heroui/react';

export default () => (
  <TextField>
    <Label />
    <Input />
    <Description />
    <FieldError />
  </TextField>
)

```

> **TextField** combines label, input, description, and error into a single accessible component.
> For standalone inputs, use **[Input](/docs/react/components/input)** or **[TextArea](/docs/react/components/text-area)**.

## Examples

### In Surface

When used inside a [Surface](/docs/react/components/surface) component, use `variant="secondary"` on Input or TextArea components to apply the lower emphasis variant suitable for surface backgrounds.

```tsx
import {Description, Input, Label, Surface, TextArea, TextField} from "@heroui/react";

export function OnSurface() {
  return (
    <Surface className="flex w-full min-w-[340px] flex-col gap-4 rounded-3xl p-6">
      <TextField name="name" variant="secondary">
        <Label>Your name</Label>
        <Input className="w-full" placeholder="John" />
        <Description>We'll never share this with anyone else</Description>
      </TextField>
      <TextField name="email" type="email" variant="secondary">
        <Label>Email</Label>
        <Input className="w-full" placeholder="john@example.com" />
      </TextField>
      <TextField name="bio" variant="secondary">
        <Label>Bio</Label>
        <TextArea className="w-full" placeholder="Tell us about yourself..." rows={4} />
        <Description>Minimum 4 rows</Description>
      </TextField>
    </Surface>
  );
}

```

### With Description

```tsx
import {Description, Input, Label, TextField} from "@heroui/react";

export function WithDescription() {
  return (
    <TextField className="w-full max-w-64" name="username">
      <Label>Username</Label>
      <Input placeholder="Enter username" />
      <Description>Choose a unique username for your account</Description>
    </TextField>
  );
}

```

### Required Field

```tsx
import {Description, Input, Label, TextField} from "@heroui/react";

export function Required() {
  return (
    <TextField isRequired className="w-full max-w-64" name="fullName">
      <Label>Full Name</Label>
      <Input placeholder="John Doe" />
      <Description>This field is required</Description>
    </TextField>
  );
}

```

### Disabled State

```tsx
import {Description, Input, Label, TextField} from "@heroui/react";

export function Disabled() {
  return (
    <TextField isDisabled className="w-full max-w-64" name="accountId" value="USR-12345">
      <Label>Account ID</Label>
      <Input placeholder="Auto-generated" />
      <Description>This field cannot be edited</Description>
    </TextField>
  );
}

```

### Full Width

```tsx
import {FieldError, Input, Label, TextField} from "@heroui/react";

export function FullWidth() {
  return (
    <div className="w-[400px] space-y-4">
      <TextField fullWidth name="name">
        <Label>Your name</Label>
        <Input placeholder="John" />
      </TextField>
      <TextField fullWidth isInvalid isRequired name="password" type="password">
        <Label>Password</Label>
        <Input />
        <FieldError>Password must be longer than 8 characters</FieldError>
      </TextField>
    </div>
  );
}

```

### Validation

Use `isInvalid` together with `FieldError` to surface validation messages.

```tsx
"use client";

import {Description, FieldError, Input, Label, TextArea, TextField} from "@heroui/react";
import React from "react";

export function Validation() {
  const [username, setUsername] = React.useState("");
  const [bio, setBio] = React.useState("");

  const isUsernameInvalid = username.length > 0 && username.length < 3;
  const isBioInvalid = bio.length > 0 && bio.length < 20;

  return (
    <div className="flex w-full max-w-64 flex-col gap-4">
      <TextField
        isRequired
        isInvalid={isUsernameInvalid}
        name="username"
        value={username}
        onChange={setUsername}
      >
        <Label>Username</Label>
        <Input placeholder="jane_doe" />
        {isUsernameInvalid ? (
          <FieldError>Username must be at least 3 characters.</FieldError>
        ) : (
          <Description>Choose a unique username for your profile.</Description>
        )}
      </TextField>

      <TextField isRequired isInvalid={isBioInvalid} name="bio" value={bio} onChange={setBio}>
        <Label>Bio</Label>
        <TextArea placeholder="Tell us about yourself..." />
        {isBioInvalid ? (
          <FieldError>Bio must contain at least 20 characters.</FieldError>
        ) : (
          <Description>Minimum 20 characters ({bio.length}/20).</Description>
        )}
      </TextField>
    </div>
  );
}

```

### Controlled

Control the value to synchronize counters, previews, or formatting.

```tsx
"use client";

import {Description, Input, Label, TextArea, TextField} from "@heroui/react";
import React from "react";

export function Controlled() {
  const [name, setName] = React.useState("");
  const [bio, setBio] = React.useState("");

  return (
    <div className="flex w-full max-w-64 flex-col gap-4">
      <TextField name="name" value={name} onChange={setName}>
        <Label>Display name</Label>
        <Input placeholder="Jane" />
        <Description>Characters: {name.length}</Description>
      </TextField>
      <TextField name="bio" value={bio} onChange={setBio}>
        <Label>Bio</Label>
        <TextArea placeholder="Tell us about yourself..." />
        <Description>Characters: {bio.length} / 200</Description>
      </TextField>
    </div>
  );
}

```

### Error Message

```tsx
import {FieldError, Input, Label, TextField} from "@heroui/react";

export function WithError() {
  return (
    <TextField isInvalid className="w-full max-w-64" name="email" type="email">
      <Label>Email</Label>
      <Input placeholder="user@example.com" />
      <FieldError>Please enter a valid email address</FieldError>
    </TextField>
  );
}

```

### TextArea

Use [TextArea](/docs/react/components/text-area) instead of [Input](/docs/react/components/input) for multiline content.

```tsx
import {Description, Label, TextArea, TextField} from "@heroui/react";

export function TextAreaExample() {
  return (
    <TextField className="w-full max-w-64" name="message">
      <Label>Message</Label>
      <TextArea placeholder="Write your message here..." rows={4} />
      <Description>Maximum 500 characters</Description>
    </TextField>
  );
}

```

### Input Types

```tsx
import {Input, Label, TextField} from "@heroui/react";

export function InputTypes() {
  return (
    <div className="flex w-full max-w-64 flex-col gap-4">
      <TextField name="password" type="password">
        <Label>Password</Label>
        <Input placeholder="••••••••" />
      </TextField>

      <TextField name="age" type="number">
        <Label>Age</Label>
        <Input max="150" min="0" placeholder="21" />
      </TextField>

      <TextField name="email" type="email">
        <Label>Email</Label>
        <Input placeholder="user@example.com" />
      </TextField>

      <TextField name="website" type="url">
        <Label>Website</Label>
        <Input placeholder="https://example.com" />
      </TextField>

      <TextField name="phone" type="tel">
        <Label>Phone</Label>
        <Input placeholder="+1 (555) 000-0000" />
      </TextField>
    </div>
  );
}

```

### Render Function

```tsx
"use client";

import {Input, Label, TextField} from "@heroui/react";

export function RenderFunction() {
  return (
    <TextField
      className="w-full max-w-64"
      name="email"
      render={(props) => <div {...props} data-custom="foo" />}
      type="email"
    >
      <Label>Email</Label>
      <Input placeholder="Enter your email" />
    </TextField>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {Input, Label, TextField} from "@heroui/react";

const fieldClass =
  "rounded-xl border border-border/80 bg-surface shadow-sm ring-1 ring-black/5 transition-[box-shadow,border-color] focus-visible:ring-2 focus-visible:ring-neutral-400/25 dark:ring-white/10 dark:focus-visible:ring-neutral-500/30";

export function CustomStyles() {
  return (
    <TextField className="w-full max-w-64 gap-1.5" name="email" type="email">
      <Label className="font-medium text-neutral-800 dark:text-neutral-100">Email</Label>
      <Input
        className={`text-sm text-neutral-800 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500 ${fieldClass}`}
        placeholder="you@email.com"
      />
    </TextField>
  );
}

```

### Global CSS

TextField has minimal default styling. Override the `.textfield` class to customize the container styling.

```css
@layer components {
  .textfield {
    @apply flex flex-col gap-1;
  }

  /* When invalid, the description is hidden automatically */
  .textfield[data-invalid="true"] [data-slot="description"],
  .textfield[aria-invalid="true"] [data-slot="description"] {
    @apply hidden;
  }

  /* Description has default padding */
  .textfield [data-slot="description"] {
    @apply px-1;
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

* `.textfield` – Root container with minimal styling (`flex flex-col gap-1`)

> **Note:** Child components ([Label](/docs/react/components/label), [Input](/docs/react/components/input), [TextArea](/docs/react/components/text-area), [Description](/docs/react/components/description), [FieldError](/docs/react/components/field-error)) have their own CSS classes and styling. See their respective documentation for customization options.

### Interactive States

TextField automatically manages these data attributes based on its state:

* **Invalid**: `[data-invalid="true"]` or `[aria-invalid="true"]` - Automatically hides the description slot when invalid
* **Disabled**: `[data-disabled="true"]` - Applied when `isDisabled` is true
* **Focus Within**: `[data-focus-within="true"]` - Applied when any child input is focused
* **Focus Visible**: `[data-focus-visible="true"]` - Applied when focus is visible (keyboard navigation)

Additional attributes are available through render props (see TextFieldRenderProps below).

## API Reference

### TextField

TextField inherits all props from React Aria's [TextField](https://react-spectrum.adobe.com/react-aria/TextField.html) component.

#### Base Props

| Prop        | Type                                                                           | Default | Description                                                      |
| ----------- | ------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------- |
| `children`  | `React.ReactNode \| (values: TextFieldRenderProps) => React.ReactNode`         | -       | Child components (Label, Input, etc.) or render function.        |
| `className` | `string \| (values: TextFieldRenderProps) => string`                           | -       | CSS classes for styling, supports render props.                  |
| `style`     | `React.CSSProperties \| (values: TextFieldRenderProps) => React.CSSProperties` | -       | Inline styles, supports render props.                            |
| `fullWidth` | `boolean`                                                                      | `false` | Whether the text field should take full width of its container   |
| `id`        | `string`                                                                       | -       | The element's unique identifier.                                 |
| `render`    | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, TextFieldRenderProps>`   | -       | Overrides the default DOM element with a custom render function. |

#### Validation Props

| Prop                 | Type                                                              | Default    | Description                                                    |
| -------------------- | ----------------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| `isRequired`         | `boolean`                                                         | `false`    | Whether user input is required before form submission.         |
| `isInvalid`          | `boolean`                                                         | -          | Whether the value is invalid.                                  |
| `validate`           | `(value: string) => ValidationError \| true \| null \| undefined` | -          | Custom validation function.                                    |
| `validationBehavior` | `'native' \| 'aria'`                                              | `'native'` | Whether to use native HTML form validation or ARIA attributes. |
| `validationErrors`   | `string[]`                                                        | -          | Server-side validation errors.                                 |

#### Value Props

| Prop           | Type                      | Default | Description                            |
| -------------- | ------------------------- | ------- | -------------------------------------- |
| `value`        | `string`                  | -       | Current value (controlled).            |
| `defaultValue` | `string`                  | -       | Default value (uncontrolled).          |
| `onChange`     | `(value: string) => void` | -       | Handler called when the value changes. |

#### State Props

| Prop         | Type      | Default | Description                                        |
| ------------ | --------- | ------- | -------------------------------------------------- |
| `isDisabled` | `boolean` | -       | Whether the input is disabled.                     |
| `isReadOnly` | `boolean` | -       | Whether the input can be selected but not changed. |

#### Form Props

| Prop        | Type      | Default | Description                                          |
| ----------- | --------- | ------- | ---------------------------------------------------- |
| `name`      | `string`  | -       | Name of the input element, for HTML form submission. |
| `autoFocus` | `boolean` | -       | Whether the element should receive focus on render.  |

#### Accessibility Props

| Prop               | Type     | Default | Description                                           |
| ------------------ | -------- | ------- | ----------------------------------------------------- |
| `aria-label`       | `string` | -       | Accessibility label when no visible label is present. |
| `aria-labelledby`  | `string` | -       | ID of elements that label this field.                 |
| `aria-describedby` | `string` | -       | ID of elements that describe this field.              |
| `aria-details`     | `string` | -       | ID of elements with additional details.               |

### Composition Components

TextField works with these separate components that should be imported and used directly:

* **Label** - Field label component from `@heroui/react`
* **Input** - Single-line text input from `@heroui/react`
* **TextArea** - Multi-line text input from `@heroui/react`
* **Description** - Helper text component from `@heroui/react`
* **FieldError** - Validation error message from `@heroui/react`

Each of these components has its own props API. Use them directly within TextField for composition:

```tsx
<TextField isRequired isInvalid={hasError}>
  <Label>Email Address</Label>
  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
  <Description>We'll never share your email.</Description>
  <FieldError>Please enter a valid email address.</FieldError>
</TextField>

```

### Render Props

When using render props with `className`, `style`, or `children`, these values are available:

| Prop             | Type      | Description                                                                |
| ---------------- | --------- | -------------------------------------------------------------------------- |
| `isDisabled`     | `boolean` | Whether the field is disabled.                                             |
| `isInvalid`      | `boolean` | Whether the field is currently invalid.                                    |
| `isReadOnly`     | `boolean` | Whether the field is read-only.                                            |
| `isRequired`     | `boolean` | Whether the field is required.                                             |
| `isFocused`      | `boolean` | Whether the field is currently focused (DEPRECATED - use `isFocusWithin`). |
| `isFocusWithin`  | `boolean` | Whether any child element is focused.                                      |
| `isFocusVisible` | `boolean` | Whether focus is visible (keyboard navigation).                            |

## Related Showcases



## Related Components

## Related Components

* **Input**: Single-line text input built on React Aria
* **TextArea**: Multiline text input with focus management
* **Fieldset**: Group related form controls with legends

</page>