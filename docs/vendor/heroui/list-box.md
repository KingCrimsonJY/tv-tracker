<page url="/en/docs/react/components/list-box">
# ListBox

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/list-box
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(collections)/list-box.mdx
> A listbox displays a list of options and allows a user to select one or more of them


## Usage

```tsx
import { ListBox } from '@heroui/react';

```

```tsx
import {Avatar, Description, Label, ListBox} from "@heroui/react";

export function Default() {
  return (
    <ListBox aria-label="Users" className="w-[220px]" selectionMode="single">
      <ListBox.Item id="1" textValue="Bob">
        <Avatar size="sm">
          <Avatar.Image
            alt="Bob"
            src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg"
          />
          <Avatar.Fallback>B</Avatar.Fallback>
        </Avatar>
        <div className="flex flex-col">
          <Label>Bob</Label>
          <Description>bob@heroui.com</Description>
        </div>
        <ListBox.ItemIndicator />
      </ListBox.Item>
      <ListBox.Item id="2" textValue="Fred">
        <Avatar size="sm">
          <Avatar.Image
            alt="Fred"
            src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg"
          />
          <Avatar.Fallback>F</Avatar.Fallback>
        </Avatar>
        <div className="flex flex-col">
          <Label>Fred</Label>
          <Description>fred@heroui.com</Description>
        </div>
        <ListBox.ItemIndicator />
      </ListBox.Item>
      <ListBox.Item id="3" textValue="Martha">
        <Avatar size="sm">
          <Avatar.Image
            alt="Martha"
            src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg"
          />
          <Avatar.Fallback>M</Avatar.Fallback>
        </Avatar>
        <div className="flex flex-col">
          <Label>Martha</Label>
          <Description>martha@heroui.com</Description>
        </div>
        <ListBox.ItemIndicator />
      </ListBox.Item>
    </ListBox>
  );
}

```

## Anatomy

```tsx
import { ListBox, Label, Description, Header } from '@heroui/react';

export default () => (
  <ListBox>
    <ListBox.Item>
      <Label />
      <Description />
      <ListBox.ItemIndicator />
    </ListBox.Item>
    <ListBox.Section>
      <Header />
      <ListBox.Item>
        <Label />
      </ListBox.Item>
    </ListBox.Section>
  </ListBox>
)

```

## Examples

### With Disabled Items

```tsx
"use client";

import {Pencil, SquarePlus, TrashBin} from "@gravity-ui/icons";
import {Description, Header, Kbd, Label, ListBox, Separator, Surface} from "@heroui/react";

export function WithDisabledItems() {
  return (
    <Surface className="w-[256px] rounded-3xl shadow-surface">
      <ListBox
        aria-label="File actions"
        className="w-full p-2"
        disabledKeys={["delete-file"]}
        selectionMode="none"
        onAction={(key) => alert(`Selected item: ${key}`)}
      >
        <ListBox.Section>
          <Header>Actions</Header>
          <ListBox.Item id="new-file" textValue="New file">
            <div className="flex h-8 items-start justify-center pt-px">
              <SquarePlus className="size-4 shrink-0 text-muted" />
            </div>
            <div className="flex flex-col">
              <Label>New file</Label>
              <Description>Create a new file</Description>
            </div>
            <Kbd className="ms-auto" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>N</Kbd.Content>
            </Kbd>
          </ListBox.Item>
          <ListBox.Item id="edit-file" textValue="Edit file">
            <div className="flex h-8 items-start justify-center pt-px">
              <Pencil className="size-4 shrink-0 text-muted" />
            </div>
            <div className="flex flex-col">
              <Label>Edit file</Label>
              <Description>Make changes</Description>
            </div>
            <Kbd className="ms-auto" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>E</Kbd.Content>
            </Kbd>
          </ListBox.Item>
        </ListBox.Section>
        <Separator />
        <ListBox.Section>
          <Header>Danger zone</Header>
          <ListBox.Item id="delete-file" textValue="Delete file" variant="danger">
            <div className="flex h-8 items-start justify-center pt-px">
              <TrashBin className="size-4 shrink-0 text-danger" />
            </div>
            <div className="flex flex-col">
              <Label>Delete file</Label>
              <Description>Move to trash</Description>
            </div>
            <Kbd className="ms-auto" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Abbr keyValue="shift" />
              <Kbd.Content>D</Kbd.Content>
            </Kbd>
          </ListBox.Item>
        </ListBox.Section>
      </ListBox>
    </Surface>
  );
}

```

