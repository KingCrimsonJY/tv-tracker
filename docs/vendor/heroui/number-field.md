<page url="/en/docs/react/components/number-field">
# NumberField

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/number-field
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(forms)/number-field.mdx
> Number input fields with increment/decrement buttons, validation, and internationalized formatting


## Usage

```tsx
import { NumberField } from '@heroui/react';

```

```tsx
import {Label, NumberField} from "@heroui/react";

export function Basic() {
  return (
    <NumberField className="w-full max-w-64" defaultValue={1024} minValue={0} name="width">
      <Label>Width</Label>
      <NumberField.Group>
        <NumberField.DecrementButton />
        <NumberField.Input className="w-[120px]" />
        <NumberField.IncrementButton />
      </NumberField.Group>
    </NumberField>
  );
}

```

## Anatomy

```tsx
import {NumberField, Label, Description, FieldError} from '@heroui/react';

export default () => (
  <NumberField>
    <Label />
    <NumberField.Group>
      <NumberField.DecrementButton />
      <NumberField.Input />
      <NumberField.IncrementButton />
    </NumberField.Group>
    <Description />
    <FieldError />
  </NumberField>
)

```

> **NumberField** allows users to enter numeric values with optional increment/decrement buttons. It supports internationalized formatting, validation, and keyboard navigation.

## Examples

### Variants

The NumberField component supports two visual variants:

* **`primary`** (default) - Standard styling with shadow, suitable for most use cases
* **`secondary`** - Lower emphasis variant without shadow, suitable for use in Surface components

```tsx
import {Label, NumberField} from "@heroui/react";

export function Variants() {
  return (
    <div className="flex flex-col gap-4">
      <NumberField defaultValue={100} minValue={0} name="primary-width" variant="primary">
        <Label>Primary variant</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
      </NumberField>
      <NumberField defaultValue={100} minValue={0} name="secondary-width" variant="secondary">
        <Label>Secondary variant</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
      </NumberField>
    </div>
  );
}

```

### In Surface

When used inside a [Surface](/docs/react/components/surface) component, use `variant="secondary"` to apply the lower emphasis variant suitable for surface backgrounds.

```tsx
import {Description, Label, NumberField, Surface} from "@heroui/react";

export function OnSurface() {
  return (
    <Surface className="flex w-full max-w-[280px] flex-col gap-4 rounded-3xl p-6">
      <NumberField defaultValue={1024} minValue={0} name="width" variant="secondary">
        <Label>Width</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-full" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Enter the width in pixels</Description>
      </NumberField>
      <NumberField
        defaultValue={0.5}
        formatOptions={{style: "percent"}}
        maxValue={1}
        minValue={0}
        name="percentage"
        step={0.1}
        variant="secondary"
      >
        <Label>Percentage</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-full" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Value must be between 0 and 100</Description>
      </NumberField>
    </Surface>
  );
}

```

### With Description

```tsx
import {Description, Label, NumberField} from "@heroui/react";

export function WithDescription() {
  return (
    <div className="flex w-full max-w-64 flex-col gap-4">
      <NumberField defaultValue={1024} minValue={0} name="width">
        <Label>Width</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Enter the width in pixels</Description>
      </NumberField>
      <NumberField
        defaultValue={0.5}
        formatOptions={{style: "percent"}}
        maxValue={1}
        minValue={0}
        name="percentage"
        step={0.1}
      >
        <Label>Percentage</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Value must be between 0 and 100</Description>
      </NumberField>
    </div>
  );
}

```

### Required Field

```tsx
import {Description, Label, NumberField} from "@heroui/react";

export function Required() {
  return (
    <div className="flex w-full max-w-64 flex-col gap-4">
      <NumberField isRequired minValue={0} name="quantity">
        <Label>Quantity</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
      </NumberField>
      <NumberField isRequired defaultValue={1} maxValue={10} minValue={1} name="rating">
        <Label>Rating</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Rate from 1 to 10</Description>
      </NumberField>
    </div>
  );
}

```

### Disabled State

