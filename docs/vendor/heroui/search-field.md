<page url="/en/docs/react/components/search-field">
# SearchField

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/search-field
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(forms)/search-field.mdx
> Search input field with clear button and search icon


## Usage

```tsx
import { SearchField } from '@heroui/react';

```

```tsx
import {Label, SearchField} from "@heroui/react";

export function Basic() {
  return (
    <SearchField name="search">
      <Label>Search</Label>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input className="w-[280px]" placeholder="Search..." />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}

```

## Anatomy

```tsx
import {SearchField, Label, Description, FieldError} from '@heroui/react';

export default () => (
  <SearchField>
    <Label />
    <SearchField.Group>
      <SearchField.SearchIcon />
      <SearchField.Input />
      <SearchField.ClearButton />
    </SearchField.Group>
    <Description />
    <FieldError />
  </SearchField>
)

```

> **SearchField** allows users to enter and clear a search query. It includes a search icon and an optional clear button for easy reset.

## Examples

### Variants

The SearchField component supports two visual variants:

* **`primary`** (default) - Standard styling with shadow, suitable for most use cases
* **`secondary`** - Lower emphasis variant without shadow, suitable for use in Surface components

```tsx
import {Label, SearchField} from "@heroui/react";

export function Variants() {
  return (
    <div className="flex flex-col gap-4">
      <SearchField name="primary-search" variant="primary">
        <Label>Primary variant</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input className="w-[280px]" placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <SearchField name="secondary-search" variant="secondary">
        <Label>Secondary variant</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input className="w-[280px]" placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
    </div>
  );
}

```

### In Surface

When used inside a [Surface](/docs/react/components/surface) component, use `variant="secondary"` to apply the lower emphasis variant suitable for surface backgrounds.

```tsx
import {Description, Label, SearchField, Surface} from "@heroui/react";

export function OnSurface() {
  return (
    <Surface className="flex w-full max-w-sm flex-col gap-4 rounded-3xl p-6">
      <SearchField name="search" variant="secondary">
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input className="w-full" placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <Description>Enter keywords to search</Description>
      </SearchField>
      <SearchField name="search-2" variant="secondary">
        <Label>Advanced search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input className="w-full" placeholder="Advanced search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <Description>Use filters to refine your search</Description>
      </SearchField>
    </Surface>
  );
}

```

### With Description

```tsx
import {Description, Label, SearchField} from "@heroui/react";

export function WithDescription() {
  return (
    <div className="flex flex-col gap-4">
      <SearchField name="search">
        <Label>Search products</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input className="w-[280px]" placeholder="Search products..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <Description>Enter keywords to search for products</Description>
      </SearchField>
      <SearchField name="search-users">
        <Label>Search users</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input className="w-[280px]" placeholder="Search users..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <Description>Search by name, email, or username</Description>
      </SearchField>
    </div>
  );
}

```

### Required Field

```tsx
import {Description, Label, SearchField} from "@heroui/react";

export function Required() {
  return (
    <div className="flex flex-col gap-4">
      <SearchField isRequired name="search">
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input className="w-[280px]" placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <SearchField isRequired name="search-query">
        <Label>Search query</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input className="w-[280px]" placeholder="Enter search query..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <Description>Minimum 3 characters required</Description>
      </SearchField>
    </div>
  );
}

```

### Disabled State

```tsx
import {Description, Label, SearchField} from "@heroui/react";

export function Disabled() {
  return (
    <div className="flex flex-col gap-4">
      <SearchField isDisabled name="search" value="Disabled search">
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input className="w-[280px]" placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <Description>This search field is disabled</Description>
      </SearchField>
      <SearchField isDisabled name="search-empty">
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input className="w-[280px]" placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <Description>This search field is disabled</Description>
      </SearchField>
    </div>
  );
}

```

### Full Width

```tsx
import {Label, SearchField} from "@heroui/react";

export function FullWidth() {
  return (
    <div className="w-[400px] space-y-4">
      <SearchField fullWidth name="search">
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
    </div>
  );
}

```

### Validation

Use `isInvalid` together with `FieldError` to surface validation messages.

