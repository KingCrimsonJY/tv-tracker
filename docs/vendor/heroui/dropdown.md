<page url="/en/docs/react/components/dropdown">
# Dropdown

**Category**: react
**URL**: https://heroui.com/en/docs/react/components/dropdown
**Source**: https://raw.githubusercontent.com/heroui-inc/heroui/refs/heads/v3/apps/docs/content/docs/en/react/components/(collections)/dropdown.mdx
> A dropdown displays a list of actions or options that a user can choose


## Usage

```tsx
import { Dropdown } from '@heroui/react';

```

```tsx
"use client";

import {Button, Dropdown, Label} from "@heroui/react";

export function Default() {
  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Actions
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={(key) => console.log(`Selected: ${key}`)}>
          <Dropdown.Item id="new-file" textValue="New file">
            <Label>New file</Label>
          </Dropdown.Item>
          <Dropdown.Item id="copy-link" textValue="Copy link">
            <Label>Copy link</Label>
          </Dropdown.Item>
          <Dropdown.Item id="edit-file" textValue="Edit file">
            <Label>Edit file</Label>
          </Dropdown.Item>
          <Dropdown.Item id="delete-file" textValue="Delete file" variant="danger">
            <Label>Delete file</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

```

## Anatomy

```tsx
import { Dropdown, Button, Label, Description, Header, Kbd, Separator } from '@heroui/react';

export default () => (
  <Dropdown>
    <Dropdown.Trigger>
      <Button />
    </Dropdown.Trigger>
    <Dropdown.Popover>
      <Dropdown.Menu>
        <Dropdown.Item>
          <Label />
          <Description />
          <Kbd slot="keyboard" />
          <Dropdown.ItemIndicator />
        </Dropdown.Item>
        <Separator />
        <Dropdown.Section>
          <Header />
          <Dropdown.Item />
        </Dropdown.Section>
        <Dropdown.SubmenuTrigger>
          <Dropdown.Item>
            <Label />
            <Dropdown.SubmenuIndicator />
          </Dropdown.Item>
          <Dropdown.Popover>
            <Dropdown.Menu>
              <Dropdown.Item />
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.SubmenuTrigger>
      </Dropdown.Menu>
    </Dropdown.Popover>
  </Dropdown>
)

```

## Examples

### With Icons

```tsx
"use client";

import {FloppyDisk, FolderOpen, SquarePlus, TrashBin} from "@gravity-ui/icons";
import {Button, Dropdown, Kbd, Label} from "@heroui/react";

export function WithIcons() {
  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Actions
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={(key) => console.log(`Selected: ${key}`)}>
          <Dropdown.Item id="new-file" textValue="New file">
            <SquarePlus className="size-4 shrink-0 text-muted" />
            <Label>New file</Label>
            <Kbd className="ms-auto" slot="keyboard" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>N</Kbd.Content>
            </Kbd>
          </Dropdown.Item>
          <Dropdown.Item id="open-file" textValue="Open file">
            <FolderOpen className="size-4 shrink-0 text-muted" />
            <Label>Open file</Label>
            <Kbd className="ms-auto" slot="keyboard" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>O</Kbd.Content>
            </Kbd>
          </Dropdown.Item>
          <Dropdown.Item id="save-file" textValue="Save file">
            <FloppyDisk className="size-4 shrink-0 text-muted" />
            <Label>Save file</Label>
            <Kbd className="ms-auto" slot="keyboard" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>S</Kbd.Content>
            </Kbd>
          </Dropdown.Item>
          <Dropdown.Item id="delete-file" textValue="Delete file" variant="danger">
            <TrashBin className="size-4 shrink-0 text-danger" />
            <Label>Delete file</Label>
            <Kbd className="ms-auto" slot="keyboard" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Abbr keyValue="shift" />
              <Kbd.Content>D</Kbd.Content>
            </Kbd>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

```

### With Descriptions