```tsx
import {Description, Label, NumberField} from "@heroui/react";

export function Disabled() {
  return (
    <div className="flex w-full max-w-64 flex-col gap-4">
      <NumberField isDisabled defaultValue={1024} minValue={0} name="width">
        <Label>Width</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Enter the width in pixels</Description>
      </NumberField>
      <NumberField
        isDisabled
        defaultValue={0.5}
        formatOptions={{style: "percent"}}
        maxValue={1}
        minValue={0}
        name="percentage"
        step={0.1}
      >
        <Label>Percentage</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Value must be between 0 and 100</Description>
      </NumberField>
    </div>
  );
}

```

### Full Width

```tsx
import {Label, NumberField} from "@heroui/react";

export function FullWidth() {
  return (
    <div className="w-[400px] space-y-4">
      <NumberField fullWidth defaultValue={1024} minValue={0} name="width">
        <Label>Width</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input />
          <NumberField.IncrementButton />
        </NumberField.Group>
      </NumberField>
    </div>
  );
}

```

### Validation

Use `isInvalid` together with `FieldError` to surface validation messages.

```tsx
import {FieldError, Label, NumberField} from "@heroui/react";

export function Validation() {
  return (
    <div className="flex w-full max-w-64 flex-col gap-4">
      <NumberField isInvalid isRequired minValue={0} name="quantity" value={-5}>
        <Label>Quantity</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <FieldError>Quantity must be greater than or equal to 0</FieldError>
      </NumberField>
      <NumberField
        isInvalid
        formatOptions={{style: "percent"}}
        maxValue={1}
        minValue={0}
        name="percentage"
        step={0.1}
        value={1.5}
      >
        <Label>Percentage</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <FieldError>Percentage must be between 0 and 100</FieldError>
      </NumberField>
    </div>
  );
}

```

### Controlled

Control the value to synchronize with other components or perform custom formatting.

```tsx
"use client";

import {Button, Description, Label, NumberField} from "@heroui/react";
import React from "react";

export function Controlled() {
  const [value, setValue] = React.useState(1024);

  return (
    <div className="flex w-full max-w-64 flex-col gap-4">
      <NumberField minValue={0} name="width" value={value} onChange={setValue}>
        <Label>Width</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Current value: {value}</Description>
      </NumberField>
      <div className="flex gap-2">
        <Button variant="tertiary" onPress={() => setValue(0)}>
          Reset to 0
        </Button>
        <Button variant="tertiary" onPress={() => setValue(2048)}>
          Set to 2048
        </Button>
      </div>
    </div>
  );
}

```

### Step Values

Configure increment/decrement step values for precise control.

```tsx
import {Description, Label, NumberField} from "@heroui/react";

export function WithStep() {
  return (
    <div className="flex w-full max-w-64 flex-col gap-4">
      <NumberField defaultValue={0} maxValue={100} minValue={0} name="step1" step={1}>
        <Label>Step: 1</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Increments by 1</Description>
      </NumberField>
      <NumberField defaultValue={0} maxValue={100} minValue={0} name="step5" step={5}>
        <Label>Step: 5</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Increments by 5</Description>
      </NumberField>
      <NumberField defaultValue={0} maxValue={100} minValue={0} name="step10" step={10}>
        <Label>Step: 10</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Increments by 10</Description>
      </NumberField>
    </div>
  );
}

```

### Format Options

Format numbers as currency, percentages, decimals, or units with internationalization support.

```tsx
import {Description, Label, NumberField} from "@heroui/react";

export function WithFormatOptions() {
  return (
    <div className="flex w-full max-w-64 flex-col gap-4">
      <NumberField
        defaultValue={99}
        minValue={0}
        name="currency-eur"
        formatOptions={{
          currency: "EUR",
          currencySign: "accounting",
          style: "currency",
        }}
      >
        <Label>Currency (EUR - Accounting)</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Accounting format with EUR currency</Description>
      </NumberField>
      <NumberField
        defaultValue={99.99}
        minValue={0}
        name="currency-usd"
        formatOptions={{
          currency: "USD",
          style: "currency",
        }}
      >
        <Label>Currency (USD)</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Standard USD currency format</Description>
      </NumberField>
      <NumberField
        defaultValue={0.5}
        formatOptions={{style: "percent"}}
        maxValue={1}
        minValue={0}
        name="percentage"
        step={0.01}
      >
        <Label>Percentage</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Percentage format (0-1, where 0.5 = 50%)</Description>
      </NumberField>
      <NumberField
        defaultValue={1234.56}
        minValue={0}
        name="decimal"
        formatOptions={{
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
          style: "decimal",
        }}
      >
        <Label>Decimal (2 decimal places)</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Decimal format with 2 decimal places</Description>
      </NumberField>
      <NumberField
        defaultValue={1000}
        minValue={0}
        name="unit"
        formatOptions={{
          style: "unit",
          unit: "kilogram",
          unitDisplay: "short",
        }}
      >
        <Label>Unit (Kilograms)</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description>Unit format with kilograms</Description>
      </NumberField>
    </div>
  );
}

```