```tsx
import {FieldError, Label, SearchField} from "@heroui/react";

export function Validation() {
  return (
    <div className="flex flex-col gap-4">
      <SearchField isInvalid isRequired name="search" value="ab">
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input className="w-[280px]" placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <FieldError>Search query must be at least 3 characters</FieldError>
      </SearchField>
      <SearchField isInvalid name="search-invalid">
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input className="w-[280px]" placeholder="Search..." value="invalid@query" />
          <SearchField.ClearButton />
        </SearchField.Group>
        <FieldError>Invalid characters in search query</FieldError>
      </SearchField>
    </div>
  );
}

```

### Controlled

Control the value to synchronize with other components or perform custom formatting.

```tsx
"use client";

import {Button, Description, Label, SearchField} from "@heroui/react";
import React from "react";

export function Controlled() {
  const [value, setValue] = React.useState("");

  return (
    <div className="flex flex-col gap-4">
      <SearchField name="search" value={value} onChange={setValue}>
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input className="w-[280px]" placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        <Description>Current value: {value || "(empty)"}</Description>
      </SearchField>
      <div className="flex gap-2">
        <Button variant="tertiary" onPress={() => setValue("")}>
          Clear
        </Button>
        <Button variant="tertiary" onPress={() => setValue("example query")}>
          Set example
        </Button>
      </div>
    </div>
  );
}

```

### Form Example

Complete form integration with validation and submission handling.

```tsx
"use client";

import {Button, Description, FieldError, Form, Label, SearchField, Spinner} from "@heroui/react";
import React from "react";

export function FormExample() {
  const [value, setValue] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const MIN_LENGTH = 3;
  const isInvalid = value.length > 0 && value.length < MIN_LENGTH;

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (value.length < MIN_LENGTH) {
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      console.log("Search submitted:", {query: value});
      setValue("");
      setIsSubmitting(false);
    }, 1500);
  };

  return (
    <Form className="flex w-[280px] flex-col gap-4" onSubmit={handleSubmit}>
      <SearchField isRequired isInvalid={isInvalid} name="search" value={value} onChange={setValue}>
        <Label>Search products</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input className="w-full" placeholder="Search products..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        {isInvalid ? (
          <FieldError>Search query must be at least {MIN_LENGTH} characters</FieldError>
        ) : (
          <Description>Enter at least {MIN_LENGTH} characters to search</Description>
        )}
      </SearchField>
      <Button
        className="w-full"
        isDisabled={value.length < MIN_LENGTH}
        isPending={isSubmitting}
        type="submit"
        variant="primary"
      >
        {isSubmitting ? (
          <>
            <Spinner color="current" size="sm" />
            Searching...
          </>
        ) : (
          "Search"
        )}
      </Button>
    </Form>
  );
}

```

### With Validation

Implement custom validation logic with controlled values.

```tsx
"use client";

import {Description, FieldError, Label, SearchField} from "@heroui/react";
import React from "react";

export function WithValidation() {
  const [value, setValue] = React.useState("");
  const isInvalid = value.length > 0 && value.length < 3;

  return (
    <div className="flex flex-col gap-4">
      <SearchField isRequired isInvalid={isInvalid} name="search" value={value} onChange={setValue}>
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input className="w-[280px]" placeholder="Search..." />
          <SearchField.ClearButton />
        </SearchField.Group>
        {isInvalid ? (
          <FieldError>Search query must be at least 3 characters</FieldError>
        ) : (
          <Description>Enter at least 3 characters to search</Description>
        )}
      </SearchField>
    </div>
  );
}

```

### Custom Icons

Customize the search icon and clear button icons.

