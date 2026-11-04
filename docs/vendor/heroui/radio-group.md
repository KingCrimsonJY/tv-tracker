<page url="/en/docs/react/components/radio-group">
# RadioGroup

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/radio-group
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(forms)/radio-group.mdx
> Radio group for selecting a single option from a list


## Usage

```tsx
import { RadioGroup, Radio } from '@heroui/react';

```

```tsx
import {Description, Label, Radio, RadioGroup} from "@heroui/react";

export function Basic() {
  return (
    <RadioGroup defaultValue="premium" name="plan">
      <Label>Plan selection</Label>
      <Description>Choose the plan that suits you best</Description>
      <Radio value="basic">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Basic Plan
        </Radio.Content>
        <Description>Includes 100 messages per month</Description>
      </Radio>
      <Radio value="premium">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Premium Plan
        </Radio.Content>
        <Description>Includes 200 messages per month</Description>
      </Radio>
      <Radio value="business">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Business Plan
        </Radio.Content>
        <Description>Unlimited messages</Description>
      </Radio>
    </RadioGroup>
  );
}

```

## Anatomy

```tsx
import {RadioGroup, Radio, Label, Description, FieldError} from '@heroui/react';

export default () => (
  <RadioGroup>
    <Label />
    <Description />
    <Radio value="option1">
      <Radio.Content> {/* The clickable area: control + label */}
        <Radio.Control>
          <Radio.Indicator>
            <span>✓</span> {/* Custom indicator (optional) */}
          </Radio.Indicator>
        </Radio.Control>
        Label {/* plain text — the clickable label */}
      </Radio.Content>
      <Description /> {/* Sibling — stays outside the button (announced via aria-describedby) */}
      <FieldError /> {/* Optional — per-radio validation message */}
    </Radio>
    <FieldError /> {/* Optional — group-level validation */}
  </RadioGroup>
)

```

## Examples

### Horizontal Orientation

```tsx
import {Description, Label, Radio, RadioGroup} from "@heroui/react";

export function Horizontal() {
  return (
    <div className="flex flex-col gap-4">
      <Label>Subscription plan</Label>
      <RadioGroup defaultValue="pro" name="plan-orientation" orientation="horizontal">
        <Radio value="starter">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Starter
          </Radio.Content>
          <Description>For side projects</Description>
        </Radio>
        <Radio value="pro">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Pro
          </Radio.Content>
          <Description>Advanced reporting</Description>
        </Radio>
        <Radio value="teams">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Teams
          </Radio.Content>
          <Description>Up to 10 teammates</Description>
        </Radio>
      </RadioGroup>
    </div>
  );
}

```

### Variants

The RadioGroup component supports two visual variants:

* **`primary`** (default) - Standard styling with default background, suitable for most use cases
* **`secondary`** - Lower emphasis variant, suitable for use in Surface components

```tsx
import {Description, Radio, RadioGroup} from "@heroui/react";

export function Variants() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted">Primary variant</p>
        <RadioGroup defaultValue="option1" name="primary-plan" variant="primary">
          <Radio value="option1">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              Option 1
            </Radio.Content>
            <Description>Standard styling with default background</Description>
          </Radio>
          <Radio value="option2">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              Option 2
            </Radio.Content>
            <Description>Another option with primary styling</Description>
          </Radio>
        </RadioGroup>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted">Secondary variant</p>
        <RadioGroup defaultValue="option1" name="secondary-plan" variant="secondary">
          <Radio value="option1">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              Option 1
            </Radio.Content>
            <Description>Lower emphasis variant for use in surfaces</Description>
          </Radio>
          <Radio value="option2">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              Option 2
            </Radio.Content>
            <Description>Another option with secondary styling</Description>
          </Radio>
        </RadioGroup>
      </div>
    </div>
  );
}

```

### In Surface

When used inside a [Surface](/docs/react/components/surface) component, use `variant="secondary"` to apply the lower emphasis variant suitable for surface backgrounds.

```tsx
import {Description, Label, Radio, RadioGroup, Surface} from "@heroui/react";

export function OnSurface() {
  return (
    <Surface className="w-full rounded-3xl p-6">
      <RadioGroup defaultValue="premium" name="plan-on-surface" variant="secondary">
        <Label>Plan selection</Label>
        <Description>Choose the plan that suits you best</Description>
        <Radio value="basic">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Basic Plan
          </Radio.Content>
          <Description>Includes 100 messages per month</Description>
        </Radio>
        <Radio value="premium">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Premium Plan
          </Radio.Content>
          <Description>Includes 200 messages per month</Description>
        </Radio>
        <Radio value="business">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Business Plan
          </Radio.Content>
          <Description>Unlimited messages</Description>
        </Radio>
      </RadioGroup>
    </Surface>
  );
}

```

