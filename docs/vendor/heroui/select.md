<page url="/en/docs/react/components/select">
# Select

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/select
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(pickers)/select.mdx
> A select displays a collapsible list of options and allows a user to select one of them


## Usage

```tsx
import { Select } from "@heroui/react";

```

```tsx
import {Label, ListBox, Select} from "@heroui/react";

export function Default() {
  return (
    <Select className="w-[256px]" placeholder="Select one">
      <Label>State</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="florida" textValue="Florida">
            Florida
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="delaware" textValue="Delaware">
            Delaware
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="california" textValue="California">
            California
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="texas" textValue="Texas">
            Texas
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="new-york" textValue="New York">
            New York
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="washington" textValue="Washington">
            Washington
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

```

## Anatomy

```tsx
import {Select, Label, Description, Header, ListBox, Separator} from "@heroui/react";

export default () => (
  <Select>
    <Label />
    <Select.Trigger>
      <Select.Value />
      <Select.ClearButton />
      <Select.Indicator />
    </Select.Trigger>
    <Description />
    <Select.Popover>
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
    </Select.Popover>
  </Select>
);

```

## Examples

### Variants

The Select component supports two visual variants:

* **`primary`** (default) - Standard styling with shadow, suitable for most use cases
* **`secondary`** - Lower emphasis variant without shadow, suitable for use in Surface components

```tsx
import {Label, ListBox, Select} from "@heroui/react";

export function Variants() {
  return (
    <div className="flex flex-col gap-4">
      <Select className="w-[256px]" placeholder="Select one" variant="primary">
        <Label>Primary variant</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="option1" textValue="Option 1">
              Option 1
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="option2" textValue="Option 2">
              Option 2
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
      <Select className="w-[256px]" placeholder="Select one" variant="secondary">
        <Label>Secondary variant</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="option1" textValue="Option 1">
              Option 1
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="option2" textValue="Option 2">
              Option 2
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}

```

### Full Width

```tsx
import {Label, ListBox, Select} from "@heroui/react";

export function FullWidth() {
  return (
    <div className="w-[400px] space-y-4">
      <Select fullWidth placeholder="Select one">
        <Label>Favorite Animal</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="cat" textValue="Cat">
              Cat
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="dog" textValue="Dog">
              Dog
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="bird" textValue="Bird">
              Bird
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}

```

### With Description

```tsx
import {Description, Label, ListBox, Select} from "@heroui/react";

export function WithDescription() {
  return (
    <Select className="w-[256px]" placeholder="Select one">
      <Label>State</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="florida" textValue="Florida">
            Florida
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="delaware" textValue="Delaware">
            Delaware
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="california" textValue="California">
            California
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="texas" textValue="Texas">
            Texas
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="new-york" textValue="New York">
            New York
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="washington" textValue="Washington">
            Washington
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
      <Description>Select your state of residence</Description>
    </Select>
  );
}

```

### Required

```tsx
"use client";

import {Button, FieldError, Form, Label, ListBox, Select} from "@heroui/react";

export function Required() {
  const onSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};

    // Convert FormData to plain object
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });

    alert("Form submitted successfully!");
  };

  return (
    <Form className="flex w-[256px] flex-col gap-4" onSubmit={onSubmit}>
      <Select isRequired className="w-full" name="state" placeholder="Select one">
        <Label>State</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="florida" textValue="Florida">
              Florida
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="delaware" textValue="Delaware">
              Delaware
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="california" textValue="California">
              California
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="texas" textValue="Texas">
              Texas
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="new-york" textValue="New York">
              New York
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="washington" textValue="Washington">
              Washington
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
        <FieldError />
      </Select>
      <Select isRequired className="w-full" name="country" placeholder="Select a country">
        <Label>Country</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="usa" textValue="United States">
              United States
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="canada" textValue="Canada">
              Canada
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="mexico" textValue="Mexico">
              Mexico
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="uk" textValue="United Kingdom">
              United Kingdom
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="france" textValue="France">
              France
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="germany" textValue="Germany">
              Germany
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
        <FieldError />
      </Select>
      <Button type="submit">Submit</Button>
    </Form>
  );
}

```

### Disabled