### With Sections

```tsx
"use client";

import {Pencil, SquarePlus, TrashBin} from "@gravity-ui/icons";
import {Description, Header, Kbd, Label, ListBox, Separator, Surface} from "@heroui/react";

export function WithSections() {
  return (
    <Surface className="w-[256px] rounded-3xl shadow-surface">
      <ListBox
        aria-label="File actions"
        className="w-full p-2"
        selectionMode="none"
        onAction={(key) => alert(`Selected item: ${key}`)}
      >
        <ListBox.Section>
          <Header>Actions</Header>
          <ListBox.Item id="new-file" textValue="New file">
            <div className="flex h-8 items-start justify-center pt-px">
              <SquarePlus className="size-4 shrink-0 text-muted" />
            </div>
            <div className="flex flex-col">
              <Label>New file</Label>
              <Description>Create a new file</Description>
            </div>
            <Kbd className="ms-auto" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>N</Kbd.Content>
            </Kbd>
          </ListBox.Item>
          <ListBox.Item id="edit-file" textValue="Edit file">
            <div className="flex h-8 items-start justify-center pt-px">
              <Pencil className="size-4 shrink-0 text-muted" />
            </div>
            <div className="flex flex-col">
              <Label>Edit file</Label>
              <Description>Make changes</Description>
            </div>
            <Kbd className="ms-auto" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>E</Kbd.Content>
            </Kbd>
          </ListBox.Item>
        </ListBox.Section>
        <Separator />
        <ListBox.Section>
          <Header>Danger zone</Header>
          <ListBox.Item id="delete-file" textValue="Delete file" variant="danger">
            <div className="flex h-8 items-start justify-center pt-px">
              <TrashBin className="size-4 shrink-0 text-danger" />
            </div>
            <div className="flex flex-col">
              <Label>Delete file</Label>
              <Description>Move to trash</Description>
            </div>
            <Kbd className="ms-auto" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Abbr keyValue="shift" />
              <Kbd.Content>D</Kbd.Content>
            </Kbd>
          </ListBox.Item>
        </ListBox.Section>
      </ListBox>
    </Surface>
  );
}

```

### Multi Select

```tsx
import {Avatar, Description, Label, ListBox, Surface} from "@heroui/react";

export function MultiSelect() {
  return (
    <Surface className="w-[256px] rounded-3xl shadow-surface">
      <ListBox aria-label="Users" selectionMode="multiple">
        <ListBox.Item id="1" textValue="Bob">
          <Avatar size="sm">
            <Avatar.Image
              alt="Bob"
              src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg"
            />
            <Avatar.Fallback>B</Avatar.Fallback>
          </Avatar>
          <div className="flex flex-col">
            <Label>Bob</Label>
            <Description>bob@heroui.com</Description>
          </div>
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Item id="2" textValue="Fred">
          <Avatar size="sm">
            <Avatar.Image
              alt="Fred"
              src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg"
            />
            <Avatar.Fallback>F</Avatar.Fallback>
          </Avatar>
          <div className="flex flex-col">
            <Label>Fred</Label>
            <Description>fred@heroui.com</Description>
          </div>
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Item id="3" textValue="Martha">
          <Avatar size="sm">
            <Avatar.Image
              alt="Martha"
              src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg"
            />
            <Avatar.Fallback>M</Avatar.Fallback>
          </Avatar>
          <div className="flex flex-col">
            <Label>Martha</Label>
            <Description>martha@heroui.com</Description>
          </div>
          <ListBox.ItemIndicator />
        </ListBox.Item>
      </ListBox>
    </Surface>
  );
}

```

### Controlled