```tsx
"use client";

import {FloppyDisk, FolderOpen, SquarePlus, TrashBin} from "@gravity-ui/icons";
import {Button, Description, Dropdown, Kbd, Label} from "@heroui/react";

export function WithDescriptions() {
  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Actions
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={(key) => console.log(`Selected: ${key}`)}>
          <Dropdown.Item id="new-file" textValue="New file">
            <div className="flex h-8 items-start justify-center pt-px">
              <SquarePlus className="size-4 shrink-0 text-muted" />
            </div>
            <div className="flex flex-col">
              <Label>New file</Label>
              <Description>Create a new file</Description>
            </div>
            <Kbd className="ms-auto" slot="keyboard" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>N</Kbd.Content>
            </Kbd>
          </Dropdown.Item>
          <Dropdown.Item id="open-file" textValue="Open file">
            <div className="flex h-8 items-start justify-center pt-px">
              <FolderOpen className="size-4 shrink-0 text-muted" />
            </div>
            <div className="flex flex-col">
              <Label>Open file</Label>
              <Description>Open an existing file</Description>
            </div>
            <Kbd className="ms-auto" slot="keyboard" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>O</Kbd.Content>
            </Kbd>
          </Dropdown.Item>
          <Dropdown.Item id="save-file" textValue="Save file">
            <div className="flex h-8 items-start justify-center pt-px">
              <FloppyDisk className="size-4 shrink-0 text-muted" />
            </div>
            <div className="flex flex-col">
              <Label>Save file</Label>
              <Description>Save the current file</Description>
            </div>
            <Kbd className="ms-auto" slot="keyboard" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>S</Kbd.Content>
            </Kbd>
          </Dropdown.Item>
          <Dropdown.Item id="delete-file" textValue="Delete file" variant="danger">
            <div className="flex h-8 items-start justify-center pt-px">
              <TrashBin className="size-4 shrink-0 text-danger" />
            </div>
            <div className="flex flex-col">
              <Label>Delete file</Label>
              <Description>Move to trash</Description>
            </div>
            <Kbd className="ms-auto" slot="keyboard" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Abbr keyValue="shift" />
              <Kbd.Content>D</Kbd.Content>
            </Kbd>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

```

### With Disabled Items

```tsx
"use client";

import {Bars, Pencil, SquarePlus, TrashBin} from "@gravity-ui/icons";
import {Button, Description, Dropdown, Header, Kbd, Label, Separator} from "@heroui/react";

export function WithDisabledItems() {
  return (
    <Dropdown>
      <Button isIconOnly aria-label="Menu" variant="secondary">
        <Bars className="outline-none" />
      </Button>
      <Dropdown.Popover className="min-w-[220px]">
        <Dropdown.Menu
          disabledKeys={["delete-file"]}
          onAction={(key) => console.log(`Selected: ${key}`)}
        >
          <Dropdown.Section>
            <Header>Actions</Header>
            <Dropdown.Item id="new-file" textValue="New file">
              <div className="flex h-8 items-start justify-center pt-px">
                <SquarePlus className="size-4 shrink-0 text-muted" />
              </div>
              <div className="flex flex-col">
                <Label>New file</Label>
                <Description>Create a new file</Description>
              </div>
              <Kbd className="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>N</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
            <Dropdown.Item id="edit-file" textValue="Edit file">
              <div className="flex h-8 items-start justify-center pt-px">
                <Pencil className="size-4 shrink-0 text-muted" />
              </div>
              <div className="flex flex-col">
                <Label>Edit file</Label>
                <Description>Make changes</Description>
              </div>
              <Kbd className="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>E</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
          </Dropdown.Section>
          <Separator />
          <Dropdown.Section>
            <Header>Danger zone</Header>
            <Dropdown.Item id="delete-file" textValue="Delete file" variant="danger">
              <div className="flex h-8 items-start justify-center pt-px">
                <TrashBin className="size-4 shrink-0 text-danger" />
              </div>
              <div className="flex flex-col">
                <Label>Delete file</Label>
                <Description>Move to trash</Description>
              </div>
              <Kbd className="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Abbr keyValue="shift" />
                <Kbd.Content>D</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

```

### With Sections

```tsx
"use client";

import {EllipsisVertical, Pencil, SquarePlus, TrashBin} from "@gravity-ui/icons";
import {Button, Description, Dropdown, Header, Kbd, Label, Separator} from "@heroui/react";

export function WithSections() {
  return (
    <Dropdown>
      <Button isIconOnly aria-label="Menu" variant="secondary">
        <EllipsisVertical className="outline-none" />
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={(key) => console.log(`Selected: ${key}`)}>
          <Dropdown.Section>
            <Header>Actions</Header>
            <Dropdown.Item id="new-file" textValue="New file">
              <div className="flex h-8 items-start justify-center pt-px">
                <SquarePlus className="size-4 shrink-0 text-muted" />
              </div>
              <div className="flex flex-col">
                <Label>New file</Label>
                <Description>Create a new file</Description>
              </div>
              <Kbd className="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>N</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
            <Dropdown.Item id="edit-file" textValue="Edit file">
              <div className="flex h-8 items-start justify-center pt-px">
                <Pencil className="size-4 shrink-0 text-muted" />
              </div>
              <div className="flex flex-col">
                <Label>Edit file</Label>
                <Description>Make changes</Description>
              </div>
              <Kbd className="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>E</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
          </Dropdown.Section>
          <Separator />
          <Dropdown.Section>
            <Header>Danger zone</Header>
            <Dropdown.Item id="delete-file" textValue="Delete file" variant="danger">
              <div className="flex h-8 items-start justify-center pt-px">
                <TrashBin className="size-4 shrink-0 text-danger" />
              </div>
              <div className="flex flex-col">
                <Label>Delete file</Label>
                <Description>Move to trash</Description>
              </div>
              <Kbd className="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Abbr keyValue="shift" />
                <Kbd.Content>D</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

```

