<page url="/en/docs/react/components/switch">
# Switch

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/switch
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(controls)/switch.mdx
> A toggle switch component for boolean states


## Usage

```tsx
import { Switch, SwitchGroup, Label } from '@heroui/react';

```

```tsx
import {Switch} from "@heroui/react";

export function Basic() {
  return (
    <Switch>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        Enable notifications
      </Switch.Content>
    </Switch>
  );
}

```

## Anatomy

```tsx
import { Switch, Label, Description } from '@heroui/react';

export default () => (
  <Switch>
    <Switch.Control>
      <Switch.Thumb>
        <Switch.Icon/> {/* Optional */}
      </Switch.Thumb>
    </Switch.Control>
    <Switch.Content>
      <Label />
      <Description /> {/* Optional */}
    </Switch.Content>
  </Switch>
);

```

For grouping multiple switches, use the `SwitchGroup` component:

```tsx
import { Switch, SwitchGroup, Label } from '@heroui/react';

export default () => (
  <SwitchGroup>
    <Switch>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Label>Option 1</Label>
    </Switch>
    <Switch>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Label>Option 2</Label>
    </Switch>
  </SwitchGroup>
);

```

## Examples

### Sizes

```tsx
import {Switch} from "@heroui/react";

export function Sizes() {
  return (
    <div className="flex gap-6">
      <Switch size="sm">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Small
        </Switch.Content>
      </Switch>
      <Switch size="md">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Medium
        </Switch.Content>
      </Switch>
      <Switch size="lg">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Large
        </Switch.Content>
      </Switch>
    </div>
  );
}

```

### With Icons

```tsx
"use client";

import {
  BellFill,
  BellSlash,
  Check,
  Microphone,
  MicrophoneSlash,
  Moon,
  Power,
  Sun,
  VolumeFill,
  VolumeSlashFill,
} from "@gravity-ui/icons";
import {Switch} from "@heroui/react";

export function WithIcons() {
  const icons = {
    check: {
      off: Power,
      on: Check,
      selectedControlClass: "bg-green-500/80",
    },
    darkMode: {
      off: Moon,
      on: Sun,
      selectedControlClass: "",
    },
    microphone: {
      off: Microphone,
      on: MicrophoneSlash,
      selectedControlClass: "bg-red-500/80",
    },
    notification: {
      off: BellSlash,
      on: BellFill,
      selectedControlClass: "bg-purple-500/80",
    },
    volume: {
      off: VolumeFill,
      on: VolumeSlashFill,
      selectedControlClass: "bg-blue-500/80",
    },
  };

  return (
    <div className="flex gap-3">
      {Object.entries(icons).map(([key, value]) => (
        <Switch key={key} defaultSelected aria-label={key} size="lg">
          {({isSelected}) => (
            <Switch.Content>
              <Switch.Control className={isSelected ? value.selectedControlClass : ""}>
                <Switch.Thumb>
                  <Switch.Icon>
                    {isSelected ? (
                      <value.on className="size-3 text-inherit opacity-100" />
                    ) : (
                      <value.off className="size-3 text-inherit opacity-70" />
                    )}
                  </Switch.Icon>
                </Switch.Thumb>
              </Switch.Control>
            </Switch.Content>
          )}
        </Switch>
      ))}
    </div>
  );
}

```

### Disabled

```tsx
import {Switch} from "@heroui/react";

export function Disabled() {
  return (
    <Switch isDisabled>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        Enable notifications
      </Switch.Content>
    </Switch>
  );
}

```

### Without Label

```tsx
import {Switch} from "@heroui/react";

export function WithoutLabel() {
  return (
    <Switch aria-label="Enable notifications">
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
}

```

### With Description

```tsx
import {Description, Switch} from "@heroui/react";

export function WithDescription() {
  return (
    <div className="max-w-sm">
      <Switch>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Public profile
        </Switch.Content>
        <Description>Allow others to see your profile information</Description>
      </Switch>
    </div>
  );
}

```

### Default Selected

```tsx
import {Switch} from "@heroui/react";

export function DefaultSelected() {
  return (
    <Switch defaultSelected>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        Enable notifications
      </Switch.Content>
    </Switch>
  );
}

```

### Controlled