### Disabled

```tsx
import {Description, Label, Radio, RadioGroup} from "@heroui/react";

export function Disabled() {
  return (
    <RadioGroup isDisabled defaultValue="pro" name="plan-disabled">
      <Label>Subscription plan</Label>
      <Description>Plan changes are temporarily paused while we roll out updates.</Description>
      <Radio value="starter">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Starter
        </Radio.Content>
        <Description>For side projects and small teams</Description>
      </Radio>
      <Radio value="pro">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Pro
        </Radio.Content>
        <Description>Advanced reporting and analytics</Description>
      </Radio>
      <Radio value="teams">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Teams
        </Radio.Content>
        <Description>Share access with up to 10 teammates</Description>
      </Radio>
    </RadioGroup>
  );
}

```

### Controlled

```tsx
"use client";

import {Description, Label, Radio, RadioGroup} from "@heroui/react";
import React from "react";

export function Controlled() {
  const [value, setValue] = React.useState("pro");

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup name="plan-controlled" value={value} onChange={setValue}>
        <Label>Subscription plan</Label>
        <Radio value="starter">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Starter
          </Radio.Content>
          <Description>For side projects and small teams</Description>
        </Radio>
        <Radio value="pro">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Pro
          </Radio.Content>
          <Description>Advanced reporting and analytics</Description>
        </Radio>
        <Radio value="teams">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Teams
          </Radio.Content>
          <Description>Share access with up to 10 teammates</Description>
        </Radio>
      </RadioGroup>
      <p className="text-sm text-muted">
        Selected plan: <span className="font-medium">{value}</span>
      </p>
    </div>
  );
}

```

### Uncontrolled

Combine `defaultValue` with `onChange` when you only need to react to updates.

```tsx
"use client";

import {Description, Label, Radio, RadioGroup} from "@heroui/react";
import React from "react";

export function Uncontrolled() {
  const [selection, setSelection] = React.useState("pro");

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        defaultValue="pro"
        name="plan-uncontrolled"
        onChange={(nextValue) => setSelection(nextValue)}
      >
        <Label>Subscription plan</Label>
        <Radio value="starter">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Starter
          </Radio.Content>
          <Description>For side projects and small teams</Description>
        </Radio>
        <Radio value="pro">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Pro
          </Radio.Content>
          <Description>Advanced reporting and analytics</Description>
        </Radio>
        <Radio value="teams">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Teams
          </Radio.Content>
          <Description>Share access with up to 10 teammates</Description>
        </Radio>
      </RadioGroup>
      <p className="text-sm text-muted">
        Last chosen plan: <span className="font-medium">{selection}</span>
      </p>
    </div>
  );
}

```

### Validation

```tsx
"use client";

import {Button, Description, FieldError, Form, Label, Radio, RadioGroup} from "@heroui/react";
import React from "react";

export function Validation() {
  const [message, setMessage] = React.useState<string | null>(null);

  return (
    <Form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();

        const formData = new FormData(e.currentTarget);
        const value = formData.get("plan-validation");

        setMessage(`Your chosen plan is: ${value}`);
      }}
    >
      <RadioGroup isRequired name="plan-validation">
        <Label>Subscription plan</Label>
        <Radio value="starter">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Starter
          </Radio.Content>
          <Description>For side projects and small teams</Description>
        </Radio>
        <Radio value="pro">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Pro
          </Radio.Content>
          <Description>Advanced reporting and analytics</Description>
        </Radio>
        <Radio value="teams">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Teams
          </Radio.Content>
          <Description>Share access with up to 10 teammates</Description>
        </Radio>
        <FieldError>Choose a subscription before continuing.</FieldError>
      </RadioGroup>
      <Button className="mt-2 w-fit" type="submit">
        Submit
      </Button>
      {!!message && <p className="text-sm text-muted">{message}</p>}
    </Form>
  );
}

```

### Delivery & Payment



### Custom Indicator

```tsx
"use client";

import {Description, Label, Radio, RadioGroup} from "@heroui/react";

export function CustomIndicator() {
  return (
    <RadioGroup defaultValue="premium" name="plan-custom-indicator">
      <Label>Plan selection</Label>
      <Description>Choose the plan that suits you best</Description>
      <Radio value="basic">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator>
              {({isSelected}) =>
                isSelected ? <span className="text-xs leading-none text-background">✓</span> : null
              }
            </Radio.Indicator>
          </Radio.Control>
          Basic Plan
        </Radio.Content>
        <Description>Includes 100 messages per month</Description>
      </Radio>
      <Radio value="premium">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator>
              {({isSelected}) =>
                isSelected ? <span className="text-xs leading-none text-background">✓</span> : null
              }
            </Radio.Indicator>
          </Radio.Control>
          Premium Plan
        </Radio.Content>
        <Description>Includes 200 messages per month</Description>
      </Radio>
      <Radio value="business">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator>
              {({isSelected}) =>
                isSelected ? <span className="text-xs leading-none text-background">✓</span> : null
              }
            </Radio.Indicator>
          </Radio.Control>
          Business Plan
        </Radio.Content>
        <Description>Unlimited messages</Description>
      </Radio>
    </RadioGroup>
  );
}

```