### With Multiple Selection

```tsx
"use client";

import type {Selection} from "@heroui/react";

import {Button, Dropdown, Header, Label} from "@heroui/react";
import {useState} from "react";

export function WithMultipleSelection() {
  const [selected, setSelected] = useState<Selection>(new Set(["apple"]));

  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Preferred Fruits
      </Button>
      <Dropdown.Popover className="min-w-[256px]">
        <Dropdown.Menu
          selectedKeys={selected}
          selectionMode="multiple"
          onSelectionChange={setSelected}
        >
          <Dropdown.Section>
            <Header>Select a fruit</Header>
            <Dropdown.Item id="apple" textValue="Apple">
              <Dropdown.ItemIndicator />
              <Label>Apple</Label>
            </Dropdown.Item>
            <Dropdown.Item id="banana" textValue="Banana">
              <Dropdown.ItemIndicator />
              <Label>Banana</Label>
            </Dropdown.Item>
            <Dropdown.Item id="cherry" textValue="Cherry">
              <Dropdown.ItemIndicator />
              <Label>Cherry</Label>
            </Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Item id="orange" textValue="Orange">
            <Dropdown.ItemIndicator />
            <Label>Orange</Label>
          </Dropdown.Item>
          <Dropdown.Item id="pear" textValue="Pear">
            <Dropdown.ItemIndicator />
            <Label>Pear</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

```

### Controlled

```tsx
"use client";

import type {Selection} from "@heroui/react";

import {Button, Dropdown, Label} from "@heroui/react";
import {useState} from "react";

export function Controlled() {
  const [selected, setSelected] = useState<Selection>(new Set(["bold"]));

  const selectedItems = Array.from(selected);

  return (
    <div className="flex min-w-sm flex-col items-center justify-center gap-4">
      <p className="text-sm text-muted">
        Selected: {selectedItems.length > 0 ? selectedItems.join(", ") : "None"}
      </p>
      <Dropdown>
        <Button aria-label="Menu" variant="secondary">
          Actions
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu
            selectedKeys={selected}
            selectionMode="multiple"
            onSelectionChange={setSelected}
          >
            <Dropdown.Item id="bold" textValue="Bold">
              <Label>Bold</Label>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
            <Dropdown.Item id="italic" textValue="Italic">
              <Label>Italic</Label>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
            <Dropdown.Item id="underline" textValue="Underline">
              <Label>Underline</Label>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}

```

### Controlled Open State

```tsx
"use client";

import {Button, Dropdown, Label} from "@heroui/react";
import {useState} from "react";

export function ControlledOpenState() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-w-sm flex-col items-center justify-center gap-4">
      <p className="text-sm text-muted">
        Dropdown is: <strong>{open ? "open" : "closed"}</strong>
      </p>
      <Dropdown isOpen={open} onOpenChange={setOpen}>
        <Button aria-label="Menu" variant="secondary">
          Actions
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu>
            <Dropdown.Item id="new-file" textValue="New file">
              <Label>New file</Label>
            </Dropdown.Item>
            <Dropdown.Item id="open-file" textValue="Open file">
              <Label>Open file</Label>
            </Dropdown.Item>
            <Dropdown.Item id="save-file" textValue="Save file">
              <Label>Save file</Label>
            </Dropdown.Item>
            <Dropdown.Item id="delete-file" textValue="Delete file" variant="danger">
              <Label>Delete file</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}

```

### With Single Selection

```tsx
"use client";

import type {Selection} from "@heroui/react";

import {Button, Dropdown, Header, Label} from "@heroui/react";
import {useState} from "react";

export function WithSingleSelection() {
  const [selected, setSelected] = useState<Selection>(new Set(["apple"]));

  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Fruit
      </Button>
      <Dropdown.Popover className="min-w-[256px]">
        <Dropdown.Menu
          selectedKeys={selected}
          selectionMode="single"
          onSelectionChange={setSelected}
        >
          <Dropdown.Section>
            <Header>Select a fruit</Header>
            <Dropdown.Item id="apple" textValue="Apple">
              <Dropdown.ItemIndicator />
              <Label>Apple</Label>
            </Dropdown.Item>
            <Dropdown.Item id="banana" textValue="Banana">
              <Dropdown.ItemIndicator />
              <Label>Banana</Label>
            </Dropdown.Item>
            <Dropdown.Item id="cherry" textValue="Cherry">
              <Dropdown.ItemIndicator />
              <Label>Cherry</Label>
            </Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Item id="orange" textValue="Orange">
            <Dropdown.ItemIndicator />
            <Label>Orange</Label>
          </Dropdown.Item>
          <Dropdown.Item id="pear" textValue="Pear">
            <Dropdown.ItemIndicator />
            <Label>Pear</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

```

### Single With Custom Indicator