```tsx
import {Description, Label, SearchField} from "@heroui/react";

export function CustomIcons() {
  return (
    <div className="flex flex-col gap-4">
      <SearchField name="search-custom">
        <Label>Search (Custom Icons)</Label>
        <SearchField.Group>
          <SearchField.SearchIcon>
            <svg height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
              <path
                clipRule="evenodd"
                d="M12.5 4c0 .174-.071.513-.885.888S9.538 5.5 8 5.5s-2.799-.237-3.615-.612C3.57 4.513 3.5 4.174 3.5 4s.071-.513.885-.888S6.462 2.5 8 2.5s2.799.237 3.615.612c.814.375.885.714.885.888m-1.448 2.66C10.158 6.888 9.115 7 8 7s-2.158-.113-3.052-.34l1.98 2.905c.21.308.322.672.322 1.044v3.37q.088.02.25.021c.422 0 .749-.14.95-.316c.185-.162.3-.38.3-.684v-2.39c0-.373.112-.737.322-1.045zM8 1c3.314 0 6 1 6 3a3.24 3.24 0 0 1-.563 1.826l-3.125 4.584a.35.35 0 0 0-.062.2V13c0 1.5-1.25 2.5-2.75 2.5s-1.75-1-1.75-1v-3.89a.35.35 0 0 0-.061-.2L2.563 5.826A3.24 3.24 0 0 1 2 4c0-2 2.686-3 6-3m-.88 12.936q-.015-.008-.013-.01z"
                fill="currentColor"
                fillRule="evenodd"
              />
            </svg>
          </SearchField.SearchIcon>
          <SearchField.Input className="w-[280px]" placeholder="Search..." />
          <SearchField.ClearButton>
            <svg height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
              <path
                clipRule="evenodd"
                d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14M6.53 5.47a.75.75 0 0 0-1.06 1.06L6.94 8L5.47 9.47a.75.75 0 1 0 1.06 1.06L8 9.06l1.47 1.47a.75.75 0 1 0 1.06-1.06L9.06 8l1.47-1.47a.75.75 0 1 0-1.06-1.06L8 6.94z"
                fill="currentColor"
                fillRule="evenodd"
              />
            </svg>
          </SearchField.ClearButton>
        </SearchField.Group>
        <Description>Custom icon children</Description>
      </SearchField>
    </div>
  );
}

```

### With Keyboard Shortcut

Add keyboard shortcuts to quickly focus the search field.

```tsx
"use client";

import {Description, Kbd, Label, SearchField} from "@heroui/react";
import React from "react";

export function WithKeyboardShortcut() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Shift+S
      if (e.shiftKey && e.key === "S" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Check for ESC key to blur the input
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };

    // Add global event listener
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SearchField name="search" value={value} onChange={setValue}>
          <Label>Search</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input ref={inputRef} className="w-[280px]" placeholder="Search..." />
            <SearchField.ClearButton />
          </SearchField.Group>
          <Description>Use keyboard shortcut to quickly focus this field</Description>
        </SearchField>
      </div>
      <div className="text-default-500 flex items-center gap-2 text-sm">
        <span>Press</span>
        <Kbd>
          <Kbd.Abbr keyValue="shift" />
          <Kbd.Content>S</Kbd.Content>
        </Kbd>
        <span>to focus the search field</span>
      </div>
    </div>
  );
}

```

### Render Function

```tsx
"use client";

import {Label, SearchField} from "@heroui/react";

export function RenderFunction() {
  return (
    <SearchField name="search" render={(props) => <div {...props} data-custom="foo" />}>
      <Label>Search</Label>
      <SearchField.Group>
        <SearchField.SearchIcon />
        <SearchField.Input className="w-[280px]" placeholder="Search..." />
        <SearchField.ClearButton />
      </SearchField.Group>
    </SearchField>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {Label, SearchField} from "@heroui/react";

export function CustomStyles() {
  return (
    <SearchField className="w-full max-w-64" name="docs" variant="secondary">
      <Label className="font-medium text-foreground">Search docs</Label>
      <SearchField.Group className="rounded-xl bg-default">
        <SearchField.SearchIcon className="text-muted" />
        <SearchField.Input className="placeholder:text-muted" placeholder="Components, guides..." />
        <SearchField.ClearButton className="text-muted" />
      </SearchField.Group>
    </SearchField>
  );
}

```

### Global CSS

SearchField uses CSS classes that can be customized. Override the component classes to match your design system.

