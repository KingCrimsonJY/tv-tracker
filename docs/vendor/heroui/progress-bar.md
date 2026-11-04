<page url="/en/docs/react/components/progress-bar">
# ProgressBar

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/progress-bar
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(feedback)/progress-bar.mdx
> A progress bar shows either determinate or indeterminate progress of an operation over time.


## Usage

```tsx
import { ProgressBar, Label } from '@heroui/react';

```

```tsx
import {Label, ProgressBar} from "@heroui/react";

export function Basic() {
  return (
    <ProgressBar aria-label="Loading" className="w-64" value={60}>
      <Label>Loading</Label>
      <ProgressBar.Output />
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  );
}

```

## Anatomy

```tsx
import { ProgressBar, Label } from '@heroui/react';

export default () => (
  <ProgressBar value={60}>
    <Label>Loading</Label>
    <ProgressBar.Output />
    <ProgressBar.Track>
      <ProgressBar.Fill />
    </ProgressBar.Track>
  </ProgressBar>
);

```

## Examples

### Sizes

```tsx
import {Label, ProgressBar} from "@heroui/react";

export function Sizes() {
  return (
    <div className="flex w-64 flex-col gap-6">
      <ProgressBar aria-label="Small" size="sm" value={40}>
        <Label>Small</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <ProgressBar aria-label="Medium" size="md" value={60}>
        <Label>Medium</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <ProgressBar aria-label="Large" size="lg" value={80}>
        <Label>Large</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
    </div>
  );
}

```

### Colors

```tsx
import {Label, ProgressBar} from "@heroui/react";

export function Colors() {
  return (
    <div className="flex w-64 flex-col gap-6">
      <ProgressBar aria-label="Default" color="default" value={50}>
        <Label>Default</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <ProgressBar aria-label="Accent" color="accent" value={50}>
        <Label>Accent</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <ProgressBar aria-label="Success" color="success" value={50}>
        <Label>Success</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <ProgressBar aria-label="Warning" color="warning" value={50}>
        <Label>Warning</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <ProgressBar aria-label="Danger" color="danger" value={50}>
        <Label>Danger</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
    </div>
  );
}

```

### Without Label

When no visible label is needed, use `aria-label` for accessibility.

```tsx
import {ProgressBar} from "@heroui/react";

export function WithoutLabel() {
  return (
    <ProgressBar aria-label="Loading progress" className="w-64" value={45}>
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  );
}

```

### Indeterminate

Use `isIndeterminate` when progress cannot be determined.

```tsx
import {Label, ProgressBar} from "@heroui/react";

export function Indeterminate() {
  return (
    <ProgressBar isIndeterminate aria-label="Loading" className="w-64">
      <Label>Loading...</Label>
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  );
}

```

### Custom Value Scale

Use `minValue`, `maxValue`, and `formatOptions` to customize the value range and display format.