```tsx
import {Label, ListBox, Select} from "@heroui/react";

export function Disabled() {
  return (
    <div className="flex flex-col gap-4">
      <Select isDisabled className="w-[256px]" defaultValue="california" placeholder="Select one">
        <Label>State</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="florida" textValue="Florida">
              Florida
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="delaware" textValue="Delaware">
              Delaware
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="california" textValue="California">
              California
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="texas" textValue="Texas">
              Texas
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="new-york" textValue="New York">
              New York
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="washington" textValue="Washington">
              Washington
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
      <Select
        isDisabled
        className="w-[256px]"
        defaultValue={["argentina", "japan", "france"]}
        placeholder="Select countries"
        selectionMode="multiple"
      >
        <Label>Countries to Visit</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="argentina" textValue="Argentina">
              Argentina
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="venezuela" textValue="Venezuela">
              Venezuela
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="japan" textValue="Japan">
              Japan
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="france" textValue="France">
              France
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="italy" textValue="Italy">
              Italy
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="spain" textValue="Spain">
              Spain
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}

```

### With Disabled Options

```tsx
import {Label, ListBox, Select} from "@heroui/react";

export function WithDisabledOptions() {
  return (
    <Select className="w-[256px]" disabledKeys={["cat", "kangaroo"]} placeholder="Select an animal">
      <Label>Animal</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="dog" textValue="Dog">
            Dog
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="cat" textValue="Cat">
            Cat
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="bird" textValue="Bird">
            Bird
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="kangaroo" textValue="Kangaroo">
            Kangaroo
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="elephant" textValue="Elephant">
            Elephant
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="tiger" textValue="Tiger">
            Tiger
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

```

### Multiple Select

```tsx
import {Label, ListBox, Select} from "@heroui/react";

export function MultipleSelect() {
  return (
    <Select className="w-[256px]" placeholder="Select countries" selectionMode="multiple">
      <Label>Countries to Visit</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox selectionMode="multiple">
          <ListBox.Item id="argentina" textValue="Argentina">
            Argentina
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="venezuela" textValue="Venezuela">
            Venezuela
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="japan" textValue="Japan">
            Japan
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="france" textValue="France">
            France
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="italy" textValue="Italy">
            Italy
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="spain" textValue="Spain">
            Spain
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="thailand" textValue="Thailand">
            Thailand
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="new-zealand" textValue="New Zealand">
            New Zealand
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="iceland" textValue="Iceland">
            Iceland
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

```

### With Sections

```tsx
import {Header, Label, ListBox, Select, Separator} from "@heroui/react";

export function WithSections() {
  return (
    <Select className="w-[256px]" placeholder="Select a country">
      <Label>Country</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Section>
            <Header>North America</Header>
            <ListBox.Item id="usa" textValue="United States">
              United States
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="canada" textValue="Canada">
              Canada
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="mexico" textValue="Mexico">
              Mexico
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox.Section>
          <Separator />
          <ListBox.Section>
            <Header>Europe</Header>
            <ListBox.Item id="uk" textValue="United Kingdom">
              United Kingdom
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="france" textValue="France">
              France
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="germany" textValue="Germany">
              Germany
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="spain" textValue="Spain">
              Spain
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="italy" textValue="Italy">
              Italy
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox.Section>
          <Separator />
          <ListBox.Section>
            <Header>Asia</Header>
            <ListBox.Item id="japan" textValue="Japan">
              Japan
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="china" textValue="China">
              China
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="india" textValue="India">
              India
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="south-korea" textValue="South Korea">
              South Korea
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox.Section>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

```

### Controlled

```tsx
"use client";

import type {Key} from "@heroui/react";

import {Label, ListBox, Select} from "@heroui/react";
import {useState} from "react";

export function Controlled() {
  const states = [
    {
      id: "california",
      name: "California",
    },
    {
      id: "texas",
      name: "Texas",
    },
    {
      id: "florida",
      name: "Florida",
    },
    {
      id: "new-york",
      name: "New York",
    },
    {
      id: "illinois",
      name: "Illinois",
    },
    {
      id: "pennsylvania",
      name: "Pennsylvania",
    },
  ];

  const [state, setState] = useState<Key | null>("california");

  const selectedState = states.find((s) => s.id === state);

  return (
    <div className="space-y-2">
      <Select
        className="w-[256px]"
        placeholder="Select a state"
        value={state}
        onChange={(value) => setState(value)}
      >
        <Label>State (controlled)</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {states.map((state) => (
              <ListBox.Item key={state.id} id={state.id} textValue={state.name}>
                {state.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <p className="text-sm text-muted">Selected: {selectedState?.name || "None"}</p>
    </div>
  );
}

```