```tsx
"use client";

import type {Selection} from "@heroui/react";

import {Button, Dropdown, Header, Label} from "@heroui/react";
import {useState} from "react";

export function SingleWithCustomIndicator() {
  const [selected, setSelected] = useState<Selection>(new Set(["apple"]));

  const CustomCheckmarkIcon = (
    <svg height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
      <path
        className="text-accent-soft-foreground"
        clipRule="evenodd"
        d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14m3.1-8.55a.75.75 0 1 0-1.2-.9L7.419 8.858L6.03 7.47a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.13-.08z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );

  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Fruits
      </Button>
      <Dropdown.Popover className="min-w-[256px]">
        <Dropdown.Menu
          selectedKeys={selected}
          selectionMode="single"
          onSelectionChange={setSelected}
        >
          <Dropdown.Section>
            <Header>Select a fruit</Header>
            <Dropdown.Item id="apple" textValue="Apple">
              <Dropdown.ItemIndicator>
                {({isSelected}) => (isSelected ? CustomCheckmarkIcon : null)}
              </Dropdown.ItemIndicator>
              <Label>Apple</Label>
            </Dropdown.Item>
            <Dropdown.Item id="banana" textValue="Banana">
              <Dropdown.ItemIndicator>
                {({isSelected}) => (isSelected ? CustomCheckmarkIcon : null)}
              </Dropdown.ItemIndicator>
              <Label>Banana</Label>
            </Dropdown.Item>
            <Dropdown.Item id="cherry" textValue="Cherry">
              <Dropdown.ItemIndicator>
                {({isSelected}) => (isSelected ? CustomCheckmarkIcon : null)}
              </Dropdown.ItemIndicator>
              <Label>Cherry</Label>
            </Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Item id="orange" textValue="Orange">
            <Dropdown.ItemIndicator>
              {({isSelected}) => (isSelected ? CustomCheckmarkIcon : null)}
            </Dropdown.ItemIndicator>
            <Label>Orange</Label>
          </Dropdown.Item>
          <Dropdown.Item id="pear" textValue="Pear">
            <Dropdown.ItemIndicator>
              {({isSelected}) => (isSelected ? CustomCheckmarkIcon : null)}
            </Dropdown.ItemIndicator>
            <Label>Pear</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

```

### With Section Level Selection

```tsx
"use client";

import type {Selection} from "@heroui/react";

import {Button, Dropdown, Header, Kbd, Label, Separator} from "@heroui/react";
import {useState} from "react";

export function WithSectionLevelSelection() {
  const [textStyles, setTextStyles] = useState<Selection>(new Set(["bold", "italic"]));
  const [textAlignment, setTextAlignment] = useState<Selection>(new Set(["left"]));

  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Styles
      </Button>
      <Dropdown.Popover className="min-w-[256px]">
        <Dropdown.Menu>
          <Dropdown.Section>
            <Header>Actions</Header>
            <Dropdown.Item id="cut" textValue="Cut">
              <Label>Cut</Label>
              <Kbd className="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>X</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
            <Dropdown.Item id="copy" textValue="Copy">
              <Label>Copy</Label>
              <Kbd className="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>C</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
            <Dropdown.Item id="paste" textValue="Paste">
              <Label>Paste</Label>
              <Kbd className="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>U</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
          </Dropdown.Section>
          <Separator />
          <Dropdown.Section
            selectedKeys={textStyles}
            selectionMode="multiple"
            onSelectionChange={setTextStyles}
          >
            <Header>Text Style</Header>
            <Dropdown.Item id="bold" textValue="Bold">
              <Dropdown.ItemIndicator />
              <Label>Bold</Label>
              <Kbd className="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>B</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
            <Dropdown.Item id="italic" textValue="Italic">
              <Dropdown.ItemIndicator />
              <Label>Italic</Label>
              <Kbd className="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>I</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
            <Dropdown.Item id="underline" textValue="Underline">
              <Dropdown.ItemIndicator />
              <Label>Underline</Label>
              <Kbd className="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>U</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
          </Dropdown.Section>
          <Separator />
          <Dropdown.Section
            selectedKeys={textAlignment}
            selectionMode="single"
            onSelectionChange={setTextAlignment}
          >
            <Header>Text Alignment</Header>
            <Dropdown.Item id="left" textValue="Left">
              <Dropdown.ItemIndicator type="dot" />
              <Label>Left</Label>
              <Kbd className="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="alt" />
                <Kbd.Content>A</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
            <Dropdown.Item id="center" textValue="Center">
              <Dropdown.ItemIndicator type="dot" />
              <Label>Center</Label>
              <Kbd className="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="alt" />
                <Kbd.Content>H</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
            <Dropdown.Item id="right" textValue="Right">
              <Dropdown.ItemIndicator type="dot" />
              <Label>Right</Label>
              <Kbd className="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="alt" />
                <Kbd.Content>D</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

```

### With Keyboard Shortcuts

