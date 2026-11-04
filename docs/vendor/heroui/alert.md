<page url="/en/docs/react/components/alert">
# Alert

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/alert
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(feedback)/alert.mdx
> Display important messages and notifications to users with status indicators


## Usage

```tsx
import { Alert } from '@heroui/react';

```

```tsx
import {Alert, Button, CloseButton, Spinner} from "@heroui/react";
import React from "react";

export function Basic() {
  return (
    <div className="grid w-full max-w-xl gap-4">
      {/* Default - General information */}
      <Alert>
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>New features available</Alert.Title>
          <Alert.Description>
            Check out our latest updates including dark mode support and improved accessibility
            features.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      {/* Accent - Important information with action */}
      <Alert status="accent">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Update available</Alert.Title>
          <Alert.Description>
            A new version of the application is available. Please refresh to get the latest features
            and bug fixes.
          </Alert.Description>
          <Button className="mt-2 sm:hidden" size="sm" variant="primary">
            Refresh
          </Button>
        </Alert.Content>
        <Button className="hidden sm:block" size="sm" variant="primary">
          Refresh
        </Button>
      </Alert>

      {/* Danger - Error with detailed steps */}
      <Alert status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Unable to connect to server</Alert.Title>
          <Alert.Description>
            We're experiencing connection issues. Please try the following:
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
              <li>Check your internet connection</li>
              <li>Refresh the page</li>
              <li>Clear your browser cache</li>
            </ul>
          </Alert.Description>
          <Button className="mt-2 sm:hidden" size="sm" variant="danger">
            Retry
          </Button>
        </Alert.Content>
        <Button className="hidden sm:block" size="sm" variant="danger">
          Retry
        </Button>
      </Alert>

      {/* Without description */}
      <Alert status="success">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Profile updated successfully</Alert.Title>
        </Alert.Content>
        <CloseButton />
      </Alert>

      {/* Custom indicator - Loading state */}
      <Alert status="accent">
        <Alert.Indicator>
          <Spinner size="sm" />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>Processing your request</Alert.Title>
          <Alert.Description>
            Please wait while we sync your data. This may take a few moments.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      {/* Without close button */}
      <Alert status="warning">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Scheduled maintenance</Alert.Title>
          <Alert.Description>
            Our services will be unavailable on Sunday, March 15th from 2:00 AM to 6:00 AM UTC for
            scheduled maintenance.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    </div>
  );
}

```

## Anatomy

```tsx
import { Alert } from '@heroui/react';

export default () => (
  <Alert>
    <Alert.Indicator />
    <Alert.Content>
      <Alert.Title />
      <Alert.Description />
    </Alert.Content>
  </Alert>
)

```

## Customization

### Tailwind CSS

```tsx
import {Alert, Button, CloseButton} from "@heroui/react";

export function CustomStyles() {
  return (
    <div className="w-full max-w-xl">
      <Alert
        className="relative overflow-hidden rounded-xl border border-warning/20 bg-linear-to-br from-warning/10 via-surface to-surface-secondary shadow-sm dark:border-warning/30 dark:from-warning/15 dark:via-surface dark:to-warning/5"
        status="warning"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-8 -right-8 size-28 rounded-full bg-warning/15 blur-2xl dark:bg-warning/25"
        />
        <Alert.Indicator className="relative text-warning" />
        <Alert.Content className="relative">
          <Alert.Title>Payment method expires soon</Alert.Title>
          <Alert.Description>
            Your Visa ending in 4242 expires on March 28. Update billing to avoid interrupting your
            Pro subscription.
          </Alert.Description>
          <Button className="mt-3 sm:hidden" size="sm" variant="tertiary">
            Update billing
          </Button>
        </Alert.Content>
        <Button className="relative hidden shrink-0 sm:inline-flex" size="sm" variant="tertiary">
          Update billing
        </Button>
        <CloseButton className="relative" />
      </Alert>
    </div>
  );
}

```

### Global CSS

To customize the Alert component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .alert {
    @apply rounded-2xl shadow-lg;
  }

  .alert__title {
    @apply font-bold text-lg;
  }

  .alert--danger {
    @apply border-l-4 border-red-600;
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Alert component uses these CSS classes ([View source styles](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/alert.css)):

#### Base Classes \[!toc]

* `.alert` - Base alert container
* `.alert__indicator` - Icon/indicator container
* `.alert__content` - Content wrapper for title and description
* `.alert__title` - Alert title text
* `.alert__description` - Alert description text

#### Status Variant Classes \[!toc]

* `.alert--default` - Default gray status
* `.alert--accent` - Accent blue status
* `.alert--success` - Success green status
* `.alert--warning` - Warning yellow/orange status
* `.alert--danger` - Danger red status

### Interactive States

The Alert component is primarily informational and doesn't have interactive states on the base component. However, it can contain interactive elements like buttons or close buttons.

## API Reference

### Alert

| Prop        | Type                                                          | Default     | Description                    |
| ----------- | ------------------------------------------------------------- | ----------- | ------------------------------ |
| `status`    | `"default" \| "accent" \| "success" \| "warning" \| "danger"` | `"default"` | The visual status of the alert |
| `className` | `string`                                                      | -           | Additional CSS classes         |
| `children`  | `ReactNode`                                                   | -           | The alert content              |

### Alert.Indicator

| Prop        | Type        | Default | Description                                     |
| ----------- | ----------- | ------- | ----------------------------------------------- |
| `className` | `string`    | -       | Additional CSS classes                          |
| `children`  | `ReactNode` | -       | Custom indicator icon (defaults to status icon) |

### Alert.Content

| Prop        | Type        | Default | Description                               |
| ----------- | ----------- | ------- | ----------------------------------------- |
| `className` | `string`    | -       | Additional CSS classes                    |
| `children`  | `ReactNode` | -       | Content (typically Title and Description) |

### Alert.Title

| Prop        | Type        | Default | Description            |
| ----------- | ----------- | ------- | ---------------------- |
| `className` | `string`    | -       | Additional CSS classes |
| `children`  | `ReactNode` | -       | The alert title text   |

### Alert.Description

| Prop        | Type        | Default | Description                |
| ----------- | ----------- | ------- | -------------------------- |
| `className` | `string`    | -       | Additional CSS classes     |
| `children`  | `ReactNode` | -       | The alert description text |

## Related Components

## Related Components

* **CloseButton**: Button for dismissing overlays
* **Button**: Allows a user to perform an action
* **Spinner**: Loading indicator

</page>