### Controlled Multiple

```tsx
"use client";

import type {Key} from "@heroui/react";

import {Label, ListBox, Select} from "@heroui/react";
import React from "react";

export function ControlledMultiple() {
  const [selected, setSelected] = React.useState<Key[]>(["california", "texas"]);

  return (
    <div className="space-y-4">
      <Select
        className="w-[256px]"
        placeholder="Select states"
        selectionMode="multiple"
        value={selected}
        onChange={(keys) => setSelected(keys as Key[])}
      >
        <Label>States (controlled multiple)</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox selectionMode="multiple">
            <ListBox.Item id="california" textValue="California">
              California
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="texas" textValue="Texas">
              Texas
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="florida" textValue="Florida">
              Florida
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="new-york" textValue="New York">
              New York
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="illinois" textValue="Illinois">
              Illinois
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="pennsylvania" textValue="Pennsylvania">
              Pennsylvania
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
      <p className="text-sm text-muted">
        Selected: {selected.length > 0 ? selected.join(", ") : "None"}
      </p>
    </div>
  );
}

```

### Controlled Open State

```tsx
"use client";

import {Button, Label, ListBox, Select} from "@heroui/react";
import {useState} from "react";

export function ControlledOpenState() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Select
        className="w-[256px]"
        isOpen={isOpen}
        placeholder="Select one"
        onOpenChange={setIsOpen}
      >
        <Label>State</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="florida" textValue="Florida">
              Florida
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="delaware" textValue="Delaware">
              Delaware
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="california" textValue="California">
              California
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="texas" textValue="Texas">
              Texas
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="new-york" textValue="New York">
              New York
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="washington" textValue="Washington">
              Washington
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
      <Button onPress={() => setIsOpen(!isOpen)}>{isOpen ? "Close" : "Open"} Select</Button>
      <p className="text-sm text-muted">Select is {isOpen ? "open" : "closed"}</p>
    </div>
  );
}

```

### Asynchronous Loading

