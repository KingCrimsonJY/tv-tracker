import React, { useMemo, useState } from 'react';
import type { AppStateSnapshot } from '../domain/types';
import { NO_SEASONS } from '../domain/stableRefs';
import { ButtonLink } from '../components/ButtonLink';
import { Film, Plus } from 'lucide-react';
import { Button, ScrollShadow, Label, ListBox, Select, Skeleton, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { PosterCard } from '../components/PosterCard';
import { useTracker } from '../context/TrackerContext';
import { computeTitleState, resolveDisplayTitle } from '../domain/progress';
import { useI18n } from '../i18n';

type StatusFilter = 'all' | 'watching' | 'unwatched' | 'completed' | 'paused_dropped';
type TypeFilter = 'all' | 'movie' | 'tv' | 'other';
type SortMode = 'recent' | 'added' | 'year' | 'name';

const selectLibraryData = (state: AppStateSnapshot) => [
  state.titles,
  state.seasonsByTitle,
  state.progressByTitle,
  state.settings,
];

export const LibraryPage: React.FC = () => {
  const { loadingData, titles, seasonsByTitle, settings, progressByTitle } = useTracker(selectLibraryData);
  const { locale, t } = useI18n();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  const items = useMemo(() => {
    const all = Object.values(titles).map((title) => {
      const seasons = seasonsByTitle[title.id] ?? NO_SEASONS;
      const progress = progressByTitle[title.id]?.[title.activePlaythroughId];
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
        return state.status === 'unwatched' || state.status === 'unaired' || state.status === 'unreleased';
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
      const nameA = resolveDisplayTitle(a.title.names, a.title.displayLang, settings.defaultTitleLang, locale).primary;
      const nameB = resolveDisplayTitle(b.title.names, b.title.displayLang, settings.defaultTitleLang, locale).primary;
      return nameA.localeCompare(nameB, locale);
    });
  }, [
    titles,
    seasonsByTitle,
    progressByTitle,
    settings.includeSpecials,
    settings.defaultTitleLang,
    locale,
    statusFilter,
    typeFilter,
    sortMode,
  ]);

  const statusTabs: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: t.library.filterStatus.all },
    { id: 'watching', label: t.library.filterStatus.watching },
    { id: 'unwatched', label: t.library.filterStatus.unwatched },
    { id: 'completed', label: t.library.filterStatus.completed },
    { id: 'paused_dropped', label: t.library.filterStatus.paused_dropped },
  ];

  const typeTabs: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: t.library.filterType.all },
    { id: 'movie', label: t.library.filterType.movie },
    { id: 'tv', label: t.library.filterType.tv },
    { id: 'other', label: t.library.filterType.other },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t.library.title}</h1>
          <span className="text-xs sm:text-sm text-muted tabular-nums">{t.library.countLabel(items.length)}</span>
        </div>

        <ButtonLink to="/search" variant="primary" size="sm">
          <Plus className="w-4 h-4" />
          <span>{t.library.addMediaButton}</span>
        </ButtonLink>
      </header>

      {/* Filter & Sort Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-separator min-w-0">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 min-w-0 max-w-full">
          {/* Status filter */}
          <ScrollShadow orientation="horizontal" hideScrollBar size={28} className="max-w-full">
            <ToggleButtonGroup
              selectionMode="single"
              disallowEmptySelection
              size="sm"
              selectedKeys={new Set([statusFilter])}
              onSelectionChange={(keys) => {
                const first = [...keys][0];
                if (first != null) setStatusFilter(String(first) as StatusFilter);
              }}
              aria-label={t.library.statusFilterAria}
            >
              {statusTabs.map((tab, index) => (
                <ToggleButton key={tab.id} id={tab.id}>
                  {index > 0 && <ToggleButtonGroup.Separator />}
                  {tab.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </ScrollShadow>

          {/* Type filter */}
          <ScrollShadow orientation="horizontal" hideScrollBar size={28} className="max-w-full">
            <ToggleButtonGroup
              selectionMode="single"
              disallowEmptySelection
              size="sm"
              selectedKeys={new Set([typeFilter])}
              onSelectionChange={(keys) => {
                const first = [...keys][0];
                if (first != null) setTypeFilter(String(first) as TypeFilter);
              }}
              aria-label={t.library.typeFilterAria}
            >
              {typeTabs.map((tab, index) => (
                <ToggleButton key={tab.id} id={tab.id}>
                  {index > 0 && <ToggleButtonGroup.Separator />}
                  {tab.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </ScrollShadow>
        </div>

        {/* Sort selector */}
        <Select
          variant="secondary"
          selectedKey={sortMode}
          onSelectionChange={(key) => {
            if (key !== null) setSortMode(String(key) as SortMode);
          }}
          className="flex-row items-center gap-2 self-start lg:self-auto shrink-0"
        >
          <Label className="whitespace-nowrap">{t.library.sortLabel}</Label>
          <div className="inline-grid grid-cols-1 items-center">
            <div
              aria-hidden="true"
              className="invisible pointer-events-none col-start-1 row-start-1 flex flex-col pl-3 pr-9 text-sm font-normal whitespace-nowrap"
            >
              <span className="h-0 overflow-hidden">{t.library.sort.recent}</span>
              <span className="h-0 overflow-hidden">{t.library.sort.added}</span>
              <span className="h-0 overflow-hidden">{t.library.sort.year}</span>
              <span className="h-0 overflow-hidden">{t.library.sort.name}</span>
            </div>
            <Select.Trigger className="col-start-1 row-start-1 w-full">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
          </div>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="recent" textValue={t.library.sort.recent}>
                <Label>{t.library.sort.recent}</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="added" textValue={t.library.sort.added}>
                <Label>{t.library.sort.added}</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="year" textValue={t.library.sort.year}>
                <Label>{t.library.sort.year}</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="name" textValue={t.library.sort.name}>
                <Label>{t.library.sort.name}</Label>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {/* Poster Grid: 3 columns on phone, 4-5 on tablet, 6-8 on desktop */}
      {loadingData ? (
        <div className="poster-grid" aria-label={t.library.loadingAria}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[2/3] rounded-xl" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-surface-secondary flex items-center justify-center text-muted mx-auto">
            <Film className="w-6 h-6" />
          </div>
          <p className="text-sm text-muted">{t.library.emptyFiltered}</p>
          {(statusFilter !== 'all' || typeFilter !== 'all') && (
            <Button
              variant="secondary"
              size="sm"
              onPress={() => {
                setStatusFilter('all');
                setTypeFilter('all');
              }}
            >
              {t.library.clearFilters}
            </Button>
          )}
        </div>
      ) : (
        <div className="poster-grid">
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
