import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Plus } from 'lucide-react';
import {
  Button,
  Label,
  ListBox,
  Select,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
} from '@heroui/react';
import { PosterCard } from '../components/PosterCard';
import { useTracker } from '../context/TrackerContext';
import { computeTitleState, resolveDisplayTitle } from '../domain/progress';
import { zh } from '../i18n/zh';

type StatusFilter = 'all' | 'watching' | 'unwatched' | 'completed' | 'paused_dropped';
type TypeFilter = 'all' | 'movie' | 'tv' | 'other';
type SortMode = 'recent' | 'added' | 'year' | 'name';

export const LibraryPage: React.FC = () => {
  const { loadingData, titles, seasonsByTitle, settings, getActiveProgress } = useTracker();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  const items = useMemo(() => {
    const all = Object.values(titles).map((title) => {
      const seasons = seasonsByTitle[title.id] || [];
      const progress = getActiveProgress(title);
      const state = computeTitleState(title, seasons, progress, {
        includeSpecials: settings.includeSpecials,
      });
      return { title, seasons, progress, state };
    });

    const filtered = all.filter(({ title, state }) => {
      if (typeFilter !== 'all' && title.mediaType !== typeFilter) {
        return false;
      }
      if (statusFilter === 'watching') {
        return state.status === 'watching' || state.status === 'caught_up';
      }
      if (statusFilter === 'unwatched') {
        return state.status === 'unwatched' || state.status === 'unaired';
      }
      if (statusFilter === 'completed') {
        return state.status === 'completed';
      }
      if (statusFilter === 'paused_dropped') {
        return state.status === 'paused' || state.status === 'dropped';
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortMode === 'recent') {
        return b.title.lastActivityAt - a.title.lastActivityAt;
      }
      if (sortMode === 'added') {
        return b.title.addedAt - a.title.addedAt;
      }
      if (sortMode === 'year') {
        return (b.title.year ?? 0) - (a.title.year ?? 0);
      }
      const nameA = resolveDisplayTitle(
        a.title.names,
        a.title.displayLang,
        settings.defaultTitleLang
      ).primary;
      const nameB = resolveDisplayTitle(
        b.title.names,
        b.title.displayLang,
        settings.defaultTitleLang
      ).primary;
      return nameA.localeCompare(nameB, 'zh-CN');
    });
  }, [
    titles,
    seasonsByTitle,
    getActiveProgress,
    settings.includeSpecials,
    settings.defaultTitleLang,
    statusFilter,
    typeFilter,
    sortMode,
  ]);

  const statusTabs: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: zh.library.filterStatus.all },
    { id: 'watching', label: zh.library.filterStatus.watching },
    { id: 'unwatched', label: zh.library.filterStatus.unwatched },
    { id: 'completed', label: zh.library.filterStatus.completed },
    { id: 'paused_dropped', label: zh.library.filterStatus.paused_dropped },
  ];

  const typeTabs: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: zh.library.filterType.all },
    { id: 'movie', label: zh.library.filterType.movie },
    { id: 'tv', label: zh.library.filterType.tv },
    { id: 'other', label: zh.library.filterType.other },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)]">
            {zh.library.title}
          </h1>
          <span className="text-xs sm:text-sm text-[var(--muted)] tabular-nums">
            {zh.library.countLabel(items.length)}
          </span>
        </div>

        <Button
          variant="primary"
          size="sm"
          onPress={() => navigate('/search')}
        >
          <Plus className="w-4 h-4" />
          <span>{zh.library.addMediaButton}</span>
        </Button>
      </header>

      {/* Filter & Sort Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[var(--separator)]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <ToggleButtonGroup
            selectionMode="single"
            disallowEmptySelection
            size="sm"
            selectedKeys={new Set([statusFilter])}
            onSelectionChange={(keys) => {
              const first = [...keys][0];
              if (first != null) setStatusFilter(String(first) as StatusFilter);
            }}
            aria-label={zh.library.statusFilterAria}
            className="flex-wrap"
          >
            {statusTabs.map((tab, index) => (
              <ToggleButton key={tab.id} id={tab.id}>
                {index > 0 && <ToggleButtonGroup.Separator />}
                {tab.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {/* Type filter */}
          <ToggleButtonGroup
            selectionMode="single"
            disallowEmptySelection
            size="sm"
            selectedKeys={new Set([typeFilter])}
            onSelectionChange={(keys) => {
              const first = [...keys][0];
              if (first != null) setTypeFilter(String(first) as TypeFilter);
            }}
            aria-label={zh.library.typeFilterAria}
            className="flex-wrap"
          >
            {typeTabs.map((tab, index) => (
              <ToggleButton key={tab.id} id={tab.id}>
                {index > 0 && <ToggleButtonGroup.Separator />}
                {tab.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>

        {/* Sort selector */}
        <Select
          variant="secondary"
          selectedKey={sortMode}
          onSelectionChange={(key) => {
            if (key !== null) setSortMode(String(key) as SortMode);
          }}
          className="flex-row items-center gap-2 self-start lg:self-auto"
        >
          <Label className="whitespace-nowrap">{zh.library.sortLabel}</Label>
          <Select.Trigger className="w-32">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="recent" textValue={zh.library.sort.recent}>
                <Label>{zh.library.sort.recent}</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="added" textValue={zh.library.sort.added}>
                <Label>{zh.library.sort.added}</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="year" textValue={zh.library.sort.year}>
                <Label>{zh.library.sort.year}</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="name" textValue={zh.library.sort.name}>
                <Label>{zh.library.sort.name}</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {/* Poster Grid: 3 columns on phone, 4-5 on tablet, 6-8 on desktop */}
      {loadingData ? (
        <div
          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3.5 sm:gap-5"
          aria-label={zh.library.loadingAria}
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[2/3] rounded-xl" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--surface-secondary)] flex items-center justify-center text-[var(--muted)] mx-auto">
            <Film className="w-6 h-6" />
          </div>
          <p className="text-sm text-[var(--muted)]">{zh.library.emptyFiltered}</p>
          {(statusFilter !== 'all' || typeFilter !== 'all') && (
            <Button
              variant="secondary"
              size="sm"
              onPress={() => {
                setStatusFilter('all');
                setTypeFilter('all');
              }}
            >
              {zh.library.clearFilters}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3.5 sm:gap-5">
          {items.map(({ title, seasons, progress }) => (
            <PosterCard
              key={title.id}
              title={title}
              seasons={seasons}
              progress={progress}
              defaultLang={settings.defaultTitleLang}
              includeSpecials={settings.includeSpecials}
            />
          ))}
        </div>
      )}
    </div>
  );
};