```css
@layer components {
  .search-field {
    @apply flex flex-col gap-1;
  }

  /* When invalid, the description is hidden automatically */
  .search-field[data-invalid],
  .search-field[aria-invalid] {
    [data-slot="description"] {
      @apply hidden;
    }
  }

  .search-field__group {
    @apply bg-field text-field-foreground shadow-field rounded-field inline-flex h-9 items-center overflow-hidden border;
  }

  .search-field__input {
    @apply flex-1 rounded-none border-0 bg-transparent px-3 py-2 shadow-none outline-none;
  }

  .search-field__search-icon {
    @apply text-field-placeholder pointer-events-none shrink-0 ml-3 mr-0 size-4;
  }

  .search-field__clear-button {
    @apply mr-1 shrink-0;
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

#### Base Classes \[!toc]

* `.search-field` – Root container with minimal styling (`flex flex-col gap-1`)
* `.search-field__group` – Container for search icon, input, and clear button with border and background styling
* `.search-field__input` – The search input field
* `.search-field__search-icon` – The search icon displayed on the left
* `.search-field__clear-button` – Button to clear the search field

#### Variant Classes \[!toc]

* `.search-field--primary` – Primary variant with shadow (default)
* `.search-field--secondary` – Secondary variant without shadow, suitable for use in surfaces

> **Note:** Child components ([Label](/docs/react/components/label), [Description](/docs/react/components/description), [FieldError](/docs/react/components/field-error)) have their own CSS classes and styling. See their respective documentation for customization options.

### Interactive States

SearchField automatically manages these data attributes based on its state:

* **Invalid**: `[data-invalid="true"]` or `[aria-invalid="true"]` - Automatically hides the description slot when invalid
* **Disabled**: `[data-disabled="true"]` - Applied when `isDisabled` is true
* **Focus Within**: `[data-focus-within="true"]` - Applied when the input is focused
* **Focus Visible**: `[data-focus-visible="true"]` - Applied when focus is visible (keyboard navigation)
* **Hovered**: `[data-hovered="true"]` - Applied when hovering over the group
* **Empty**: `[data-empty="true"]` - Applied when the field is empty (hides clear button)

Additional attributes are available through render props (see SearchFieldRenderProps below).

## API Reference

### SearchField

SearchField inherits all props from React Aria's [SearchField](https://react-spectrum.adobe.com/react-aria/SearchField.html) component.

#### Base Props

| Prop        | Type                                                                             | Default     | Description                                                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `children`  | `React.ReactNode \| (values: SearchFieldRenderProps) => React.ReactNode`         | -           | Child components (Label, Group, Input, etc.) or render function.                                                                                                   |
| `className` | `string \| (values: SearchFieldRenderProps) => string`                           | -           | CSS classes for styling, supports render props.                                                                                                                    |
| `style`     | `React.CSSProperties \| (values: SearchFieldRenderProps) => React.CSSProperties` | -           | Inline styles, supports render props.                                                                                                                              |
| `fullWidth` | `boolean`                                                                        | `false`     | Whether the search field should take full width of its container                                                                                                   |
| `id`        | `string`                                                                         | -           | The element's unique identifier.                                                                                                                                   |
| `variant`   | `"primary" \| "secondary"`                                                       | `"primary"` | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |
| `render`    | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, SearchFieldRenderProps>`   | -           | Overrides the default DOM element with a custom render function.                                                                                                   |

#### Value Props

| Prop           | Type                      | Default | Description                            |
| -------------- | ------------------------- | ------- | -------------------------------------- |
| `value`        | `string`                  | -       | Current value (controlled).            |
| `defaultValue` | `string`                  | -       | Default value (uncontrolled).          |
| `onChange`     | `(value: string) => void` | -       | Handler called when the value changes. |

#### Validation Props

| Prop                 | Type                                                              | Default    | Description                                                    |
| -------------------- | ----------------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| `isRequired`         | `boolean`                                                         | `false`    | Whether user input is required before form submission.         |
| `isInvalid`          | `boolean`                                                         | -          | Whether the value is invalid.                                  |
| `validate`           | `(value: string) => ValidationError \| true \| null \| undefined` | -          | Custom validation function.                                    |
| `validationBehavior` | `'native' \| 'aria'`                                              | `'native'` | Whether to use native HTML form validation or ARIA attributes. |
| `validationErrors`   | `string[]`                                                        | -          | Server-side validation errors.                                 |

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

#### Event Props