```tsx
"use client";

import {Button, Dropdown, Kbd, Label} from "@heroui/react";

export function WithKeyboardShortcuts() {
  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Actions
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={(key) => console.log(`Selected: ${key}`)}>
          <Dropdown.Item id="new" textValue="New">
            <Label>New</Label>
            <Kbd className="ms-auto" slot="keyboard" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>N</Kbd.Content>
            </Kbd>
          </Dropdown.Item>
          <Dropdown.Item id="open" textValue="Open">
            <Label>Open</Label>
            <Kbd className="ms-auto" slot="keyboard" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>O</Kbd.Content>
            </Kbd>
          </Dropdown.Item>
          <Dropdown.Item id="save" textValue="Save">
            <Label>Save</Label>
            <Kbd className="ms-auto" slot="keyboard" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>S</Kbd.Content>
            </Kbd>
          </Dropdown.Item>
          <Dropdown.Item id="delete" textValue="Delete" variant="danger">
            <Label>Delete</Label>
            <Kbd className="ms-auto" slot="keyboard" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Abbr keyValue="shift" />
              <Kbd.Content>D</Kbd.Content>
            </Kbd>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

```

### With Submenus

```tsx
"use client";

import {Button, Dropdown, Label} from "@heroui/react";

export function WithSubmenus() {
  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Share
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={(key) => console.log(`Selected: ${key}`)}>
          <Dropdown.Item id="copy-link" textValue="Copy Link">
            <Label>Copy Link</Label>
          </Dropdown.Item>
          <Dropdown.Item id="facebook" textValue="Facebook">
            <Label>Facebook</Label>
          </Dropdown.Item>
          <Dropdown.Item id="twitter" textValue="Twitter">
            <Label>X / Twitter</Label>
          </Dropdown.Item>
          <Dropdown.SubmenuTrigger>
            <Dropdown.Item id="share" textValue="Share">
              <Label>Other</Label>
              <Dropdown.SubmenuIndicator />
            </Dropdown.Item>
            <Dropdown.Popover>
              <Dropdown.Menu>
                <Dropdown.Item id="whatsapp" textValue="WhatsApp">
                  <Label>WhatsApp</Label>
                </Dropdown.Item>
                <Dropdown.Item id="telegram" textValue="Telegram">
                  <Label>Telegram</Label>
                </Dropdown.Item>
                <Dropdown.Item id="discord" textValue="Discord">
                  <Label>Discord</Label>
                </Dropdown.Item>
                <Dropdown.SubmenuTrigger>
                  <Dropdown.Item id="email" textValue="Email">
                    <Label>Email</Label>
                    <Dropdown.SubmenuIndicator />
                  </Dropdown.Item>
                  <Dropdown.Popover>
                    <Dropdown.Menu>
                      <Dropdown.Item id="work" textValue="Work email">
                        <Label>Work email</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="personal" textValue="Personal email">
                        <Label>Personal email</Label>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown.SubmenuTrigger>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.SubmenuTrigger>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

```

### With Custom Submenu Indicator

```tsx
"use client";

import {ArrowRight} from "@gravity-ui/icons";
import {Button, Dropdown, Label} from "@heroui/react";

export function WithCustomSubmenuIndicator() {
  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Share
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={(key) => console.log(`Selected: ${key}`)}>
          <Dropdown.Item id="copy-link" textValue="Copy Link">
            <Label>Copy Link</Label>
          </Dropdown.Item>
          <Dropdown.Item id="facebook" textValue="Facebook">
            <Label>Facebook</Label>
          </Dropdown.Item>
          <Dropdown.SubmenuTrigger>
            <Dropdown.Item id="share" textValue="Share">
              <Label>More options</Label>
              <Dropdown.SubmenuIndicator>
                <ArrowRight className="size-3.5 text-muted" />
              </Dropdown.SubmenuIndicator>
            </Dropdown.Item>
            <Dropdown.Popover>
              <Dropdown.Menu>
                <Dropdown.Item id="whatsapp" textValue="WhatsApp">
                  <Label>WhatsApp</Label>
                </Dropdown.Item>
                <Dropdown.Item id="telegram" textValue="Telegram">
                  <Label>Telegram</Label>
                </Dropdown.Item>
                <Dropdown.SubmenuTrigger>
                  <Dropdown.Item id="email" textValue="Email">
                    <Label>Email</Label>
                    <Dropdown.SubmenuIndicator>
                      <svg
                        className="size-3.5 text-muted"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </Dropdown.SubmenuIndicator>
                  </Dropdown.Item>
                  <Dropdown.Popover>
                    <Dropdown.Menu>
                      <Dropdown.Item id="work" textValue="Work email">
                        <Label>Work email</Label>
                      </Dropdown.Item>
                      <Dropdown.Item id="personal" textValue="Personal email">
                        <Label>Personal email</Label>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown.SubmenuTrigger>
                <Dropdown.Item id="discord" textValue="Discord">
                  <Label>Discord</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.SubmenuTrigger>
          <Dropdown.SubmenuTrigger>
            <Dropdown.Item id="other" textValue="Other">
              <Label>Other (default indicator)</Label>
              <Dropdown.SubmenuIndicator />
            </Dropdown.Item>
            <Dropdown.Popover>
              <Dropdown.Menu>
                <Dropdown.Item id="sms" textValue="SMS">
                  <Label>SMS</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.SubmenuTrigger>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

```

