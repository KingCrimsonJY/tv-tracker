import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, Film, Layers, ListOrdered, Pin, Plus } from 'lucide-react';
import { Button, Modal, ProgressBar } from '@heroui/react';
import { MediaImage } from '../components/MediaImage';
import { useTracker } from '../context/TrackerContext';
import { computeListProgress, sortListEntries } from '../domain/ordering';
import type { ListEntryDoc, ListKind, ProgressDoc, TitleDoc } from '../domain/types';
import { zh } from '../i18n/zh';

export const ListsPage: React.FC = () => {
  const {
    titles,
    seasonsByTitle,
    lists,
    entriesByList,
    settings,
    getActiveProgress,
    createList,
  } = useTracker();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ListKind>('ordered');
  const [description, setDescription] = useState('');
  const [pinned, setPinned] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);

  const sortedLists = Object.values(lists).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.rank < b.rank ? -1 : 1;
  });

  const progressByTitleMap: Record<string, ProgressDoc | undefined> = {};
  for (const t of Object.values(titles)) {
    progressByTitleMap[t.id] = getActiveProgress(t);
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('请输入列表名称');
      return;
    }
    const created = await createList({
      name: name.trim(),
      kind,
      description: description.trim() || undefined,
      pinned,
    });
    setName('');
    setDescription('');
    setCreateOpen(false);
    navigate(`/lists/${created.id}`);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {zh.lists.title}
          </h1>
          <span className="text-xs sm:text-sm text-[#9ca3af] tabular-nums">
            共 {sortedLists.length} 个
          </span>
        </div>

        <Button
          variant="primary"
          size="sm"
          onPress={() => setCreateOpen(true)}
          className="gap-1.5 font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>{zh.lists.createList}</span>
        </Button>
      </header>

      {sortedLists.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-[#1a1a1f] p-10 text-center max-w-lg mx-auto my-8 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#3b82f6]/15 text-[#60a5fa] flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-white">{zh.lists.emptyListsTitle}</h2>
          <p className="text-sm text-[#9ca3af] leading-relaxed">
            {zh.lists.emptyListsDescription}
          </p>
          <Button variant="primary" onPress={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            <span>{zh.lists.createList}</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedLists.map((list) => {
            const rawEntries = entriesByList[list.id] || [];
            const hydrated = rawEntries
              .map((entry) => ({ entry, title: titles[entry.titleId] }))
              .filter(
                (item): item is { entry: ListEntryDoc; title: TitleDoc } =>
                  Boolean(item.title)
              );

            const sortedEntries = sortListEntries(
              hydrated,
              list.kind,
              list.collectionSort,
              settings.defaultTitleLang
            );

            const stats = computeListProgress(
              sortedEntries,
              seasonsByTitle,
              progressByTitleMap,
              { includeSpecials: settings.includeSpecials }
            );

            const collageTitles = sortedEntries.slice(0, 4).map((h) => h.title);
            const pct =
              stats.totalCount > 0
                ? Math.round((stats.completedCount / stats.totalCount) * 100)
                : 0;

            return (
              <Link
                key={list.id}
                to={`/lists/${list.id}`}
                className="group flex flex-col rounded-2xl border border-white/[0.07] bg-[#1a1a1f] hover:bg-[#202027] overflow-hidden transition-colors"
              >
                {/* 4-Poster Collage */}
                <div className="grid grid-cols-4 gap-1 p-3 bg-[#151519] border-b border-white/[0.05]">
                  {[0, 1, 2, 3].map((slot) => {
                    const item = collageTitles[slot];
                    return (
                      <div
                        key={slot}
                        className="aspect-[2/3] rounded-lg overflow-hidden bg-[#1e1e24] border border-white/[0.05]"
                      >
                        {item ? (
                          <MediaImage
                            src={item.posterPath}
                            alt={item.names.zh || item.names.original}
                            aspect="poster"
                            mediaType={item.mediaType}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/10">
                            <Film className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Card Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#9ca3af]">
                      <span className="flex items-center gap-1.5 font-medium text-[#60a5fa]">
                        {list.kind === 'ordered' ? (
                          <ListOrdered className="w-3.5 h-3.5" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {list.kind === 'ordered'
                            ? zh.lists.orderedType
                            : zh.lists.collectionType}
                        </span>
                      </span>

                      {list.pinned && (
                        <span className="flex items-center gap-1 text-[#9ca3af]">
                          <Pin className="w-3 h-3" />
                          <span>{zh.lists.pinnedBadge}</span>
                        </span>
                      )}
                    </div>

                    <h2 className="text-base font-semibold text-white group-hover:text-[#60a5fa] transition-colors truncate">
                      {list.name}
                    </h2>

                    {list.description && (
                      <p className="text-xs text-[#9ca3af] line-clamp-1">
                        {list.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#9ca3af] tabular-nums">
                      <span>共 {stats.totalCount} 部作品</span>
                      <span>
                        已看 {stats.completedCount}/{stats.totalCount}
                      </span>
                    </div>

                    <ProgressBar
                      aria-label={`${list.name} 进度`}
                      value={pct}
                      size="sm"
                      className="w-full"
                    >
                      <ProgressBar.Track className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <ProgressBar.Fill className="h-full bg-[#3b82f6] rounded-full" />
                      </ProgressBar.Track>
                    </ProgressBar>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create List Modal */}
      <Modal.Backdrop isOpen={createOpen} onOpenChange={setCreateOpen} isDismissable>
        <Modal.Container size="md" placement="center">
          <Modal.Dialog className="bg-[#1e1e24] border border-white/10 rounded-2xl p-6 text-white outline-none">
            <Modal.Header>
              <Modal.Heading className="text-lg font-semibold">
                {zh.lists.createModal.title}
              </Modal.Heading>
            </Modal.Header>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="new-list-name" className="block text-xs text-[#9ca3af]">
                  {zh.lists.createModal.nameLabel}
                </label>
                <input
                  id="new-list-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError(null);
                  }}
                  placeholder={zh.lists.createModal.namePlaceholder}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#141418] border border-white/10 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
                />
                {nameError && <p className="text-xs text-red-400">{nameError}</p>}
              </div>

              <div className="space-y-2">
                <span className="block text-xs text-[#9ca3af]">
                  {zh.lists.createModal.kindLabel}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setKind('ordered')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      kind === 'ordered'
                        ? 'bg-[#3b82f6]/15 border-[#3b82f6] text-white'
                        : 'bg-[#141418] border-white/10 text-[#9ca3af]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <ListOrdered className="w-4 h-4 text-[#60a5fa]" />
                      <span>{zh.lists.orderedType}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#9ca3af] leading-snug">
                      按顺序编号排列，自动高亮下一部待看
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setKind('collection')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      kind === 'collection'
                        ? 'bg-[#3b82f6]/15 border-[#3b82f6] text-white'
                        : 'bg-[#141418] border-white/10 text-[#9ca3af]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Bookmark className="w-4 h-4 text-[#60a5fa]" />
                      <span>{zh.lists.collectionType}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#9ca3af] leading-snug">
                      海报墙视图，支持多种排序与手动拖拽
                    </p>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="new-list-desc" className="block text-xs text-[#9ca3af]">
                  {zh.lists.createModal.descriptionLabel}
                </label>
                <input
                  id="new-list-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={zh.lists.createModal.descriptionPlaceholder}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#141418] border border-white/10 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#3b82f6]"
                />
                <span className="text-sm text-[#d1d5db]">
                  {zh.lists.createModal.pinnedLabel}
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onPress={() => setCreateOpen(false)}
                >
                  {zh.lists.createModal.cancel}
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  {zh.lists.createModal.submit}
                </Button>
              </div>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
};
