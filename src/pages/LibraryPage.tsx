import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, Plus } from 'lucide-react';
import { Button } from '@heroui/react';
import { PosterCard } from '../components/PosterCard';
import { useTracker } from '../context/TrackerContext';
import { computeTitleState, resolveDisplayTitle } from '../domain/progress';
import { zh } from '../i18n/zh';

type StatusFilter = 'all' | 'watching' | 'unwatched' | 'completed' | 'paused_dropped';
type TypeFilter = 'all' | 'movie' | 'tv' | 'other';
type SortMode = 'recent' | 'added' | 'year' | 'name';

export const LibraryPage: React.FC = () => {
  const { titles, seasonsByTitle, settings, getActiveProgress } = useTracker();
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {zh.library.title}
          </h1>
          <span className="text-xs sm:text-sm text-[#9ca3af] tabular-nums">
            共 {items.length} 部
          </span>
        </div>

        <Button
          variant="primary"
          size="sm"
          onPress={() => navigate('/search')}
          className="gap-1.5 font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>添加影视</span>
        </Button>
      </header>

      {/* Filter & Sort Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-white/[0.06]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status segmented control */}
          <div
            role="group"
            aria-label="按观看状态筛选"
            className="inline-flex items-center p-1 rounded-xl bg-[#1a1a1f] border border-white/[0.06] overflow-x-auto max-w-full"
          >
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-[#3b82f6] text-white'
                    : 'text-[#9ca3af] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Type segmented control */}
          <div
            role="group"
            aria-label="按影视类型筛选"
            className="inline-flex items-center p-1 rounded-xl bg-[#1a1a1f] border border-white/[0.06]"
          >
            {typeTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  typeFilter === tab.id
                    ? 'bg-white/[0.12] text-white'
                    : 'text-[#9ca3af] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <label htmlFor="library-sort" className="text-xs text-[#9ca3af] whitespace-nowrap">
            排序方式
          </label>
          <select
            id="library-sort"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="h-9 px-3 rounded-xl bg-[#1a1a1f] border border-white/[0.08] text-xs font-medium text-white focus:outline-none focus:border-[#3b82f6]"
          >
            <option value="recent">{zh.library.sort.recent}</option>
            <option value="added">{zh.library.sort.added}</option>
            <option value="year">{zh.library.sort.year}</option>
            <option value="name">{zh.library.sort.name}</option>
          </select>
        </div>
      </div>

      {/* Poster Grid: 3 columns on phone, 4-5 on tablet, 6-8 on desktop */}
      {items.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center text-[#9ca3af] mx-auto">
            <Film className="w-6 h-6" />
          </div>
          <p className="text-sm text-[#9ca3af]">{zh.library.emptyFiltered}</p>
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