```tsx
"use client";

import type {Selection} from "@heroui/react";

import {Check} from "@gravity-ui/icons";
import {Avatar, Description, Label, ListBox, Surface} from "@heroui/react";
import {useState} from "react";

export function Controlled() {
  const [selected, setSelected] = useState<Selection>(new Set(["1"]));

  const selectedItems = Array.from(selected);

  return (
    <div className="space-y-4">
      <Surface className="w-[256px] rounded-3xl shadow-surface">
        <ListBox
          aria-label="Users"
          selectedKeys={selected}
          selectionMode="multiple"
          onSelectionChange={setSelected}
        >
          <ListBox.Item id="1" textValue="Bob">
            <Avatar size="sm">
              <Avatar.Image
                alt="Bob"
                src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg"
              />
              <Avatar.Fallback>B</Avatar.Fallback>
            </Avatar>
            <div className="flex flex-col">
              <Label>Bob</Label>
              <Description>bob@heroui.com</Description>
            </div>
            <ListBox.ItemIndicator>
              {({isSelected}) =>
                isSelected ? <Check className="size-4 text-accent-soft-foreground" /> : null
              }
            </ListBox.ItemIndicator>
          </ListBox.Item>
          <ListBox.Item id="2" textValue="Fred">
            <Avatar size="sm">
              <Avatar.Image
                alt="Fred"
                src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg"
              />
              <Avatar.Fallback>F</Avatar.Fallback>
            </Avatar>
            <div className="flex flex-col">
              <Label>Fred</Label>
              <Description>fred@heroui.com</Description>
            </div>
            <ListBox.ItemIndicator>
              {({isSelected}) =>
                isSelected ? <Check className="size-4 text-accent-soft-foreground" /> : null
              }
            </ListBox.ItemIndicator>
          </ListBox.Item>
          <ListBox.Item id="3" textValue="Martha">
            <Avatar size="sm">
              <Avatar.Image
                alt="Martha"
                src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg"
              />
              <Avatar.Fallback>M</Avatar.Fallback>
            </Avatar>
            <div className="flex flex-col">
              <Label>Martha</Label>
              <Description>martha@heroui.com</Description>
            </div>
            <ListBox.ItemIndicator>
              {({isSelected}) =>
                isSelected ? <Check className="size-4 text-accent-soft-foreground" /> : null
              }
            </ListBox.ItemIndicator>
          </ListBox.Item>
        </ListBox>
      </Surface>
      <p className="text-sm text-muted">
        Selected: {selectedItems.length > 0 ? selectedItems.join(", ") : "None"}
      </p>
    </div>
  );
}

```

### Virtualization