### Custom Trigger

```tsx
import {ArrowRightFromSquare, Gear, Persons} from "@gravity-ui/icons";
import {Avatar, Dropdown, Label} from "@heroui/react";

export function CustomTrigger() {
  return (
    <Dropdown>
      <Dropdown.Trigger className="rounded-full">
        <Avatar>
          <Avatar.Image
            alt="Junior Garcia"
            src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/orange.jpg"
          />
          <Avatar.Fallback delayMs={600}>JD</Avatar.Fallback>
        </Avatar>
      </Dropdown.Trigger>
      <Dropdown.Popover>
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              <Avatar.Image
                alt="Jane"
                src="https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/orange.jpg"
              />
              <Avatar.Fallback delayMs={600}>JD</Avatar.Fallback>
            </Avatar>
            <div className="flex flex-col gap-0">
              <p className="text-sm leading-5 font-medium">Jane Doe</p>
              <p className="text-xs leading-none text-muted">jane@example.com</p>
            </div>
          </div>
        </div>
        <Dropdown.Menu>
          <Dropdown.Item id="dashboard" textValue="Dashboard">
            <Label>Dashboard</Label>
          </Dropdown.Item>
          <Dropdown.Item id="profile" textValue="Profile">
            <Label>Profile</Label>
          </Dropdown.Item>
          <Dropdown.Item id="settings" textValue="Settings">
            <div className="flex w-full items-center justify-between gap-2">
              <Label>Settings</Label>
              <Gear className="size-3.5 text-muted" />
            </div>
          </Dropdown.Item>
          <Dropdown.Item id="new-project" textValue="New project">
            <div className="flex w-full items-center justify-between gap-2">
              <Label>Create Team</Label>
              <Persons className="size-3.5 text-muted" />
            </div>
          </Dropdown.Item>
          <Dropdown.Item id="logout" textValue="Logout" variant="danger">
            <div className="flex w-full items-center justify-between gap-2">
              <Label>Log Out</Label>
              <ArrowRightFromSquare className="size-3.5 text-danger" />
            </div>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

```

### Long Press Trigger

```tsx
import {Button, Dropdown, Label} from "@heroui/react";

export function LongPressTrigger() {
  return (
    <Dropdown trigger="longPress">
      <Button aria-label="Menu" variant="secondary">
        Long Press
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu>
          <Dropdown.Item id="new-file" textValue="New file">
            <Label>New file</Label>
          </Dropdown.Item>
          <Dropdown.Item id="open-file" textValue="Open file">
            <Label>Open file</Label>
          </Dropdown.Item>
          <Dropdown.Item id="save-file" textValue="Save file">
            <Label>Save file</Label>
          </Dropdown.Item>
          <Dropdown.Item id="delete-file" textValue="Delete file" variant="danger">
            <Label>Delete file</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

```

## Customization

### Tailwind CSS

```tsx
import {Button, Dropdown, Label} from "@heroui/react";

export function CustomStyles() {
  return (
    <Dropdown>
      <Button variant="secondary">Actions</Button>
      <Dropdown.Popover className="rounded-xl border border-border/80 bg-surface p-1 shadow-sm">
        <Dropdown.Menu>
          <Dropdown.Item
            className="rounded-lg data-[focused=true]:bg-default"
            id="rename"
            textValue="Rename"
          >
            <Label>Rename</Label>
          </Dropdown.Item>
          <Dropdown.Item
            className="rounded-lg data-[focused=true]:bg-default"
            id="duplicate"
            textValue="Duplicate"
          >
            <Label>Duplicate</Label>
          </Dropdown.Item>
          <Dropdown.Item
            className="rounded-lg data-[focused=true]:bg-danger-soft"
            id="delete"
            textValue="Delete"
            variant="danger"
          >
            <Label>Delete</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

```

### Global CSS

To customize the Dropdown component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .dropdown {
    @apply flex flex-col gap-1;
  }

  .dropdown__trigger {
    @apply outline-none;
  }

  .dropdown__popover {
    @apply rounded-lg border border-border bg-overlay p-2;
  }

  .dropdown__menu {
    @apply flex flex-col gap-1;
  }
}