```tsx
"use client";

import {Switch} from "@heroui/react";
import React from "react";

export function Controlled() {
  const [isSelected, setIsSelected] = React.useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Switch isSelected={isSelected} onChange={setIsSelected}>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Enable notifications
        </Switch.Content>
      </Switch>
      <p className="text-sm text-muted">Switch is {isSelected ? "on" : "off"}</p>
    </div>
  );
}

```

### Label Position

```tsx
import {Switch} from "@heroui/react";

export function LabelPosition() {
  return (
    <div className="flex flex-col gap-4">
      <Switch>
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Label after
        </Switch.Content>
      </Switch>
      <Switch>
        <Switch.Content>
          Label before
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
    </div>
  );
}

```

### Group

```tsx
import {Switch, SwitchGroup} from "@heroui/react";

export function Group() {
  return (
    <SwitchGroup>
      <Switch name="notifications">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Allow Notifications
        </Switch.Content>
      </Switch>
      <Switch name="marketing">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Marketing emails
        </Switch.Content>
      </Switch>
      <Switch name="social">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Social media updates
        </Switch.Content>
      </Switch>
    </SwitchGroup>
  );
}

```

### Group Horizontal

```tsx
import {Switch, SwitchGroup} from "@heroui/react";

export function GroupHorizontal() {
  return (
    <SwitchGroup className="overflow-x-auto" orientation="horizontal">
      <Switch name="notifications">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Notifications
        </Switch.Content>
      </Switch>
      <Switch name="marketing">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Marketing
        </Switch.Content>
      </Switch>
      <Switch name="social">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          Social
        </Switch.Content>
      </Switch>
    </SwitchGroup>
  );
}

```

### Form Integration

```tsx
"use client";

import {Button, Switch, SwitchGroup} from "@heroui/react";
import React from "react";

export function Form() {
  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    alert(
      `Form submitted with:\n${Array.from(formData.entries())
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n")}`,
    );
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <SwitchGroup>
        <Switch name="notifications" value="on">
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Enable notifications
          </Switch.Content>
        </Switch>
        <Switch defaultSelected name="newsletter" value="on">
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Subscribe to newsletter
          </Switch.Content>
        </Switch>
        <Switch name="marketing" value="on">
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Receive marketing updates
          </Switch.Content>
        </Switch>
      </SwitchGroup>
      <Button className="mt-4" size="sm" type="submit" variant="primary">
        Submit
      </Button>
    </form>
  );
}

```

### Render Props

```tsx
"use client";

import {Switch} from "@heroui/react";

export function RenderProps() {
  return (
    <Switch>
      {({isSelected}) => (
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          {isSelected ? "Enabled" : "Disabled"}
        </Switch.Content>
      )}
    </Switch>
  );
}

```

### Render Function

```tsx
"use client";

import {Switch} from "@heroui/react";

export function RenderFunction() {
  return (
    <Switch render={(props) => <div {...props} data-custom="foo" />}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        Enable notifications
      </Switch.Content>
    </Switch>
  );
}

```

## Customization

### Tailwind CSS

```tsx
"use client";

import {Description, Label, Switch} from "@heroui/react";

export function CustomStyles() {
  return (
    <Switch id="autosave">
      <Switch.Content>
        <Switch.Control className="[--switch-control-bg-checked-hover:var(--success)] [--switch-control-bg-checked:var(--success)]">
          <Switch.Thumb />
        </Switch.Control>
        <div className="flex flex-col gap-0.5">
          <Label>Auto-save drafts</Label>
          <Description>Changes are saved as you type.</Description>
        </div>
      </Switch.Content>
    </Switch>
  );
}

