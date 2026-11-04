import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, Film, Layers, ListOrdered, Pin, Plus } from 'lucide-react';
import {
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  ProgressBar,
  Skeleton,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@heroui/react';
import { MediaImage } from '../components/MediaImage';
import { useTracker } from '../context/TrackerContext';
import { computeListProgress, sortListEntries } from '../domain/ordering';
import type { ListEntryDoc, ListKind, ProgressDoc, TitleDoc } from '../domain/types';
import { zh } from '../i18n/zh';

export const ListsPage: React.FC = () => {
  const {
    loadingData,
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
      setNameError(zh.lists.createModal.nameRequiredError);
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)]">
            {zh.lists.title}
          </h1>
          <span className="text-xs sm:text-sm text-[var(--muted)] tabular-nums">
            {zh.lists.countLabel(sortedLists.length)}
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

      {loadingData ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          aria-label={zh.lists.loadingAria}
        >
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              className="h-56 rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
            />
          ))}
        </div>
      ) : sortedLists.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center max-w-lg mx-auto my-8 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-text)] flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {zh.lists.emptyListsTitle}
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
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
                className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] overflow-hidden transition-colors"
              >
                {/* 4-Poster Collage */}
                <div className="grid grid-cols-4 gap-1 p-3 bg-[var(--surface-secondary)] border-b border-[var(--separator)]">
                  {[0, 1, 2, 3].map((slot) => {
                    const item = collageTitles[slot];
                    return (
                      <div
                        key={slot}
                        className="aspect-[2/3] rounded-lg overflow-hidden bg-[var(--surface)] border border-[var(--border)]"
                      >
                        {item ? (
                          <MediaImage
                            src={item.posterPath}
                            alt={item.names.zh || item.names.original}
                            aspect="poster"
                            mediaType={item.mediaType}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--muted)]/40">
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
                    <div className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
                      <span className="flex items-center gap-1.5 font-medium text-[var(--accent-text)]">
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
                        <span className="flex items-center gap-1 text-[var(--muted)]">
                          <Pin className="w-3 h-3" />
                          <span>{zh.lists.pinnedBadge}</span>
                        </span>
                      )}
                    </div>

                    <h2 className="text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--accent-text)] transition-colors truncate">
                      {list.name}
                    </h2>

                    {list.description && (
                      <p className="text-xs text-[var(--muted)] line-clamp-1">
                        {list.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-[var(--muted)] tabular-nums">
                      <span>{zh.lists.totalTitlesLabel(stats.totalCount)}</span>
                      <span>
                        {zh.lists.progressLabel(
                          stats.completedCount,
                          stats.totalCount
                        )}
                      </span>
                    </div>

                    <ProgressBar
                      aria-label={zh.lists.progressAria(list.name)}
                      value={pct}
                      size="sm"
                      className="w-full"
                    >
                      <ProgressBar.Track className="h-1 bg-[var(--surface-tertiary)] rounded-full overflow-hidden">
                        <ProgressBar.Fill className="h-full bg-[var(--accent)] rounded-full" />
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
          <Modal.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none">
            <Modal.Header>
              <Modal.Heading className="text-lg font-semibold">
                {zh.lists.createModal.title}
              </Modal.Heading>
            </Modal.Header>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <TextField
                value={name}
                onChange={(val) => {
                  setName(val);
                  setNameError(null);
                }}
                isInvalid={Boolean(nameError)}
                className="space-y-1.5"
              >
                <Label className="block text-xs text-[var(--muted)]">
                  {zh.lists.createModal.nameLabel}
                </Label>
                <Input
                  placeholder={zh.lists.createModal.namePlaceholder}
                  className="w-full h-10 px-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                />
                {nameError && <FieldError className="text-xs text-[var(--danger)]">{nameError}</FieldError>}
              </TextField>

              <div className="space-y-2">
                <span className="block text-xs text-[var(--muted)]">
                  {zh.lists.createModal.kindLabel}
                </span>
                <ToggleButtonGroup
                  selectionMode="single"
                  selectedKeys={new Set([kind])}
                  onSelectionChange={(keys) => {
                    const first = [...keys][0];
                    if (first != null) setKind(String(first) as ListKind);
                  }}
                  aria-label={zh.lists.createModal.kindLabel}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full"
                >
                  <ToggleButton
                    id="ordered"
                    className={`h-auto p-3 rounded-xl border text-left transition-colors flex flex-col items-start justify-start ${
                      kind === 'ordered'
                        ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--foreground)]'
                        : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--muted)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                      <ListOrdered className="w-4 h-4 text-[var(--accent-text)]" />
                      <span>{zh.lists.orderedType}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)] leading-snug font-normal">
                      {zh.lists.orderedTypeHint}
                    </p>
                  </ToggleButton>

                  <ToggleButton
                    id="collection"
                    className={`h-auto p-3 rounded-xl border text-left transition-colors flex flex-col items-start justify-start ${
                      kind === 'collection'
                        ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--foreground)]'
                        : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--muted)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                      <Bookmark className="w-4 h-4 text-[var(--accent-text)]" />
                      <span>{zh.lists.collectionType}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)] leading-snug font-normal">
                      {zh.lists.collectionTypeHint}
                    </p>
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>

              <TextField
                value={description}
                onChange={setDescription}
                className="space-y-1.5"
              >
                <Label className="block text-xs text-[var(--muted)]">
                  {zh.lists.createModal.descriptionLabel}
                </Label>
                <Input
                  placeholder={zh.lists.createModal.descriptionPlaceholder}
                  className="w-full h-10 px-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                />
              </TextField>

              <div className="flex items-center justify-between gap-2.5 pt-1">
                <span className="text-sm text-[var(--foreground-secondary)]">
                  {zh.lists.createModal.pinnedLabel}
                </span>
                <Switch
                  aria-label={zh.lists.createModal.pinnedLabel}
                  isSelected={pinned}
                  onChange={setPinned}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>

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