```

## Styling Reference

HeroUI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Dropdown component uses these CSS classes ([View source styles](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/dropdown.css)):

#### Base Classes \[!toc]

* `.dropdown` - Base dropdown container
* `.dropdown__trigger` - The button or element that triggers the dropdown
* `.dropdown__popover` - The popover container
* `.dropdown__menu` - The menu container inside the popover

#### State Classes \[!toc]

* `.dropdown__trigger[data-focus-visible="true"]` - Focused trigger state
* `.dropdown__trigger[data-disabled="true"]` - Disabled trigger state
* `.dropdown__trigger[data-pressed="true"]` - Pressed trigger state
* `.dropdown__popover[data-entering]` - Entering animation state
* `.dropdown__popover[data-exiting]` - Exiting animation state
* `.dropdown__menu[data-selection-mode="single"]` - Single selection mode
* `.dropdown__menu[data-selection-mode="multiple"]` - Multiple selection mode

### Menu Component Classes

The Dropdown component uses Menu, MenuItem, and MenuSection as base components. These classes are also available for customization:

#### Menu Classes \[!toc]

* `.menu` - Base menu container ([menu.css](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/menu.css))
  * `[data-slot="separator"]` - Separator elements within the menu

#### MenuItem Classes \[!toc]

* `.menu-item` - Base menu item container ([menu-item.css](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/menu-item.css))
* `.menu-item__indicator` - Selection indicator (checkmark or dot)
  * `[data-slot="menu-item-indicator--checkmark"]` - Checkmark indicator SVG
  * `[data-slot="menu-item-indicator--dot"]` - Dot indicator SVG
* `.menu-item__indicator--submenu` - Submenu indicator (chevron)
* `.menu-item--default` - Default variant styling
* `.menu-item--danger` - Danger variant styling

#### MenuItem State Classes \[!toc]

* `.menu-item[data-focus-visible="true"]` - Focused item state (keyboard focus)
* `.menu-item[data-focus="true"]` - Focused item state
* `.menu-item[data-pressed]` - Pressed item state
* `.menu-item[data-hovered]` - Hovered item state
* `.menu-item[data-selected="true"]` - Selected item state
* `.menu-item[data-disabled]` - Disabled item state
* `.menu-item[data-has-submenu="true"]` - Item with submenu
* `.menu-item[data-selection-mode="single"]` - Single selection mode
* `.menu-item[data-selection-mode="multiple"]` - Multiple selection mode
* `.menu-item[aria-checked="true"]` - Checked item (ARIA)
* `.menu-item[aria-selected="true"]` - Selected item (ARIA)

#### MenuSection Classes \[!toc]

* `.menu-section` - Base menu section container ([menu-section.css](https://github.com/heroui-inc/heroui/blob/v3/packages/styles/components/menu-section.css))

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

* **Hover**: `:hover` or `[data-hovered="true"]` on trigger and items
* **Focus**: `:focus-visible` or `[data-focus-visible="true"]` on trigger and items
* **Disabled**: `:disabled` or `[data-disabled="true"]` on trigger and items
* **Pressed**: `:active` or `[data-pressed="true"]` on trigger and items
* **Selected**: `[data-selected="true"]` or `[aria-selected="true"]` on items

## API Reference

### Dropdown

| Prop           | Type                        | Default   | Description                                            |
| -------------- | --------------------------- | --------- | ------------------------------------------------------ |
| `isOpen`       | `boolean`                   | -         | Sets the open state of the menu (controlled)           |
| `defaultOpen`  | `boolean`                   | -         | Sets the default open state of the menu (uncontrolled) |
| `onOpenChange` | `(isOpen: boolean) => void` | -         | Handler called when the open state changes             |
| `trigger`      | `"press" \| "longPress"`    | `"press"` | The type of interaction that triggers the menu         |
| `className`    | `string`                    | -         | Additional CSS classes                                 |
| `children`     | `ReactNode`                 | -         | Dropdown content                                       |

### Dropdown.Trigger

| Prop        | Type                          | Default | Description                        |
| ----------- | ----------------------------- | ------- | ---------------------------------- |
| `className` | `string`                      | -       | Additional CSS classes             |
| `children`  | `ReactNode \| RenderFunction` | -       | Trigger content or render function |

All [Button](https://react-spectrum.adobe.com/react-aria/Button.html) props are also supported when using a Button as the trigger.

### Dropdown.Popover

| Prop        | Type                                                                                                                                                                                                                                                                                                                     | Default    | Description                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------ |
| `placement` | `"bottom" \| "bottom left" \| "bottom right" \| "bottom start" \| "bottom end" \| "top" \| "top left" \| "top right" \| "top start" \| "top end" \| "left" \| "left top" \| "left bottom" \| "start" \| "start top" \| "start bottom" \| "right" \| "right top" \| "right bottom" \| "end" \| "end top" \| "end bottom"` | `"bottom"` | Placement of the popover relative to the trigger |
| `className` | `string`                                                                                                                                                                                                                                                                                                                 | -          | Additional CSS classes                           |
| `children`  | `ReactNode`                                                                                                                                                                                                                                                                                                              | -          | Content children                                 |

All [Popover](https://react-spectrum.adobe.com/react-aria/Popover.html) props are also supported.

### Dropdown.Menu

| Prop                  | Type                               | Default  | Description                                     |
| --------------------- | ---------------------------------- | -------- | ----------------------------------------------- |
| `selectionMode`       | `"single" \| "multiple" \| "none"` | `"none"` | Whether single or multiple selection is enabled |
| `selectedKeys`        | `Iterable<Key>`                    | -        | The currently selected keys (controlled)        |
| `defaultSelectedKeys` | `Iterable<Key>`                    | -        | The initial selected keys (uncontrolled)        |
| `onSelectionChange`   | `(keys: Selection) => void`        | -        | Handler called when the selection changes       |
| `disabledKeys`        | `Iterable<Key>`                    | -        | Keys of disabled items                          |
| `onAction`            | `(key: Key) => void`               | -        | Handler called when an item is activated        |
| `className`           | `string`                           | -        | Additional CSS classes                          |
| `children`            | `ReactNode`                        | -        | Menu content                                    |

All [Menu](https://react-spectrum.adobe.com/react-aria/Menu.html#menu) props are also supported.

### Dropdown.Section

| Prop                  | Type                        | Default | Description                                  |
| --------------------- | --------------------------- | ------- | -------------------------------------------- |
| `selectionMode`       | `"single" \| "multiple"`    | -       | Selection mode for items within this section |
| `selectedKeys`        | `Iterable<Key>`             | -       | The currently selected keys (controlled)     |
| `defaultSelectedKeys` | `Iterable<Key>`             | -       | The initial selected keys (uncontrolled)     |
| `onSelectionChange`   | `(keys: Selection) => void` | -       | Handler called when the selection changes    |
| `disabledKeys`        | `Iterable<Key>`             | -       | Keys of disabled items                       |
| `className`           | `string`                    | -       | Additional CSS classes                       |
| `children`            | `ReactNode`                 | -       | Section content                              |

All [MenuSection](https://react-spectrum.adobe.com/react-aria/Menu.html#menusection) props are also supported.

### Dropdown.Item

| Prop        | Type                          | Default     | Description                            |
| ----------- | ----------------------------- | ----------- | -------------------------------------- |
| `id`        | `Key`                         | -           | Unique identifier for the item         |
| `textValue` | `string`                      | -           | Text content of the item for typeahead |
| `variant`   | `"default" \| "danger"`       | `"default"` | Visual variant of the item             |
| `className` | `string`                      | -           | Additional CSS classes                 |
| `children`  | `ReactNode \| RenderFunction` | -           | Item content or render function        |

All [MenuItem](https://react-spectrum.adobe.com/react-aria/Menu.html#menuitem) props are also supported.

### Dropdown.ItemIndicator

| Prop        | Type                          | Default       | Description                                 |
| ----------- | ----------------------------- | ------------- | ------------------------------------------- |
| `type`      | `"checkmark" \| "dot"`        | `"checkmark"` | Type of indicator to display                |
| `className` | `string`                      | -             | Additional CSS classes                      |
| `children`  | `ReactNode \| RenderFunction` | -             | Custom indicator content or render function |

When using a render function, these values are provided:

| Prop              | Type      | Description                                   |
| ----------------- | --------- | --------------------------------------------- |
| `isSelected`      | `boolean` | Whether the item is selected                  |
| `isIndeterminate` | `boolean` | Whether the item is in an indeterminate state |

### Dropdown.SubmenuIndicator

| Prop        | Type        | Default | Description              |
| ----------- | ----------- | ------- | ------------------------ |
| `className` | `string`    | -       | Additional CSS classes   |
| `children`  | `ReactNode` | -       | Custom indicator content |

### Dropdown.SubmenuTrigger

| Prop        | Type        | Default | Description             |
| ----------- | ----------- | ------- | ----------------------- |
| `className` | `string`    | -       | Additional CSS classes  |
| `children`  | `ReactNode` | -       | Submenu trigger content |

All [SubmenuTrigger](https://react-spectrum.adobe.com/react-aria/Menu.html#submenutrigger) props are also supported.

### Render Props

When using render functions with Dropdown.Item, these values are provided:

| Prop         | Type      | Description                       |
| ------------ | --------- | --------------------------------- |
| `isSelected` | `boolean` | Whether the item is selected      |
| `isFocused`  | `boolean` | Whether the item is focused       |
| `isDisabled` | `boolean` | Whether the item is disabled      |
| `isPressed`  | `boolean` | Whether the item is being pressed |

## Accessibility

The Dropdown component implements the ARIA menu pattern and provides:

* Full keyboard navigation support (arrow keys, home/end, typeahead)
* Screen reader announcements for actions and selection changes
* Proper focus management
* Support for disabled states
* Long press interaction support
* Submenu navigation

For more information, see the [React Aria Menu documentation](https://react-spectrum.adobe.com/react-aria/Menu.html#menu).

## Related Components

## Related Components

* **Button**: Allows a user to perform an action
* **Popover**: Displays content in context with a trigger
* **Separator**: Visual divider between content

</page>