```tsx
"use client";

import {Label, ListBox, Select, Spinner} from "@heroui/react";
import {useAsyncList} from "@react-stately/data";
import {Collection, ListBoxLoadMoreItem} from "react-aria-components";

interface Pokemon {
  name: string;
}

export function AsynchronousLoading() {
  const list = useAsyncList<Pokemon>({
    async load({cursor, signal}) {
      const res = await fetch(cursor || `https://pokeapi.co/api/v2/pokemon`, {signal});
      const json = await res.json();

      return {
        cursor: json.next,
        items: json.results,
      };
    },
  });

  return (
    <Select className="w-[256px]" placeholder="Select a Pokemon">
      <Label>Pick a Pokemon</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <Collection items={list.items}>
            {(item: Pokemon) => (
              <ListBox.Item id={item.name} textValue={item.name}>
                {item.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </Collection>
          <ListBoxLoadMoreItem
            isLoading={list.loadingState === "loadingMore"}
            onLoadMore={list.loadMore}
          >
            <div className="flex items-center justify-center gap-2 py-2">
              <Spinner size="sm" />
              <span className="text-sm text-muted">Loading more...</span>
            </div>
          </ListBoxLoadMoreItem>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

```

### Custom Indicator

```tsx
import {ChevronsExpandVertical} from "@gravity-ui/icons";
import {Label, ListBox, Select} from "@heroui/react";

export function CustomIndicator() {
  return (
    <Select className="w-[256px]" placeholder="Select one">
      <Label>State</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator className="size-3">
          <ChevronsExpandVertical />
        </Select.Indicator>
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="florida" textValue="Florida">
            Florida
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="delaware" textValue="Delaware">
            Delaware
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="california" textValue="California">
            California
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="texas" textValue="Texas">
            Texas
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="new-york" textValue="New York">
            New York
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="washington" textValue="Washington">
            Washington
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

```

### With Clear Button

`Select.Trigger` is a button, so a nested `<button>` cannot be used for clear. Compose `Select.ClearButton` inside the trigger instead — it renders as a non-button control and does not open the menu.

```tsx
import {Label, ListBox, Select} from "@heroui/react";

export function WithClearButton() {
  return (
    <Select className="w-[256px]" defaultValue="california" placeholder="Select one">
      <Label>State</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.ClearButton />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="florida" textValue="Florida">
            Florida
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="delaware" textValue="Delaware">
            Delaware
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="california" textValue="California">
            California
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="texas" textValue="Texas">
            Texas
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="new-york" textValue="New York">
            New York
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="washington" textValue="Washington">
            Washington
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

```

Because ARIA treats the children of a button as presentational, the clear control cannot take focus. It is therefore `aria-hidden` and acts as a pointer affordance only. When a `Select.ClearButton` is composed, the trigger also clears on `Backspace` or `Delete`, which is how keyboard and screen reader users clear the selection. Both paths call `onClear`.

### Custom Value

```tsx
"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Description,
  Label,
  ListBox,
  Select,
} from "@heroui/react";

export function CustomValue() {
  const users = [
    {
      avatarUrl: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/blue.jpg",
      email: "bob@heroui.com",
      fallback: "B",
      id: "1",
      name: "Bob",
    },
    {
      avatarUrl: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/green.jpg",
      email: "fred@heroui.com",
      fallback: "F",
      id: "2",
      name: "Fred",
    },
    {
      avatarUrl: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/purple.jpg",
      email: "martha@heroui.com",
      fallback: "M",
      id: "3",
      name: "Martha",
    },
    {
      avatarUrl: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/red.jpg",
      email: "john@heroui.com",
      fallback: "J",
      id: "4",
      name: "John",
    },
    {
      avatarUrl: "https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/orange.jpg",
      email: "jane@heroui.com",
      fallback: "J",
      id: "5",
      name: "Jane",
    },
  ];

  return (
    <Select className="w-[256px]" placeholder="Select a user">
      <Label>User</Label>
      <Select.Trigger>
        <Select.Value>
          {({defaultChildren, isPlaceholder, state}) => {
            if (isPlaceholder || state.selectedItems.length === 0) {
              return defaultChildren;
            }

            const selectedItems = state.selectedItems;

            if (selectedItems.length > 1) {
              return `${selectedItems.length} users selected`;
            }

            const selectedItem = users.find((user) => user.id === selectedItems[0]?.key);

            if (!selectedItem) {
              return defaultChildren;
            }

            return (
              <div className="flex items-center gap-2">
                <Avatar className="size-4" size="sm">
                  <AvatarImage src={selectedItem.avatarUrl} />
                  <AvatarFallback>{selectedItem.fallback}</AvatarFallback>
                </Avatar>
                <span>{selectedItem.name}</span>
              </div>
            );
          }}
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {users.map((user) => (
            <ListBox.Item key={user.id} id={user.id} textValue={user.name}>
              <Avatar size="sm">
                <AvatarImage src={user.avatarUrl} />
                <AvatarFallback>{user.fallback}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <Label>{user.name}</Label>
                <Description>{user.email}</Description>
              </div>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

```

### Render Function

```tsx
"use client";

import {Label, ListBox, Select} from "@heroui/react";

export function RenderFunction() {
  return (
    <Select
      className="w-[256px]"
      placeholder="Select one"
      render={(props) => <div {...props} data-custom="foo" />}
    >
      <Label>State</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="florida" textValue="Florida">
            Florida
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="delaware" textValue="Delaware">
            Delaware
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="california" textValue="California">
            California
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="texas" textValue="Texas">
            Texas
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="new-york" textValue="New York">
            New York
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="washington" textValue="Washington">
            Washington
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

```

### In Surface

When used inside a [Surface](/docs/react/components/surface) component, use `variant="secondary"` to apply the lower emphasis variant suitable for surface backgrounds.

```tsx
"use client";

import {Button, FieldError, Form, Label, ListBox, Select, Surface} from "@heroui/react";

export function OnSurface() {
  const onSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, string> = {};

    // Convert FormData to plain object
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });

    alert("Form submitted successfully!");
  };

  return (
    <Surface className="w-[320px] rounded-3xl p-6">
      <Form className="flex w-full flex-col gap-4" onSubmit={onSubmit}>
        <Select
          isRequired
          className="w-full"
          name="state"
          placeholder="Select one"
          variant="secondary"
        >
          <Label>State</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="florida" textValue="Florida">
                Florida
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="delaware" textValue="Delaware">
                Delaware
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="california" textValue="California">
                California
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="texas" textValue="Texas">
                Texas
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="new-york" textValue="New York">
                New York
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="washington" textValue="Washington">
                Washington
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
          <FieldError />
        </Select>
        <Select
          isRequired
          className="w-full"
          name="country"
          placeholder="Select a country"
          variant="secondary"
        >
          <Label>Country</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="usa" textValue="United States">
                United States
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="canada" textValue="Canada">
                Canada
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="mexico" textValue="Mexico">
                Mexico
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="uk" textValue="United Kingdom">
                United Kingdom
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="france" textValue="France">
                France
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="germany" textValue="Germany">
                Germany
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
          <FieldError />
        </Select>
        <Button type="submit">Submit</Button>
      </Form>
    </Surface>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {Label, ListBox, Select} from "@heroui/react";

const itemClass =
  "rounded-lg data-[focused=true]:bg-accent/10 data-[selected=true]:text-foreground";

export function CustomStyles() {
  return (
    <Select className="w-56" placeholder="Pick a plan" variant="secondary">
      <Label className="font-medium text-foreground">Plan</Label>
      <Select.Trigger className="rounded-xl bg-default">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="rounded-xl border border-border bg-surface p-1 shadow-lg">
        <ListBox>
          <ListBox.Item className={itemClass} id="free" textValue="Free">
            Free
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item className={itemClass} id="pro" textValue="Pro">
            Pro
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

```

### Global CSS

To customize the Select component classes, you can use the `@layer components` directive.

[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .select {
    @apply flex flex-col gap-1;
  }

  .select__trigger {
    @apply rounded-lg border border-border bg-surface p-2;
  }

  .select__value {
    @apply text-current;
  }

  .select__indicator {
    @apply text-muted;
  }

  .select__popover {
    @apply rounded-lg border border-border bg-surface p-2;
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Select component uses these CSS classes ([View source styles](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/select.css)):

#### Base Classes \[!toc]

* `.select` - Base select container
* `.select__trigger` - The button that triggers the select
* `.select__value` - The displayed value or placeholder
* `.select__clear-button` - The optional clear control inside the trigger
* `.select__indicator` - The dropdown indicator icon
* `.select__popover` - The popover container

#### Variant Classes \[!toc]

* `.select--primary` - Primary variant with shadow (default)
* `.select--secondary` - Secondary variant without shadow, suitable for use in surfaces

#### State Classes \[!toc]

* `.select[data-invalid="true"]` - Invalid state
* `.select__trigger[data-focus-visible="true"]` - Focused trigger state
* `.select__trigger[data-disabled="true"]` - Disabled trigger state
* `.select__value[data-placeholder="true"]` - Placeholder state
* `.select__clear-button[data-empty="true"]` - Clear button hidden when no selection
* `.select__indicator[data-open="true"]` - Open indicator state

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

* **Hover**: `:hover` or `[data-hovered="true"]` on trigger
* **Focus**: `:focus-visible` or `[data-focus-visible="true"]` on trigger
* **Disabled**: `:disabled` or `[data-disabled="true"]` on select
* **Open**: `[data-open="true"]` on indicator

## API Reference

### Select

| Prop            | Type                                                                      | Default            | Description                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `placeholder`   | `string`                                                                  | `'Select an item'` | Temporary text that occupies the select when it is empty                                                                                                           |
| `selectionMode` | `"single" \| "multiple"`                                                  | `"single"`         | Whether single or multiple selection is enabled                                                                                                                    |
| `isOpen`        | `boolean`                                                                 | -                  | Sets the open state of the menu (controlled)                                                                                                                       |
| `defaultOpen`   | `boolean`                                                                 | -                  | Sets the default open state of the menu (uncontrolled)                                                                                                             |
| `onOpenChange`  | `(isOpen: boolean) => void`                                               | -                  | Handler called when the open state changes                                                                                                                         |
| `disabledKeys`  | `Iterable<Key>`                                                           | -                  | Keys of disabled items                                                                                                                                             |
| `isDisabled`    | `boolean`                                                                 | -                  | Whether the select is disabled                                                                                                                                     |
| `value`         | `Key \| Key[] \| null`                                                    | -                  | Current value (controlled)                                                                                                                                         |
| `defaultValue`  | `Key \| Key[] \| null`                                                    | -                  | Default value (uncontrolled)                                                                                                                                       |
| `onChange`      | `(value: Key \| Key[] \| null) => void`                                   | -                  | Handler called when the value changes                                                                                                                              |
| `onClear`       | `() => void`                                                              | -                  | Handler called when the selection is cleared                                                                                                                       |
| `isRequired`    | `boolean`                                                                 | -                  | Whether user input is required                                                                                                                                     |
| `isInvalid`     | `boolean`                                                                 | -                  | Whether the select value is invalid                                                                                                                                |
| `name`          | `string`                                                                  | -                  | The name of the input, used when submitting an HTML form                                                                                                           |
| `autoComplete`  | `string`                                                                  | -                  | Describes the type of autocomplete functionality                                                                                                                   |
| `fullWidth`     | `boolean`                                                                 | `false`            | Whether the select should take full width of its container                                                                                                         |
| `variant`       | `"primary" \| "secondary"`                                                | `"primary"`        | Visual variant of the component. `primary` is the default style with shadow. `secondary` is a lower emphasis variant without shadow, suitable for use in surfaces. |
| `className`     | `string`                                                                  | -                  | Additional CSS classes                                                                                                                                             |
| `children`      | `ReactNode \| RenderFunction`                                             | -                  | Select content or render function                                                                                                                                  |
| `render`        | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, SelectRenderProps>` | -                  | Overrides the default DOM element with a custom render function.                                                                                                   |

### Select.Trigger

| Prop        | Type                          | Default | Description                        |
| ----------- | ----------------------------- | ------- | ---------------------------------- |
| `className` | `string`                      | -       | Additional CSS classes             |
| `children`  | `ReactNode \| RenderFunction` | -       | Trigger content or render function |

### Select.Value

| Prop        | Type                                                                           | Default | Description                                                      |
| ----------- | ------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------- |
| `className` | `string`                                                                       | -       | Additional CSS classes                                           |
| `children`  | `ReactNode \| RenderFunction`                                                  | -       | Value content or render function                                 |
| `render`    | `DOMRenderFunction<keyof React.JSX.IntrinsicElements, SelectValueRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

### Select.Indicator

| Prop        | Type        | Default | Description              |
| ----------- | ----------- | ------- | ------------------------ |
| `className` | `string`    | -       | Additional CSS classes   |
| `children`  | `ReactNode` | -       | Custom indicator content |

### Select.ClearButton

| Prop        | Type                      | Default | Description                                |
| ----------- | ------------------------- | ------- | ------------------------------------------ |
| `className` | `string`                  | -       | Additional CSS classes                     |
| `children`  | `ReactNode`               | -       | Custom content, replacing the default icon |
| `onClick`   | `(e: MouseEvent) => void` | -       | Handler called when the control is clicked |

`Select.ClearButton` renders as a `span` so it can live inside `Select.Trigger` (a button) without nesting buttons. It is visually hidden when the selection is empty.

### Select.Popover

| Prop        | Type                                                                                                                                                                                                                                                                                                                     | Default    | Description                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------ |
| `placement` | `"bottom" \| "bottom left" \| "bottom right" \| "bottom start" \| "bottom end" \| "top" \| "top left" \| "top right" \| "top start" \| "top end" \| "left" \| "left top" \| "left bottom" \| "start" \| "start top" \| "start bottom" \| "right" \| "right top" \| "right bottom" \| "end" \| "end top" \| "end bottom"` | `"bottom"` | Placement of the popover relative to the trigger |
| `className` | `string`                                                                                                                                                                                                                                                                                                                 | -          | Additional CSS classes                           |
| `children`  | `ReactNode`                                                                                                                                                                                                                                                                                                              | -          | Content children                                 |

### Render Props

When using render functions with Select.Value, these values are provided:

| Prop              | Type          | Description                        |
| ----------------- | ------------- | ---------------------------------- |
| `defaultChildren` | `ReactNode`   | The default rendered value         |
| `isPlaceholder`   | `boolean`     | Whether the value is a placeholder |
| `state`           | `SelectState` | The state of the select            |
| `selectedItems`   | `Node[]`      | The currently selected items       |

## Accessibility

The Select component implements the ARIA listbox pattern and provides:

* Full keyboard navigation support
* Screen reader announcements for selection changes
* Proper focus management
* Support for disabled states
* Typeahead search functionality
* HTML form integration

For more information, see the [React Aria Select documentation](https://react-spectrum.adobe.com/react-aria/Select.html).

## Related Components

## Related Components

* **Listbox**: Scrollable list of selectable items
* **Popover**: Displays content in context with a trigger
* **Label**: Accessible label for form controls

</page>