### Form Example

Complete form integration with validation and submission handling.

```tsx
"use client";

import {Button, Description, FieldError, Form, Label, NumberField, Spinner} from "@heroui/react";
import React from "react";

export function FormExample() {
  const [value, setValue] = React.useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const STOCK_AVAILABLE = 3;
  const isOutOfStock = value !== undefined && value > STOCK_AVAILABLE;

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (value === undefined || value === null || value < 1 || value > STOCK_AVAILABLE) {
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      console.log("Order submitted:", {quantity: value});
      setValue(undefined);
      setIsSubmitting(false);
    }, 1500);
  };

  return (
    <Form className="flex w-[280px] flex-col gap-4" onSubmit={handleSubmit}>
      <NumberField
        isRequired
        isInvalid={isOutOfStock}
        maxValue={5}
        minValue={1}
        name="quantity"
        value={value}
        onChange={setValue}
      >
        <Label>Order quantity</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        {isOutOfStock ? (
          <FieldError>Only {STOCK_AVAILABLE} items left in stock</FieldError>
        ) : (
          <Description>Only {STOCK_AVAILABLE} items available</Description>
        )}
      </NumberField>
      <Button
        className="w-full"
        isDisabled={value === undefined || value < 1 || value > STOCK_AVAILABLE}
        isPending={isSubmitting}
        type="submit"
        variant="primary"
      >
        {isSubmitting ? (
          <>
            <Spinner color="current" size="sm" />
            Processing...
          </>
        ) : (
          "Place Order"
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

import {Description, FieldError, Label, NumberField} from "@heroui/react";
import React from "react";

export function WithValidation() {
  const [value, setValue] = React.useState<number | undefined>(undefined);
  const isInvalid = value !== undefined && (value < 0 || value > 100);

  return (
    <div className="flex w-full max-w-64 flex-col gap-4">
      <NumberField
        isRequired
        formatOptions={{style: "percent"}}
        isInvalid={isInvalid}
        maxValue={1}
        minValue={0}
        name="percentage"
        step={0.1}
        value={value}
        onChange={setValue}
      >
        <Label>Percentage</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        {isInvalid ? (
          <FieldError>Percentage must be between 0 and 100</FieldError>
        ) : (
          <Description>Enter a value between 0 and 100</Description>
        )}
      </NumberField>
    </div>
  );
}

```

### Custom Icons

Customize the increment and decrement button icons.

```tsx
import {Description, Label, NumberField} from "@heroui/react";

export function CustomIcons() {
  return (
    <div className="flex w-full max-w-64 flex-col gap-4">
      <NumberField defaultValue={1024} minValue={0} name="width">
        <Label>Width (Custom Icons)</Label>
        <NumberField.Group>
          <NumberField.DecrementButton>
            <svg height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
              <path
                clipRule="evenodd"
                d="M6.75 11a4.25 4.25 0 1 0 0-8.5a4.25 4.25 0 0 0 0 8.5m0 1.5a5.73 5.73 0 0 0 3.501-1.188l2.719 2.718a.75.75 0 1 0 1.06-1.06l-2.718-2.719A5.75 5.75 0 1 0 6.75 12.5m-2-6.5a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5z"
                fill="currentColor"
                fillRule="evenodd"
              />
            </svg>
          </NumberField.DecrementButton>
          <NumberField.Input className="w-[120px]" />
          <NumberField.IncrementButton>
            <svg height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
              <path
                clipRule="evenodd"
                d="M6.75 11a4.25 4.25 0 1 0 0-8.5a4.25 4.25 0 0 0 0 8.5m0 1.5a5.73 5.73 0 0 0 3.501-1.188l2.719 2.718a.75.75 0 1 0 1.06-1.06l-2.718-2.719A5.75 5.75 0 1 0 6.75 12.5m.75-7.75a.75.75 0 0 0-1.5 0V6H4.75a.75.75 0 0 0 0 1.5H6v1.25a.75.75 0 0 0 1.5 0V7.5h1.25a.75.75 0 0 0 0-1.5H7.5z"
                fill="currentColor"
                fillRule="evenodd"
              />
            </svg>
          </NumberField.IncrementButton>
        </NumberField.Group>
        <Description>Custom icon children</Description>
      </NumberField>
    </div>
  );
}

```

