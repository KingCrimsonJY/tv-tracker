import React, { useDeferredValue, useMemo, useState } from 'react';
import { Button, Skeleton } from '@heroui/react';
import { CheckCheck, Film, ListChecks, Plus } from 'lucide-react';
import { ButtonLink } from '../components/ButtonLink';
import { useTracker } from '../context/TrackerContext';
import { selectProgressByTitle, selectSeasonsByTitle, selectSettings, selectTitles } from '../data/selectors';
import { useTrackerState } from '../data/useTrackerState';
import { computeTitleState, resolveDisplayTitle } from '../domain/progress';
import { NO_SEASONS } from '../domain/stableRefs';
import type { TitleStatusCode } from '../domain/types';
import { BatchActionBar } from '../features/library/BatchActionBar';
import { LibraryFilters, type SortMode, type StatusFilter, type TypeFilter } from '../features/library/LibraryFilters';
import { LibraryCard } from '../features/library/LibraryCard';
import { useLibrarySelection } from '../features/library/useLibrarySelection';
import { useI18n } from '../i18n';
import { usePageTitle } from '../hooks/usePageTitle';

const STATUS_GROUPS: Record<Exclude<StatusFilter, 'all'>, readonly TitleStatusCode[]> = {
  watching: ['watching', 'caught_up'],
  unwatched: ['unwatched', 'unaired', 'unreleased'],
  completed: ['completed'],
  paused_dropped: ['paused', 'dropped'],
};

export const LibraryPage: React.FC = () => {
  const { loadingData } = useTracker();
  // The grid renders from deferred copies of the data, so a change that touches many titles at once (a
  // batch, a backup import, another device) re-renders in interruptible slices instead of one long task.
  const titles = useDeferredValue(useTrackerState(selectTitles));
  const seasonsByTitle = useDeferredValue(useTrackerState(selectSeasonsByTitle));
  const progressByTitle = useDeferredValue(useTrackerState(selectProgressByTitle));
  const settings = useTrackerState(selectSettings);
  const { locale, t } = useI18n();
  usePageTitle(t.library.title);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  const items = useMemo(() => {
    const displayName = (item: { title: (typeof titles)[string] }) =>
      resolveDisplayTitle(item.title.names, item.title.displayLang, settings.defaultTitleLang, locale).primary;
    return Object.values(titles)
      .map((title) => ({
        title,
        seasons: seasonsByTitle[title.id] ?? NO_SEASONS,
        progress: progressByTitle[title.id]?.[title.activePlaythroughId],
      }))
      .filter(({ title, seasons, progress }) => {
        if (typeFilter !== 'all' && title.mediaType !== typeFilter) return false;
        if (statusFilter === 'all') return true;
        const { status } = computeTitleState(title, seasons, progress, { includeSpecials: settings.includeSpecials });
        return STATUS_GROUPS[statusFilter].includes(status);
      })
      .sort((a, b) => {
        if (sortMode === 'recent') return b.title.lastActivityAt - a.title.lastActivityAt;
        if (sortMode === 'added') return b.title.addedAt - a.title.addedAt;
        if (sortMode === 'year') return (b.title.year ?? 0) - (a.title.year ?? 0);
        return displayName(a).localeCompare(displayName(b), locale);
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

  const visibleIds = useMemo(() => items.map((item) => item.title.id), [items]);
  const selection = useLibrarySelection(visibleIds);
  const { isSelecting } = selection;
  // The header and the action bar react at once; the grid follows in an interruptible render, so switching
  // modes or selecting everything in a large library never blocks input.
  const gridSelecting = useDeferredValue(isSelecting);
  const gridSelectedIds = useDeferredValue(selection.selectedIds);
  const gridSelected = useMemo(() => new Set(gridSelectedIds), [gridSelectedIds]);
  const isFiltered = statusFilter !== 'all' || typeFilter !== 'all';

  return (
    <div className={`px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 space-y-6 ${isSelecting ? 'pb-20' : ''}`}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t.library.title}</h1>
          <span className="text-xs sm:text-sm text-muted tabular-nums">{t.library.countLabel(items.length)}</span>
        </div>

        <div className="flex items-center gap-2">
          {isSelecting && (
            <Button
              variant="secondary"
              size="sm"
              isDisabled={items.length === 0}
              onPress={selection.allSelected ? selection.clear : selection.selectAll}
            >
              <CheckCheck className="size-4" />
              {selection.allSelected ? t.library.batch.deselectAll : t.library.batch.selectAll}
            </Button>
          )}
          {/* One button for entering and leaving, so keyboard focus stays put across the switch. */}
          <Button
            variant={isSelecting ? 'primary' : 'secondary'}
            size="sm"
            isDisabled={!isSelecting && items.length === 0}
            onPress={isSelecting ? selection.stop : selection.start}
          >
            {!isSelecting && <ListChecks className="size-4" />}
            {isSelecting ? t.library.batch.done : t.library.batch.select}
          </Button>
          {!isSelecting && (
            <ButtonLink to="/search" variant="primary" size="sm">
              <Plus className="size-4" />
              <span>{t.library.addMediaButton}</span>
            </ButtonLink>
          )}
        </div>
      </header>

      <LibraryFilters
        status={statusFilter}
        type={typeFilter}
        sort={sortMode}
        onStatusChange={setStatusFilter}
        onTypeChange={setTypeFilter}
        onSortChange={setSortMode}
      />

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
          {isFiltered && (
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
        <div
          className="poster-grid"
          {...(gridSelecting ? { role: 'group', 'aria-label': t.library.batch.gridAria } : {})}
        >
          {items.map(({ title, seasons, progress }) => (
            <LibraryCard
              key={title.id}
              title={title}
              seasons={seasons}
              progress={progress}
              defaultLang={settings.defaultTitleLang}
              includeSpecials={settings.includeSpecials}
              isSelecting={gridSelecting}
              isSelected={gridSelecting && gridSelected.has(title.id)}
              onToggle={selection.toggle}
            />
          ))}
        </div>
      )}

      {isSelecting && <BatchActionBar selectedIds={selection.selectedIds} onFinished={selection.stop} />}
    </div>
  );
};