```tsx
"use client";

import {Label, ListBox, NumberField, ProgressBar, Select, Separator} from "@heroui/react";
import {useState} from "react";

const formatStyleOptions: {label: string; value: string}[] = [
  {label: "Currency", value: "currency"},
  {label: "Percent", value: "percent"},
  {label: "Decimal", value: "decimal"},
  {label: "Unit", value: "unit"},
];

const formatOptionsMap: Record<string, Intl.NumberFormatOptions> = {
  currency: {currency: "USD", style: "currency"},
  decimal: {style: "decimal"},
  percent: {style: "percent"},
  unit: {style: "unit", unit: "mile"},
};

export function CustomValue() {
  const [value, setValue] = useState(750);
  const [minValue, setMinValue] = useState(0);
  const [maxValue, setMaxValue] = useState(1000);
  const [format, setFormat] = useState<string>("percent");

  return (
    <div className="flex w-full flex-col gap-6 md:flex-row md:items-center md:gap-10">
      <div className="flex w-full max-w-md flex-1 justify-center">
        <ProgressBar
          aria-label="Revenue"
          className="w-full max-w-52"
          formatOptions={formatOptionsMap[format]}
          maxValue={maxValue}
          minValue={minValue}
          value={value}
        >
          <Label>Progress</Label>
          <ProgressBar.Output />
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      </div>

      <Separator className="md:hidden" />
      <Separator className="hidden md:block" orientation="vertical" />

      <div className="flex max-w-52 flex-col gap-3">
        <Label className="text-xs font-medium text-muted">Options</Label>

        <NumberField
          maxValue={maxValue}
          minValue={minValue}
          value={value}
          variant="secondary"
          onChange={(v) => setValue(v)}
        >
          <Label>Value</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>

        <NumberField
          maxValue={maxValue - 1}
          minValue={0}
          value={minValue}
          variant="secondary"
          onChange={(v) => {
            setMinValue(v);
            if (value < v) setValue(v);
          }}
        >
          <Label>Min Value</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>

        <NumberField
          maxValue={2000}
          minValue={minValue + 1}
          value={maxValue}
          variant="secondary"
          onChange={(v) => {
            setMaxValue(v);
            if (value > v) setValue(v);
          }}
        >
          <Label>Max Value</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>

        <Select value={format} variant="secondary" onChange={(key) => setFormat(key as string)}>
          <Label>Format</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {formatStyleOptions.map((option) => (
                <ListBox.Item key={option.value} id={option.value} textValue={option.label}>
                  {option.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
    </div>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {Label, ProgressBar} from "@heroui/react";

export function CustomStyles() {
  return (
    <ProgressBar aria-label="Upload progress" className="w-64" value={45}>
      <Label className="font-medium text-foreground">Uploading resume.pdf</Label>
      <ProgressBar.Output className="text-xs text-muted tabular-nums" />
      <ProgressBar.Track className="rounded-full bg-default">
        <ProgressBar.Fill className="rounded-full bg-accent" />
      </ProgressBar.Track>
    </ProgressBar>
  );
}

```

### Global CSS

To customize the ProgressBar component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .progress-bar {
    @apply w-full gap-2;
  }

  .progress-bar__track {
    @apply h-3 rounded-full;
  }

  .progress-bar__fill {
    @apply rounded-full;
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ProgressBar component uses these CSS classes ([View source styles](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/progress-bar.css)):

#### Base & Element Classes \[!toc]

* `.progress-bar` - Base container (grid layout)
* `.progress-bar__output` - Value text display
* `.progress-bar__track` - Track background
* `.progress-bar__fill` - Filled portion of the track

#### Size Classes \[!toc]

* `.progress-bar--sm` - Small size variant (thinner track)
* `.progress-bar--md` - Medium size variant (default)
* `.progress-bar--lg` - Large size variant (thicker track)

#### Color Classes \[!toc]

* `.progress-bar--default` - Default color variant
* `.progress-bar--accent` - Accent color variant
* `.progress-bar--success` - Success color variant
* `.progress-bar--warning` - Warning color variant
* `.progress-bar--danger` - Danger color variant

## API Reference

### ProgressBar

Inherits from [React Aria ProgressBar](https://react-spectrum.adobe.com/react-aria/ProgressBar.html).

| Prop              | Type                                                          | Default              | Description                         |
| ----------------- | ------------------------------------------------------------- | -------------------- | ----------------------------------- |
| `value`           | `number`                                                      | `0`                  | The current value                   |
| `minValue`        | `number`                                                      | `0`                  | The minimum value                   |
| `maxValue`        | `number`                                                      | `100`                | The maximum value                   |
| `isIndeterminate` | `boolean`                                                     | `false`              | Whether progress is indeterminate   |
| `size`            | `"sm" \| "md" \| "lg"`                                        | `"md"`               | Size of the progress track          |
| `color`           | `"default" \| "accent" \| "success" \| "warning" \| "danger"` | `"accent"`           | Color of the fill bar               |
| `formatOptions`   | `Intl.NumberFormatOptions`                                    | `{style: 'percent'}` | Number format for the value display |
| `valueLabel`      | `ReactNode`                                                   | -                    | Custom value label content          |
| `children`        | `ReactNode \| (values: ProgressBarRenderProps) => ReactNode`  | -                    | Content or render prop              |

### Render Props

When using the render prop pattern, these values are provided:

| Prop              | Type      | Description                            |
| ----------------- | --------- | -------------------------------------- |
| `percentage`      | `number`  | The percentage of the progress (0-100) |
| `valueText`       | `string`  | The formatted value text               |
| `isIndeterminate` | `boolean` | Whether progress is indeterminate      |

## Related Components

</page>