### Render Function

```tsx
"use client";

import {Description, Label, Radio, RadioGroup} from "@heroui/react";

export function RenderFunction() {
  return (
    <RadioGroup
      defaultValue="premium"
      name="plan-custom-render"
      render={(props) => <div {...props} data-custom="foo" />}
    >
      <Label>Plan selection</Label>
      <Description>Choose the plan that suits you best</Description>
      <Radio value="basic">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Basic Plan
        </Radio.Content>
        <Description>Includes 100 messages per month</Description>
      </Radio>
      <Radio value="premium">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Premium Plan
        </Radio.Content>
        <Description>Includes 200 messages per month</Description>
      </Radio>
      <Radio value="business">
        <Radio.Content>
          <Radio.Control>
            <Radio.Indicator />
          </Radio.Control>
          Business Plan
        </Radio.Content>
        <Description>Unlimited messages</Description>
      </Radio>
    </RadioGroup>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {Description, Label, Radio, RadioGroup} from "@heroui/react";

const options = [
  {description: "$12 billed every month", label: "Monthly", value: "monthly"},
  {description: "$120 billed once a year", label: "Yearly", value: "yearly"},
] as const;

const contentClassName =
  "group flex w-full items-start gap-3 rounded-xl border border-success/10 bg-success-soft/30 px-4 py-3 transition-colors data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-success/15 data-[hovered=true]:bg-success-soft-hover data-[selected=true]:border-success/30 data-[selected=true]:bg-success-soft data-[selected=true]:data-[hovered=true]:bg-success-soft-hover";

const controlClassName =
  "mt-0.5 size-5 shrink-0 rounded-full border border-border bg-default shadow-none group-data-[pressed=true]:scale-95 group-data-[selected=true]:border-transparent group-data-[selected=true]:bg-success group-data-[selected=true]:group-data-[pressed=true]:bg-success-hover";

const indicatorClassName =
  "before:rounded-full before:bg-default group-data-[selected=true]:before:scale-50 group-data-[selected=true]:before:bg-success-foreground group-data-[selected=true]:group-data-[pressed=true]:before:scale-[0.57]";

export function CustomStyles() {
  return (
    <RadioGroup
      className="w-full max-w-sm gap-3 **:data-[slot=radio]:mt-0"
      defaultValue="yearly"
      name="billing"
      variant="secondary"
    >
      <Label className="font-medium text-foreground">Billing cycle</Label>
      <Description>Choose how often you are charged.</Description>
      {options.map(({description, label, value}) => (
        <Radio key={value} value={value}>
          <Radio.Content className={contentClassName}>
            <Radio.Control className={controlClassName}>
              <Radio.Indicator className={indicatorClassName} />
            </Radio.Control>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-foreground group-data-[selected=true]:text-success-soft-foreground">
                {label}
              </span>
              <Description className="group-data-[selected=true]:text-success-soft-foreground/80">
                {description}
              </Description>
            </div>
          </Radio.Content>
        </Radio>
      ))}
    </RadioGroup>
  );
}

```

### Global CSS