```

### Global CSS

To customize the Switch component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .switch {
    @apply inline-flex gap-3 items-center;
  }

  .switch__control {
    @apply h-5 w-8 bg-gray-400 data-[selected=true]:bg-blue-500;
  }

  .switch__thumb {
    @apply bg-white shadow-sm;
  }

  .switch__content {
    @apply flex flex-col gap-1;
  }

  .switch__icon {
    @apply h-3 w-3 text-current;
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

#### Switch Classes \[!toc]

The Switch component uses these CSS classes ([View source styles](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/switch.css)):

* `.switch` - Base switch container
* `.switch__content` - Optional content container
* `.switch__control` - Switch control track
* `.switch__thumb` - Switch thumb that moves
* `.switch__icon` - Optional icon inside the thumb
* `.switch--sm` - Small size variant
* `.switch--md` - Medium size variant (default)
* `.switch--lg` - Large size variant

#### SwitchGroup Classes \[!toc]

The SwitchGroup component uses these CSS classes ([View source styles](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/switch-group.css)):

* `.switch-group` - Switch group container
* `.switch-group__items` - Container for switch items
* `.switch-group--horizontal` - Horizontal layout
* `.switch-group--vertical` - Vertical layout (default)

### Interactive States

The switch supports both CSS pseudo-classes and data attributes for flexibility:

* **Selected**: `[data-selected="true"]` (thumb position and background color change)
* **Hover**: `:hover` or `[data-hovered="true"]`
* **Focus**: `:focus-visible` or `[data-focus-visible="true"]` (shows focus ring)
* **Disabled**: `:disabled` or `[aria-disabled="true"]` (reduced opacity, no pointer events)
* **Pressed**: `:active` or `[data-pressed="true"]`

## API Reference

### Switch

Inherits from [React Aria Switch](https://react-spectrum.adobe.com/react-aria/Switch.html).

| Prop                 | Type                                                                      | Default    | Description                                                       |
| -------------------- | ------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------- |
| `size`               | `'sm' \| 'md' \| 'lg'`                                                    | `'md'`     | The size of the switch                                            |
| `isSelected`         | `boolean`                                                                 | `false`    | Whether the switch is on                                          |
| `defaultSelected`    | `boolean`                                                                 | `false`    | Whether the switch is on by default (uncontrolled)                |
| `isDisabled`         | `boolean`                                                                 | `false`    | Whether the switch is disabled                                    |
| `isInvalid`          | `boolean`                                                                 | `false`    | Whether the switch is invalid                                     |
| `isReadOnly`         | `boolean`                                                                 | `false`    | Whether the switch is read only                                   |
| `isRequired`         | `boolean`                                                                 | `false`    | Whether the switch must be selected                               |
| `validate`           | `(value: boolean) => ValidationError \| true \| null \| undefined`        | -          | Custom validation function                                        |
| `validationBehavior` | `'native' \| 'aria'`                                                      | `'native'` | Whether to use native HTML form validation or ARIA                |
| `name`               | `string`                                                                  | -          | The name of the input element, used when submitting an HTML form  |
| `value`              | `string`                                                                  | -          | The value of the input element, used when submitting an HTML form |
| `onChange`           | `(isSelected: boolean) => void`                                           | -          | Handler called when the switch value changes                      |
| `onPress`            | `(e: PressEvent) => void`                                                 | -          | Handler called when the switch is pressed                         |
| `children`           | `React.ReactNode \| (values: SwitchRenderProps) => React.ReactNode`       | -          | Switch content or render prop                                     |
| `render`             | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, SwitchRenderProps>` | -          | Overrides the default DOM element with a custom render function.  |

### Render Props

When using the render prop pattern, these values are provided:

| Prop             | Type      | Description                             |
| ---------------- | --------- | --------------------------------------- |
| `isSelected`     | `boolean` | Whether the switch is currently on      |
| `isHovered`      | `boolean` | Whether the switch is hovered           |
| `isPressed`      | `boolean` | Whether the switch is currently pressed |
| `isFocused`      | `boolean` | Whether the switch is focused           |
| `isFocusVisible` | `boolean` | Whether the switch is keyboard focused  |
| `isDisabled`     | `boolean` | Whether the switch is disabled          |
| `isReadOnly`     | `boolean` | Whether the switch is read only         |
| `isInvalid`      | `boolean` | Whether the switch is invalid           |
| `isRequired`     | `boolean` | Whether the switch is required          |
| `state`          | `-`       | State of the switch.                    |

### SwitchGroup

| Prop          | Type                         | Default      | Description                         |
| ------------- | ---------------------------- | ------------ | ----------------------------------- |
| `orientation` | `'horizontal' \| 'vertical'` | `'vertical'` | The orientation of the switch group |
| `children`    | `React.ReactNode`            | -            | The switch items to render          |
| `className`   | `string`                     | -            | Additional CSS class names          |

## Related Components

## Related Components

* **Label**: Accessible label for form controls
* **Description**: Helper text for form fields
* **Button**: Allows a user to perform an action

</page>