### With Chevrons

Use chevron icons in a vertical layout for a different visual style.

```tsx
import {Label, NumberField} from "@heroui/react";

export function WithChevrons() {
  return (
    <NumberField
      className="w-full max-w-64"
      defaultValue={99}
      minValue={0}
      name="amount"
      formatOptions={{
        currency: "EUR",
        currencySign: "accounting",
        style: "currency",
      }}
    >
      <Label>Number field with chevrons</Label>
      <NumberField.Group className="flex">
        <NumberField.Input className="flex-1" />
        <div className="flex h-full flex-col border-s border-field-placeholder/15">
          <NumberField.IncrementButton className="flex h-1/2 w-6 items-center justify-center rounded-none border-0 pt-0.5 text-sm">
            <svg
              aria-hidden="true"
              height="11"
              viewBox="0 0 16 16"
              width="11"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                clipRule="evenodd"
                d="M13.03 10.53a.75.75 0 0 1-1.06 0L8 6.56l-3.97 3.97a.75.75 0 1 1-1.06-1.06l4.5-4.5a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06"
                fill="currentColor"
                fillRule="evenodd"
              />
            </svg>
          </NumberField.IncrementButton>
          <NumberField.DecrementButton className="flex h-1/2 w-6 items-center justify-center rounded-none border-0 pb-0.5 text-sm">
            <svg
              aria-hidden="true"
              height="11"
              viewBox="0 0 16 16"
              width="11"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                clipRule="evenodd"
                d="M2.97 5.47a.75.75 0 0 1 1.06 0L8 9.44l3.97-3.97a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 0 1 0-1.06"
                fill="currentColor"
                fillRule="evenodd"
              />
            </svg>
          </NumberField.DecrementButton>
        </div>
      </NumberField.Group>
    </NumberField>
  );
}

```

### Render Function

```tsx
"use client";

import {Label, NumberField} from "@heroui/react";

export function RenderFunction() {
  return (
    <NumberField
      className="w-full max-w-64"
      defaultValue={1024}
      minValue={0}
      name="width"
      render={(props) => <div {...props} data-custom="foo" />}
    >
      <Label>Width</Label>
      <NumberField.Group>
        <NumberField.DecrementButton />
        <NumberField.Input className="w-[120px]" />
        <NumberField.IncrementButton />
      </NumberField.Group>
    </NumberField>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {Label, NumberField} from "@heroui/react";

export function CustomStyles() {
  return (
    <NumberField
      className="w-full max-w-48"
      defaultValue={2}
      minValue={1}
      name="guests"
      variant="secondary"
    >
      <Label className="font-medium text-foreground">Guests</Label>
      <NumberField.Group className="rounded-xl bg-default">
        <NumberField.DecrementButton className="text-muted hover:text-foreground" />
        <NumberField.Input className="text-center tabular-nums" />
        <NumberField.IncrementButton className="text-muted hover:text-foreground" />
      </NumberField.Group>
    </NumberField>
  );
}

```

### Global CSS

NumberField uses CSS classes that can be customized. Override the component classes to match your design system.