To customize the RadioGroup component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .radio-group {
    @apply gap-2;
  }

  .radio {
    @apply gap-4 rounded-lg border border-border p-3 hover:bg-surface-hovered;
  }

  .radio__control {
    @apply border-2 border-accent;
  }

  .radio__indicator {
    @apply bg-primary;
  }

  .radio__content {
    @apply gap-1;
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The RadioGroup component uses these CSS classes ([View source styles](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/radio-group.css)):

#### Base Classes \[!toc]

* `.radio-group` - Base radio group container
* `.radio` - Individual radio item
* `.radio__content` - Radio button (RAC label wrapper for control + label text)
* `.radio__control` - Radio control (circular button)
* `.radio__indicator` - Radio indicator (inner dot)

#### Modifier Classes \[!toc]

Disabled state is applied via `[data-disabled="true"]` / `[aria-disabled="true"]` (and `:disabled`) on `.radio` — there is no `.radio--disabled` modifier class.

### Interactive States

The radio supports both CSS pseudo-classes and data attributes for flexibility:

* **Selected**: `[aria-checked="true"]` or `[data-selected="true"]` (indicator appears)
* **Hover**: `:hover` or `[data-hovered="true"]` (border color changes)
* **Focus**: `:focus-visible` or `[data-focus-visible="true"]` (shows focus ring)
* **Pressed**: `:active` or `[data-pressed="true"]` (scale transform)
* **Disabled**: `:disabled` or `[aria-disabled="true"]` (reduced opacity, no pointer events)
* **Invalid**: `[data-invalid="true"]` or `[aria-invalid="true"]` (error border color)

## API Reference

### RadioGroup

| Prop           | Type                                                                          | Default      | Description                                                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `value`        | `string`                                                                      | -            | The current value (controlled)                                                                                                                                     |
| `defaultValue` | `string`                                                                      | -            | The default value (uncontrolled)                                                                                                                                   |
| `onChange`     | `(value: string) => void`                                                     | -            | Handler called when the value changes                                                                                                                              |
| `isDisabled`   | `boolean`                                                                     | `false`      | Whether the radio group is disabled                                                                                                                                |
| `isRequired`   | `boolean`                                                                     | `false`      | Whether the radio group is required                                                                                                                                |
| `isReadOnly`   | `boolean`                                                                     | `false`      | Whether the radio group is read only                                                                                                                               |
| `isInvalid`    | `boolean`                                                                     | `false`      | Whether the radio group is in an invalid state                                                                                                                     |
| `variant`      | `"primary" \| "secondary"`                                                    | `"primary"`  | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |
| `name`         | `string`                                                                      | -            | The name of the radio group, used when submitting an HTML form                                                                                                     |
| `orientation`  | `'horizontal' \| 'vertical'`                                                  | `'vertical'` | The orientation of the radio group                                                                                                                                 |
| `children`     | `React.ReactNode \| (values: RadioGroupRenderProps) => React.ReactNode`       | -            | Radio group content or render prop                                                                                                                                 |
| `render`       | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, RadioGroupRenderProps>` | -            | Overrides the default DOM element with a custom render function.                                                                                                   |

### Radio

| Prop         | Type                                                                          | Default | Description                                                      |
| ------------ | ----------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `value`      | `string`                                                                      | -       | The value of the radio button                                    |
| `isDisabled` | `boolean`                                                                     | `false` | Whether the radio button is disabled                             |
| `name`       | `string`                                                                      | -       | The name of the radio button, used when submitting an HTML form  |
| `children`   | `React.ReactNode \| (values: RadioFieldRenderProps) => React.ReactNode`       | -       | Radio content or field render prop                               |
| `render`     | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, RadioFieldRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

### Radio.Control

Extends `React.HTMLAttributes<HTMLSpanElement>`.

| Prop       | Type              | Default | Description                                                                  |
| ---------- | ----------------- | ------- | ---------------------------------------------------------------------------- |
| `children` | `React.ReactNode` | -       | The content to render inside the control wrapper (typically Radio.Indicator) |

### Radio.Indicator

Extends `React.HTMLAttributes<HTMLSpanElement>`.

| Prop       | Type                                                                     | Default | Description                                                                   |
| ---------- | ------------------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------- |
| `children` | `React.ReactNode \| (values: RadioButtonRenderProps) => React.ReactNode` | -       | Optional content or render prop that receives the current radio button state. |

### Radio.Content

The clickable area of the radio (the `<label>` wrapping the hidden input). Place `Radio.Control` and the `Label` inside it. `className` accepts a render function that receives `RadioButtonRenderProps`.

| Prop       | Type                                                                     | Default | Description                                               |
| ---------- | ------------------------------------------------------------------------ | ------- | --------------------------------------------------------- |
| `children` | `React.ReactNode \| (values: RadioButtonRenderProps) => React.ReactNode` | -       | The clickable content (typically Radio.Control and Label) |

### RadioFieldRenderProps

When using a render prop on the root `Radio`, these field-level values are provided:

| Prop         | Type      | Description                              |
| ------------ | --------- | ---------------------------------------- |
| `isSelected` | `boolean` | Whether the radio is currently selected  |
| `isDisabled` | `boolean` | Whether the radio is disabled            |
| `isReadOnly` | `boolean` | Whether the radio is read only           |
| `isInvalid`  | `boolean` | Whether the radio is in an invalid state |
| `isRequired` | `boolean` | Whether the radio is required            |

### RadioButtonRenderProps

`Radio.Control` and `Radio.Indicator` use button-level render props (`isHovered`, `isPressed`, `isFocusVisible`, etc.). Pass a function as `Radio.Control` children or to `Radio.Indicator` to access them.

## Related Showcases



## Related Components

## Related Components

* **Fieldset**: Group related form controls with legends
* **Surface**: Base container surface
* **Description**: Helper text for form fields

</page>