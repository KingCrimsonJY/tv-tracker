<page url="/en/docs/react/components/tabs">
# Tabs

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/tabs
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(navigation)/tabs.mdx
> Tabs organize content into multiple sections and allow users to navigate between them.


## Usage

```tsx
import { Tabs } from '@heroui/react';

```



## Anatomy

```tsx
import { Tabs } from '@heroui/react';

export default () => (
  <Tabs>
    <Tabs.ListContainer>
      <Tabs.List aria-label="Options">
        <Tabs.Tab>
          <Tabs.Separator /> {/* Optional */}
          <Tabs.Indicator />
        </Tabs.Tab>
      </Tabs.List>
    </Tabs.ListContainer>
    <Tabs.Panel/>
  </Tabs>
)

```

## Examples

### Vertical



### Overflow

When the tab list exceeds the available space, `Tabs.ListContainer` automatically renders scroll chevrons and fading edges so users can navigate the hidden tabs. This works the same way for both horizontal and vertical orientations.



### Disabled Tab



### With Separator

Add `<Tabs.Separator />` inside each `<Tabs.Tab>` (except the first) to display separator lines between tabs.



### Secondary Variant



### Secondary Variant Vertical



### Alignment

Tab content is centered by default. Use `align` to align it to the `start` or `end` instead, which is
especially useful for vertical, sidebar-style navigation. Individual tabs can still be overridden with
`className` on `Tabs.Tab`.



### Render Function

```tsx
"use client";

import {Tabs} from "@heroui/react";
import Link from "next/link";

export function RenderFunction() {
  return (
    <Tabs className="w-full max-w-md" render={(props) => <div {...props} data-custom="foo" />}>
      <Tabs.ListContainer>
        <Tabs.List aria-label="Options">
          <Tabs.Tab
            href="/docs/react/getting-started"
            id="getting-started"
            render={(domProps: any) => <Link {...domProps} />}
          >
            Getting Started
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab
            href="/docs/react/components"
            id="components"
            render={(domProps: any) => <Link {...domProps} />}
          >
            Components
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab
            href="/docs/react/releases"
            id="releases"
            render={(domProps: any) => <Link {...domProps} />}
          >
            Releases
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel className="pt-4" id="overview">
        <p>View your project overview and recent activity.</p>
      </Tabs.Panel>
      <Tabs.Panel className="pt-4" id="analytics">
        <p>Track your metrics and analyze performance data.</p>
      </Tabs.Panel>
      <Tabs.Panel className="pt-4" id="reports">
        <p>Generate and download detailed reports.</p>
      </Tabs.Panel>
    </Tabs>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {Tabs} from "@heroui/react";

const listClassName = [
  "rounded-xl border border-accent/10 bg-accent-soft/30 p-1",
  "**:data-[slot=tabs-tab]:rounded-lg",
  "**:data-[slot=tabs-tab]:bg-transparent",
  "**:data-[slot=tabs-tab]:text-muted",
  "**:data-[slot=tabs-tab]:opacity-100",
  "**:data-[slot=tabs-tab]:transition-colors",
  "**:data-[slot=tabs-tab]:data-[hovered=true]:not-data-[selected=true]:bg-accent-soft",
  "**:data-[slot=tabs-tab]:data-[hovered=true]:not-data-[selected=true]:text-accent-soft-foreground",
  "**:data-[slot=tabs-tab]:data-[pressed=true]:not-data-[selected=true]:bg-accent-soft-hover",
  "**:data-[slot=tabs-tab]:data-[focus-visible=true]:ring-2",
  "**:data-[slot=tabs-tab]:data-[focus-visible=true]:ring-accent/15",
  "**:data-[slot=tabs-tab]:data-[selected=true]:font-medium",
  "**:data-[slot=tabs-tab]:data-[selected=true]:text-accent-foreground",
  "**:data-[slot=tabs-tab]:shadow-none",
  "**:data-[slot=tabs-indicator]:rounded-lg",
  "**:data-[slot=tabs-indicator]:bg-accent",
  "**:data-[slot=tabs-indicator]:shadow-none",
].join(" ");

export function CustomStyles() {
  return (
    <Tabs className="w-full max-w-sm">
      <Tabs.ListContainer className="rounded-none bg-transparent">
        <Tabs.List aria-label="Billing cycle" className={listClassName}>
          <Tabs.Tab id="monthly">
            Monthly
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="yearly">
            Yearly
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel className="pt-3 text-sm text-muted" id="monthly">
        Billed monthly, cancel anytime.
      </Tabs.Panel>
      <Tabs.Panel className="pt-3 text-sm text-muted" id="yearly">
        Save 20% with annual billing.
      </Tabs.Panel>
    </Tabs>
  );
}

```