```css
@layer components {
  .number-field {
    @apply flex flex-col gap-1;
  }

  /* When invalid, the description is hidden automatically */
  .number-field[data-invalid="true"] [data-slot="description"],
  .number-field[aria-invalid="true"] [data-slot="description"] {
    @apply hidden;
  }

  .number-field__group {
    @apply bg-field text-field-foreground shadow-field rounded-field inline-flex h-9 items-center overflow-hidden border;
  }

  .number-field__input {
    @apply flex-1 rounded-none border-0 bg-transparent px-3 py-2 tabular-nums;
  }

  .number-field__increment-button,
  .number-field__decrement-button {
    @apply flex h-full w-10 items-center justify-center rounded-none bg-transparent;
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

#### Base Classes \[!toc]

* `.number-field` – Root container with minimal styling (`flex flex-col gap-1`)
* `.number-field__group` – Container for input and buttons with border and background styling
* `.number-field__input` – The numeric input field
* `.number-field__increment-button` – Button to increment the value
* `.number-field__decrement-button` – Button to decrement the value

#### Variant Classes \[!toc]

* `.number-field--primary` – Primary variant with shadow (default)
* `.number-field--secondary` – Secondary variant without shadow, suitable for use in surfaces

> **Note:** Child components ([Label](/docs/react/components/label), [Description](/docs/react/components/description), [FieldError](/docs/react/components/field-error)) have their own CSS classes and styling. See their respective documentation for customization options.

### Interactive States

NumberField automatically manages these data attributes based on its state:

* **Invalid**: `[data-invalid="true"]` or `[aria-invalid="true"]` - Automatically hides the description slot when invalid
* **Disabled**: `[data-disabled="true"]` - Applied when `isDisabled` is true
* **Focus Within**: `[data-focus-within="true"]` - Applied when the input or buttons are focused
* **Focus Visible**: `[data-focus-visible="true"]` - Applied when focus is visible (keyboard navigation)
* **Hovered**: `[data-hovered="true"]` - Applied when hovering over buttons

Additional attributes are available through render props (see NumberFieldRenderProps below).

## API Reference

### NumberField

NumberField inherits all props from React Aria's [NumberField](https://react-spectrum.adobe.com/react-aria/NumberField.html) component.

#### Base Props

| Prop        | Type                                                                             | Default     | Description                                                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `children`  | `React.ReactNode \| (values: NumberFieldRenderProps) => React.ReactNode`         | -           | Child components (Label, Group, Input, etc.) or render function.                                                                                                   |
| `className` | `string \| (values: NumberFieldRenderProps) => string`                           | -           | CSS classes for styling, supports render props.                                                                                                                    |
| `style`     | `React.CSSProperties \| (values: NumberFieldRenderProps) => React.CSSProperties` | -           | Inline styles, supports render props.                                                                                                                              |
| `fullWidth` | `boolean`                                                                        | `false`     | Whether the number field should take full width of its container                                                                                                   |
| `id`        | `string`                                                                         | -           | The element's unique identifier.                                                                                                                                   |
| `variant`   | `"primary" \| "secondary"`                                                       | `"primary"` | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |
| `render`    | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, NumberFieldRenderProps>`   | -           | Overrides the default DOM element with a custom render function.                                                                                                   |

#### Value Props

| Prop           | Type                                   | Default | Description                            |
| -------------- | -------------------------------------- | ------- | -------------------------------------- |
| `value`        | `number`                               | -       | Current value (controlled).            |
| `defaultValue` | `number`                               | -       | Default value (uncontrolled).          |
| `onChange`     | `(value: number \| undefined) => void` | -       | Handler called when the value changes. |

#### Formatting Props

| Prop            | Type                       | Default | Description                                                        |
| --------------- | -------------------------- | ------- | ------------------------------------------------------------------ |
| `formatOptions` | `Intl.NumberFormatOptions` | -       | Options for formatting numbers (currency, percent, decimal, unit). |
| `locale`        | `string`                   | -       | Locale for number formatting.                                      |

#### Validation Props

| Prop                 | Type                                                              | Default    | Description                                                    |
| -------------------- | ----------------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| `isRequired`         | `boolean`                                                         | `false`    | Whether user input is required before form submission.         |
| `isInvalid`          | `boolean`                                                         | -          | Whether the value is invalid.                                  |
| `validate`           | `(value: number) => ValidationError \| true \| null \| undefined` | -          | Custom validation function.                                    |
| `validationBehavior` | `'native' \| 'aria'`                                              | `'native'` | Whether to use native HTML form validation or ARIA attributes. |
| `validationErrors`   | `string[]`                                                        | -          | Server-side validation errors.                                 |

#### Range Props

| Prop       | Type     | Default | Description                                    |
| ---------- | -------- | ------- | ---------------------------------------------- |
| `minValue` | `number` | -       | Minimum allowed value.                         |
| `maxValue` | `number` | -       | Maximum allowed value.                         |
| `step`     | `number` | `1`     | Step value for increment/decrement operations. |

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

NumberField works with these separate components that should be imported and used directly:

* **NumberField.Group** - Container for input and buttons
* **NumberField.Input** - The numeric input field
* **NumberField.IncrementButton** - Button to increment the value
* **NumberField.DecrementButton** - Button to decrement the value
* **Label** - Field label component from `@heroui/react`
* **Description** - Helper text component from `@heroui/react`
* **FieldError** - Validation error message from `@heroui/react`

Each of these components has its own props API. Use them directly within NumberField for composition:

```tsx
<NumberField isRequired isInvalid={hasError} minValue={0} maxValue={100}>
  <Label>Quantity</Label>
  <NumberField.Group>
    <NumberField.DecrementButton />
    <NumberField.Input />
    <NumberField.IncrementButton />
  </NumberField.Group>
  <Description>Enter a value between 0 and 100</Description>
  <FieldError>Value must be between 0 and 100</FieldError>
</NumberField>

```

#### NumberField.Group Props

NumberField.Group inherits props from React Aria's [Group](https://react-spectrum.adobe.com/react-aria/Group.html) component.

| Prop        | Type                                                               | Default | Description                                           |
| ----------- | ------------------------------------------------------------------ | ------- | ----------------------------------------------------- |
| `children`  | `React.ReactNode \| (values: GroupRenderProps) => React.ReactNode` | -       | Child components (Input, Buttons) or render function. |
| `className` | `string \| (values: GroupRenderProps) => string`                   | -       | CSS classes for styling.                              |

#### NumberField.Input Props

NumberField.Input inherits props from React Aria's [Input](https://react-spectrum.adobe.com/react-aria/Input.html) component.

| Prop        | Type                       | Default     | Description                                                                                                                                                    |
| ----------- | -------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `className` | `string`                   | -           | CSS classes for styling.                                                                                                                                       |
| `variant`   | `"primary" \| "secondary"` | `"primary"` | Visual variant of the input. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |

#### NumberField.IncrementButton Props

NumberField.IncrementButton inherits props from React Aria's [Button](https://react-spectrum.adobe.com/react-aria/Button.html) component.

| Prop        | Type              | Default        | Description                                            |
| ----------- | ----------------- | -------------- | ------------------------------------------------------ |
| `children`  | `React.ReactNode` | `<IconPlus />` | Icon or content for the button. Defaults to plus icon. |
| `className` | `string`          | -              | CSS classes for styling.                               |
| `slot`      | `"increment"`     | `"increment"`  | Must be set to "increment" (automatically set).        |

#### NumberField.DecrementButton Props

NumberField.DecrementButton inherits props from React Aria's [Button](https://react-spectrum.adobe.com/react-aria/Button.html) component.

| Prop        | Type              | Default         | Description                                             |
| ----------- | ----------------- | --------------- | ------------------------------------------------------- |
| `children`  | `React.ReactNode` | `<IconMinus />` | Icon or content for the button. Defaults to minus icon. |
| `className` | `string`          | -               | CSS classes for styling.                                |
| `slot`      | `"decrement"`     | `"decrement"`   | Must be set to "decrement" (automatically set).         |

### Render Props

When using render props with `className`, `style`, or `children`, these values are available:

| Prop             | Type                  | Description                                                                |
| ---------------- | --------------------- | -------------------------------------------------------------------------- |
| `isDisabled`     | `boolean`             | Whether the field is disabled.                                             |
| `isInvalid`      | `boolean`             | Whether the field is currently invalid.                                    |
| `isReadOnly`     | `boolean`             | Whether the field is read-only.                                            |
| `isRequired`     | `boolean`             | Whether the field is required.                                             |
| `isFocused`      | `boolean`             | Whether the field is currently focused (DEPRECATED - use `isFocusWithin`). |
| `isFocusWithin`  | `boolean`             | Whether any child element is focused.                                      |
| `isFocusVisible` | `boolean`             | Whether focus is visible (keyboard navigation).                            |
| `value`          | `number \| undefined` | Current value.                                                             |
| `minValue`       | `number \| undefined` | Minimum allowed value.                                                     |
| `maxValue`       | `number \| undefined` | Maximum allowed value.                                                     |
| `step`           | `number`              | Step value for increment/decrement.                                        |

## Related Showcases



## Related Components

## Related Components

* **Label**: Accessible label for form controls
* **Description**: Helper text for form fields
* **FieldError**: Inline validation messages for form fields

</page>