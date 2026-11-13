import React from 'react';
import { Label, ListBox, ScrollShadow, Select, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { useI18n } from '../../i18n';

export const STATUS_FILTERS = ['all', 'watching', 'unwatched', 'completed', 'paused_dropped'] as const;
export const TYPE_FILTERS = ['all', 'movie', 'tv', 'other'] as const;
export const SORT_MODES = ['recent', 'added', 'year', 'name'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export type TypeFilter = (typeof TYPE_FILTERS)[number];
export type SortMode = (typeof SORT_MODES)[number];

interface LibraryFiltersProps {
  status: StatusFilter;
  type: TypeFilter;
  sort: SortMode;
  onStatusChange: (value: StatusFilter) => void;
  onTypeChange: (value: TypeFilter) => void;
  onSortChange: (value: SortMode) => void;
}

/** One segmented filter. It scrolls sideways instead of wrapping when the labels do not fit a phone. */
function Segments<T extends string>({
  value,
  options,
  labels,
  ariaLabel,
  onChange,
}: {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  ariaLabel: string;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollShadow orientation="horizontal" hideScrollBar size={28} className="max-w-full">
      <ToggleButtonGroup
        selectionMode="single"
        disallowEmptySelection
        size="sm"
        selectedKeys={new Set([value])}
        onSelectionChange={(keys) => {
          const first = [...keys][0];
          if (first != null) onChange(String(first) as T);
        }}
        aria-label={ariaLabel}
        className="shrink-0 flex-nowrap"
      >
        {options.map((option, index) => (
          <ToggleButton key={option} id={option} className="shrink-0 whitespace-nowrap">
            {index > 0 && <ToggleButtonGroup.Separator />}
            {labels[option]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </ScrollShadow>
  );
}

export const LibraryFilters: React.FC<LibraryFiltersProps> = ({
  status,
  type,
  sort,
  onStatusChange,
  onTypeChange,
  onSortChange,
}) => {
  const { t } = useI18n();
  return (
    <div className="flex min-w-0 flex-col justify-between gap-3 border-b border-separator pb-3 lg:flex-row lg:items-center">
      <div className="flex max-w-full min-w-0 flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Segments
          value={status}
          options={STATUS_FILTERS}
          labels={t.library.filterStatus}
          ariaLabel={t.library.statusFilterAria}
          onChange={onStatusChange}
        />
        <Segments
          value={type}
          options={TYPE_FILTERS}
          labels={t.library.filterType}
          ariaLabel={t.library.typeFilterAria}
          onChange={onTypeChange}
        />
      </div>

      <Select
        variant="secondary"
        selectedKey={sort}
        onSelectionChange={(key) => {
          if (key !== null) onSortChange(String(key) as SortMode);
        }}
        className="shrink-0 flex-row items-center gap-2 self-start lg:self-auto"
      >
        <Label className="whitespace-nowrap">{t.library.sortLabel}</Label>
        <Select.Trigger className="min-w-40">
          <Select.Value className="whitespace-nowrap" />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {SORT_MODES.map((mode) => (
              <ListBox.Item key={mode} id={mode} textValue={t.library.sort[mode]}>
                <Label>{t.library.sort[mode]}</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
};