### Global CSS

To customize the Tabs component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .tabs__list {
    @apply rounded-xl border border-border bg-surface p-1;
  }

  .tabs__tab {
    @apply rounded-lg font-medium;
  }

  .tabs__indicator {
    @apply rounded-lg bg-foreground shadow-sm;
  }

  .tabs--secondary > .tabs__list-container > .tabs__list {
    @apply border-b border-border bg-transparent p-0;
  }

  .tabs--secondary > .tabs__list-container .tabs__indicator {
    @apply rounded-none bg-accent;
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Tabs component uses these CSS classes ([View source styles](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/tabs.css)):

#### Base Classes \[!toc]

* `.tabs` - Base tabs container
* `.tabs__list-container` - Tab list container wrapper
* `.tabs__list-container__scroller` - Scrollable wrapper around the tab list (handles overflow and fading edges)
* `.tabs__list-container__scroll-prev` - Scroll chevron button for the previous (left / up) direction
* `.tabs__list-container__scroll-next` - Scroll chevron button for the next (right / down) direction
* `.tabs__list` - Tab list container
* `.tabs__tab` - Individual tab button
* `.tabs__separator` - Separator between tabs
* `.tabs__panel` - Tab panel content
* `.tabs__indicator` - Tab indicator

#### Orientation Attributes \[!toc]

* `.tabs[data-orientation="horizontal"]` - Horizontal tab layout (default)
* `.tabs[data-orientation="vertical"]` - Vertical tab layout

#### Variant Classes \[!toc]

* `.tabs--secondary` - Secondary variant with underline indicator

#### Alignment Classes \[!toc]

* `.tabs--align-start` - Aligns tab content to the start
* `.tabs--align-end` - Aligns tab content to the end

### Interactive States

The component supports both CSS pseudo-classes and data attributes:

* **Selected**: `[aria-selected="true"]`
* **Hover**: `:hover` or `[data-hovered="true"]`
* **Focus**: `:focus-visible` or `[data-focus-visible="true"]`
* **Disabled**: `[aria-disabled="true"]`

## API Reference

### Tabs

| Prop                 | Type                                                                    | Default        | Description                                                                                  |
| -------------------- | ----------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| `variant`            | `"primary" \| "secondary"`                                              | `"primary"`    | Visual style variant. Primary uses a filled indicator, secondary uses an underline indicator |
| `orientation`        | `"horizontal" \| "vertical"`                                            | `"horizontal"` | Tab layout orientation                                                                       |
| `align`              | `"start" \| "center" \| "end"`                                          | `"center"`     | Alignment of the content inside each tab                                                     |
| `selectedKey`        | `string`                                                                | -              | Controlled selected tab key                                                                  |
| `defaultSelectedKey` | `string`                                                                | -              | Default selected tab key                                                                     |
| `onSelectionChange`  | `(key: Key) => void`                                                    | -              | Selection change handler                                                                     |
| `className`          | `string`                                                                | -              | Additional CSS classes                                                                       |
| `render`             | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, TabsRenderProps>` | -              | Overrides the default DOM element with a custom render function.                             |

### Tabs.List

| Prop         | Type                                                                       | Default | Description                                                      |
| ------------ | -------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `aria-label` | `string`                                                                   | -       | Accessibility label for tab list                                 |
| `className`  | `string`                                                                   | -       | Additional CSS classes                                           |
| `render`     | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, TabListRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

### Tabs.Tab

| Prop         | Type                                                                   | Default | Description                                                      |
| ------------ | ---------------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `id`         | `string`                                                               | -       | Unique tab identifier                                            |
| `isDisabled` | `boolean`                                                              | `false` | Whether tab is disabled                                          |
| `className`  | `string`                                                               | -       | Additional CSS classes                                           |
| `render`     | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, TabRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

### Tabs.Separator

| Prop        | Type     | Default | Description            |
| ----------- | -------- | ------- | ---------------------- |
| `className` | `string` | -       | Additional CSS classes |

### Tabs.Panel

| Prop        | Type                                                                        | Default | Description                                                      |
| ----------- | --------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `id`        | `string`                                                                    | -       | Panel identifier matching tab id                                 |
| `className` | `string`                                                                    | -       | Additional CSS classes                                           |
| `render`    | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, TabPanelRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

## Related Showcases



## Related Components

## Related Components

* **Breadcrumbs**: Display the user's current location within a hierarchy

</page>