| Prop       | Type                      | Default | Description                                                  |
| ---------- | ------------------------- | ------- | ------------------------------------------------------------ |
| `onSubmit` | `(value: string) => void` | -       | Handler called when the user submits the search (Enter key). |
| `onClear`  | `() => void`              | -       | Handler called when the clear button is pressed.             |

#### Accessibility Props

| Prop               | Type     | Default | Description                                           |
| ------------------ | -------- | ------- | ----------------------------------------------------- |
| `aria-label`       | `string` | -       | Accessibility label when no visible label is present. |
| `aria-labelledby`  | `string` | -       | ID of elements that label this field.                 |
| `aria-describedby` | `string` | -       | ID of elements that describe this field.              |
| `aria-details`     | `string` | -       | ID of elements with additional details.               |

### Composition Components

SearchField works with these separate components that should be imported and used directly:

* **SearchField.Group** - Container for search icon, input, and clear button
* **SearchField.Input** - The search input field
* **SearchField.SearchIcon** - The search icon displayed on the left
* **SearchField.ClearButton** - Button to clear the search field
* **Label** - Field label component from `@heroui/react`
* **Description** - Helper text component from `@heroui/react`
* **FieldError** - Validation error message from `@heroui/react`

Each of these components has its own props API. Use them directly within SearchField for composition:

```tsx
<SearchField isRequired isInvalid={hasError} value={value} onChange={setValue}>
  <Label>Search</Label>
  <SearchField.Group>
    <SearchField.SearchIcon />
    <SearchField.Input placeholder="Search..." />
    <SearchField.ClearButton />
  </SearchField.Group>
  <Description>Enter keywords to search</Description>
  <FieldError>Search query is required</FieldError>
</SearchField>

```

#### SearchField.Group Props

SearchField.Group inherits props from React Aria's [Group](https://react-spectrum.adobe.com/react-aria/Group.html) component.

| Prop        | Type                                                               | Default | Description                                                           |
| ----------- | ------------------------------------------------------------------ | ------- | --------------------------------------------------------------------- |
| `children`  | `React.ReactNode \| (values: GroupRenderProps) => React.ReactNode` | -       | Child components (SearchIcon, Input, ClearButton) or render function. |
| `className` | `string \| (values: GroupRenderProps) => string`                   | -       | CSS classes for styling.                                              |

#### SearchField.Input Props

SearchField.Input inherits props from React Aria's [Input](https://react-spectrum.adobe.com/react-aria/Input.html) component.

| Prop          | Type                       | Default     | Description                                                                                                                                                    |
| ------------- | -------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `className`   | `string`                   | -           | CSS classes for styling.                                                                                                                                       |
| `variant`     | `"primary" \| "secondary"` | `"primary"` | Visual variant of the input. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |
| `placeholder` | `string`                   | -           | Placeholder text displayed when the input is empty.                                                                                                            |
| `type`        | `string`                   | `"search"`  | Input type (automatically set to "search").                                                                                                                    |

#### SearchField.SearchIcon Props

SearchField.SearchIcon is a custom component that renders the search icon.

| Prop        | Type              | Default          | Description                                   |
| ----------- | ----------------- | ---------------- | --------------------------------------------- |
| `children`  | `React.ReactNode` | `<IconSearch />` | Custom icon element. Defaults to search icon. |
| `className` | `string`          | -                | CSS classes for styling.                      |

#### SearchField.ClearButton Props

SearchField.ClearButton inherits props from React Aria's [Button](https://react-spectrum.adobe.com/react-aria/Button.html) component.

| Prop        | Type              | Default                | Description                                             |
| ----------- | ----------------- | ---------------------- | ------------------------------------------------------- |
| `children`  | `React.ReactNode` | `<CloseButton icon />` | Icon or content for the button. Defaults to close icon. |
| `className` | `string`          | -                      | CSS classes for styling.                                |
| `slot`      | `"clear"`         | `"clear"`              | Must be set to "clear" (automatically set).             |

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
| `value`          | `string`  | Current value.                                                             |
| `isEmpty`        | `boolean` | Whether the field is empty.                                                |

## Related Showcases



## Related Components

## Related Components

* **Label**: Accessible label for form controls
* **Description**: Helper text for form fields
* **FieldError**: Inline validation messages for form fields

</page>