ListBox supports virtualization through [Virtualizer](https://react-aria.adobe.com/Virtualizer), enabling efficient rendering of large datasets by displaying only the rows visible within the viewport.

```tsx
"use client";

import {Description, Label, ListBox, ListLayout, Virtualizer} from "@heroui/react";

interface User {
  id: number;
  name: string;
  email: string;
}

export function Virtualization() {
  const firstNames = [
    "Emma",
    "Liam",
    "Olivia",
    "Noah",
    "Ava",
    "James",
    "Sophia",
    "Oliver",
    "Isabella",
    "Lucas",
    "Mia",
    "Ethan",
    "Charlotte",
    "Mason",
    "Amelia",
    "Logan",
    "Harper",
    "Alexander",
    "Ella",
    "Benjamin",
  ];

  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Anderson",
    "Taylor",
    "Thomas",
    "Jackson",
    "White",
    "Harris",
    "Clark",
    "Lewis",
    "Robinson",
    "Walker",
  ];

  function generateUsers(n: number): User[] {
    const users: User[] = [];

    for (let i = 0; i < n; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
      const name = `${firstName} ${lastName}`;

      users.push({
        email: `${firstName?.toLowerCase()}.${lastName?.toLowerCase()}@acme.com`,
        id: i + 1,
        name,
      });
    }

    return users;
  }

  const users = generateUsers(1000);

  return (
    <Virtualizer layout={ListLayout} layoutOptions={{rowHeight: 50}}>
      <ListBox
        aria-label="Virtualized list with 1000 items"
        className="h-[400px] w-[300px] overflow-y-auto"
        items={users}
      >
        {(user) => (
          <ListBox.Item id={user.id} textValue={user.name}>
            <div className="flex flex-col">
              <Label>{user.name}</Label>
              <Description>{user.email}</Description>
            </div>
            <ListBox.ItemIndicator />
          </ListBox.Item>
        )}
      </ListBox>
    </Virtualizer>
  );
}

```

### Custom Check Icon

```tsx
"use client";

import {Check} from "@gravity-ui/icons";
import {Avatar, Description, Label, ListBox, Surface} from "@heroui/react";

export function CustomCheckIcon() {
  return (
    <Surface className="w-[256px] rounded-3xl shadow-surface">
      <ListBox aria-label="Users" selectionMode="multiple">
        <ListBox.Item id="1" textValue="Bob">
          <Avatar size="sm">
            <Avatar.Image
              alt="Bob"
              src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg"
            />
            <Avatar.Fallback>B</Avatar.Fallback>
          </Avatar>
          <div className="flex flex-col">
            <Label>Bob</Label>
            <Description>bob@heroui.com</Description>
          </div>
          <ListBox.ItemIndicator>
            {({isSelected}) =>
              isSelected ? <Check className="size-4 text-accent-soft-foreground" /> : null
            }
          </ListBox.ItemIndicator>
        </ListBox.Item>
        <ListBox.Item id="2" textValue="Fred">
          <Avatar size="sm">
            <Avatar.Image
              alt="Fred"
              src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg"
            />
            <Avatar.Fallback>F</Avatar.Fallback>
          </Avatar>
          <div className="flex flex-col">
            <Label>Fred</Label>
            <Description>fred@heroui.com</Description>
          </div>
          <ListBox.ItemIndicator>
            {({isSelected}) =>
              isSelected ? <Check className="size-4 text-accent-soft-foreground" /> : null
            }
          </ListBox.ItemIndicator>
        </ListBox.Item>
        <ListBox.Item id="3" textValue="Martha">
          <Avatar size="sm">
            <Avatar.Image
              alt="Martha"
              src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg"
            />
            <Avatar.Fallback>M</Avatar.Fallback>
          </Avatar>
          <div className="flex flex-col">
            <Label>Martha</Label>
            <Description>martha@heroui.com</Description>
          </div>
          <ListBox.ItemIndicator>
            {({isSelected}) =>
              isSelected ? <Check className="size-4 text-accent-soft-foreground" /> : null
            }
          </ListBox.ItemIndicator>
        </ListBox.Item>
      </ListBox>
    </Surface>
  );
}

```

### Render Function

```tsx
"use client";

import {Avatar, Description, Label, ListBox} from "@heroui/react";

export function RenderFunction() {
  return (
    <ListBox
      aria-label="Users"
      className="w-[220px]"
      render={(props) => <div {...props} data-custom="true" />}
      selectionMode="single"
    >
      <ListBox.Item
        id="1"
        render={(props) => <span {...props} data-custom="foo" />}
        textValue="Bob"
      >
        <Avatar size="sm">
          <Avatar.Image
            alt="Bob"
            src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg"
          />
          <Avatar.Fallback>B</Avatar.Fallback>
        </Avatar>
        <div className="flex flex-col">
          <Label>Bob</Label>
          <Description>bob@heroui.com</Description>
        </div>
        <ListBox.ItemIndicator />
      </ListBox.Item>
      <ListBox.Item
        id="2"
        render={(props) => <span {...props} data-custom="bar" />}
        textValue="Fred"
      >
        <Avatar size="sm">
          <Avatar.Image
            alt="Fred"
            src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg"
          />
          <Avatar.Fallback>F</Avatar.Fallback>
        </Avatar>
        <div className="flex flex-col">
          <Label>Fred</Label>
          <Description>fred@heroui.com</Description>
        </div>
        <ListBox.ItemIndicator />
      </ListBox.Item>
      <ListBox.Item
        id="3"
        render={(props) => <span {...props} data-custom="baz" />}
        textValue="Martha"
      >
        <Avatar size="sm">
          <Avatar.Image
            alt="Martha"
            src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg"
          />
          <Avatar.Fallback>M</Avatar.Fallback>
        </Avatar>
        <div className="flex flex-col">
          <Label>Martha</Label>
          <Description>martha@heroui.com</Description>
        </div>
        <ListBox.ItemIndicator />
      </ListBox.Item>
    </ListBox>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {Avatar, Description, Label, ListBox} from "@heroui/react";

export function CustomStyles() {
  return (
    <ListBox
      aria-label="Assignee"
      className="w-56 rounded-xl border border-border/80 bg-surface p-1 shadow-sm"
      selectionMode="single"
    >
      <ListBox.Item
        className="rounded-lg data-[focused=true]:bg-accent/10 data-[selected=true]:bg-accent/5"
        id="1"
        textValue="Bob"
      >
        <Avatar size="sm">
          <Avatar.Image
            alt="Bob"
            src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg"
          />
          <Avatar.Fallback>B</Avatar.Fallback>
        </Avatar>
        <div className="flex flex-col">
          <Label>Bob</Label>
          <Description>bob@heroui.com</Description>
        </div>
        <ListBox.ItemIndicator />
      </ListBox.Item>
      <ListBox.Item
        className="rounded-lg data-[focused=true]:bg-accent/10 data-[selected=true]:bg-accent/5"
        id="2"
        textValue="Fred"
      >
        <Avatar size="sm">
          <Avatar.Image
            alt="Fred"
            src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg"
          />
          <Avatar.Fallback>F</Avatar.Fallback>
        </Avatar>
        <div className="flex flex-col">
          <Label>Fred</Label>
          <Description>fred@heroui.com</Description>
        </div>
        <ListBox.ItemIndicator />
      </ListBox.Item>
    </ListBox>
  );
}

```

### Global CSS

To customize the ListBox component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .list-box {
    @apply rounded-lg border border-border bg-surface p-2;
  }

  .list-box-item {
    @apply rounded px-2 py-1 cursor-pointer;
  }

  .list-box-item--danger {
    @apply text-danger;
  }

  .list-box-item__indicator {
    @apply text-accent;
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The ListBox component uses these CSS classes ([View source styles](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/list-box.css)):

#### Base Classes \[!toc]

* `.list-box` - Base listbox container
* `.list-box-item` - Individual listbox item
* `.list-box-item__indicator` - Selection indicator icon
* `.list-box-section` - Section container for grouping items

#### Variant Classes \[!toc]

* `.list-box--default` - Default variant styling
* `.list-box--danger` - Danger variant styling
* `.list-box-item--default` - Default item variant
* `.list-box-item--danger` - Danger item variant

#### State Classes \[!toc]

* `.list-box-item[data-selected="true"]` - Selected item state
* `.list-box-item[data-focus-visible="true"]` - Focused item state
* `.list-box-item[data-disabled="true"]` - Disabled item state
* `.list-box-item__indicator[data-visible="true"]` - Visible indicator state

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

* **Hover**: `:hover` or `[data-hovered="true"]` on item
* **Focus**: `:focus-visible` or `[data-focus-visible="true"]` on item
* **Selected**: `[data-selected="true"]` on item
* **Disabled**: `:disabled` or `[data-disabled="true"]` on item

## API Reference

### ListBox

| Prop                  | Type                                                                       | Default     | Description                                                      |
| --------------------- | -------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| `aria-label`          | `string`                                                                   | -           | Accessibility label for the listbox                              |
| `aria-labelledby`     | `string`                                                                   | -           | ID of element that labels the listbox                            |
| `selectionMode`       | `"none" \| "single" \| "multiple"`                                         | `"single"`  | Selection behavior                                               |
| `selectedKeys`        | `Selection`                                                                | -           | Controlled selected keys                                         |
| `defaultSelectedKeys` | `Selection`                                                                | -           | Initial selected keys                                            |
| `onSelectionChange`   | `(keys: Selection) => void`                                                | -           | Handler called when selection changes                            |
| `disabledKeys`        | `Iterable<Key>`                                                            | -           | Keys of disabled items                                           |
| `onAction`            | `(key: Key) => void`                                                       | -           | Handler called when an item is activated                         |
| `variant`             | `"default" \| "danger"`                                                    | `"default"` | Visual variant                                                   |
| `className`           | `string`                                                                   | -           | Additional CSS classes                                           |
| `children`            | `ReactNode`                                                                | -           | ListBox items and sections                                       |
| `render`              | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, ListBoxRenderProps>` | -           | Overrides the default DOM element with a custom render function. |

### ListBox.Item

| Prop         | Type                                                                                                                                                                                         | Default     | Description                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| `id`         | `Key`                                                                                                                                                                                        | -           | Unique identifier for the item                                   |
| `textValue`  | `string`                                                                                                                                                                                     | -           | Text value for accessibility and typeahead                       |
| `isDisabled` | `boolean`                                                                                                                                                                                    | `false`     | Whether this item is disabled                                    |
| `variant`    | `"default" \| "danger"`                                                                                                                                                                      | `"default"` | Visual variant                                                   |
| `className`  | `string`                                                                                                                                                                                     | -           | Additional CSS classes                                           |
| `children`   | `ReactNode \| RenderFunction`                                                                                                                                                                | -           | Item content or render function                                  |
| `render`     | `(props: DetailedHTMLProps<LinkWithRequiredHref, HTMLAnchorElement> \| React.JSX.IntrinsicElements[keyof React.JSX.IntrinsicElements], renderProps: ListBoxItemRenderProps) => ReactElement` | -           | Overrides the default DOM element with a custom render function. |

### ListBox.ItemIndicator

| Prop        | Type                          | Default | Description                                 |
| ----------- | ----------------------------- | ------- | ------------------------------------------- |
| `className` | `string`                      | -       | Additional CSS classes                      |
| `children`  | `ReactNode \| RenderFunction` | -       | Custom indicator content or render function |

### ListBox.Section

| Prop        | Type        | Default | Description                                |
| ----------- | ----------- | ------- | ------------------------------------------ |
| `className` | `string`    | -       | Additional CSS classes                     |
| `children`  | `ReactNode` | -       | Section content including Header and Items |

### Render Props

When using render functions with ListBox.Item or ListBox.ItemIndicator, these values are provided:

| Prop         | Type      | Description                       |
| ------------ | --------- | --------------------------------- |
| `isSelected` | `boolean` | Whether the item is selected      |
| `isFocused`  | `boolean` | Whether the item is focused       |
| `isDisabled` | `boolean` | Whether the item is disabled      |
| `isPressed`  | `boolean` | Whether the item is being pressed |

### ListLayout

| Name                     | Type                  | Default | Description                                                                                                                                                                       |
| ------------------------ | --------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rowHeight`              | `number \| undefined` | 48      | The fixed height of a row in px.                                                                                                                                                  |
| `estimatedRowHeight`     | `number \| undefined` | —       | The estimated height of a row, when row heights are variable.                                                                                                                     |
| `headingHeight`          | `number \| undefined` | 48      | The fixed height of a section header in px.                                                                                                                                       |
| `estimatedHeadingHeight` | `number \| undefined` | —       | The estimated height of a section header, when the height is variable.                                                                                                            |
| `loaderHeight`           | `number \| undefined` | 48      | The fixed height of a loader element in px. This loader is specifically for "load more" elements rendered when loading more rows at the root level or inside nested row/sections. |
| `dropIndicatorThickness` | `number \| undefined` | 2       | The thickness of the drop indicator.                                                                                                                                              |
| `gap`                    | `number \| undefined` | 0       | The gap between items.                                                                                                                                                            |
| `padding`                | `number \| undefined` | 0       | The padding around the list.                                                                                                                                                      |

## Accessibility

The ListBox component implements the ARIA listbox pattern and provides:

* Full keyboard navigation support
* Screen reader announcements for selection changes
* Proper focus management
* Support for disabled states
* Typeahead search functionality

For more information, see the [React Aria ListBox documentation](https://react-spectrum.adobe.com/react-aria/ListBox.html).

## Related Components

## Related Components

* **Select**: Dropdown select control
* **ComboBox**: Text input with searchable dropdown list
* **Avatar**: Display user profile images

</page>