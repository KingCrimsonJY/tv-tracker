import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, Film, Layers, ListOrdered, Pin, Plus } from 'lucide-react';
import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  ProgressBar,
  Radio,
  RadioGroup,
  Skeleton,
  Switch,
  TextField,
} from '@heroui/react';
import { MediaImage } from '../components/MediaImage';
import { useTracker } from '../context/TrackerContext';
import { computeListProgress, sortListEntries } from '../domain/ordering';
import { pickPoster, resolveDisplayTitle } from '../domain/progress';
import type { ListEntryDoc, ListKind, ProgressDoc, TitleDoc } from '../domain/types';
import { useI18n } from '../i18n';

export const ListsPage: React.FC = () => {
  const { loadingData, titles, seasonsByTitle, lists, entriesByList, settings, getActiveProgress, createList } =
    useTracker();
  const { locale, t } = useI18n();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ListKind>('ordered');
  const [description, setDescription] = useState('');
  const [pinned, setPinned] = useState(true);
  const [creating, setCreating] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const sortedLists = Object.values(lists).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.rank < b.rank ? -1 : 1;
  });

  const progressByTitleMap: Record<string, ProgressDoc | undefined> = {};
  for (const titleDoc of Object.values(titles)) {
    progressByTitleMap[titleDoc.id] = getActiveProgress(titleDoc);
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    if (!name.trim()) {
      setNameError(t.lists.createModal.nameRequiredError);
      return;
    }
    setCreating(true);
    try {
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
    } catch {
      // The action reports the error and rolls back; keep the form available for retry.
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)]">{t.lists.title}</h1>
          <span className="text-xs sm:text-sm text-[var(--muted)] tabular-nums">
            {t.lists.countLabel(sortedLists.length)}
          </span>
        </div>

        <Button variant="primary" size="sm" onPress={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>{t.lists.createList}</span>
        </Button>
      </header>

      {loadingData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-label={t.lists.loadingAria}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : sortedLists.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center max-w-lg mx-auto my-8 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-text)] flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{t.lists.emptyListsTitle}</h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">{t.lists.emptyListsDescription}</p>
          <Button variant="primary" onPress={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>{t.lists.createList}</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedLists.map((list) => {
            const rawEntries = entriesByList[list.id] || [];
            const hydrated = rawEntries
              .map((entry) => ({ entry, title: titles[entry.titleId] }))
              .filter((item): item is { entry: ListEntryDoc; title: TitleDoc } => Boolean(item.title));

            const sortedEntries = sortListEntries(
              hydrated,
              list.kind,
              list.collectionSort,
              settings.defaultTitleLang,
              locale,
            );

            const stats = computeListProgress(sortedEntries, seasonsByTitle, progressByTitleMap, {
              includeSpecials: settings.includeSpecials,
            });

            const collageTitles = sortedEntries.slice(0, 4).map((h) => h.title);
            const pct = stats.totalCount > 0 ? Math.round((stats.completedCount / stats.totalCount) * 100) : 0;

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
                            src={pickPoster(item, locale)}
                            alt={
                              resolveDisplayTitle(item.names, item.displayLang, settings.defaultTitleLang, locale)
                                .primary
                            }
                            aspect="poster"
                            mediaType={item.mediaType}
                            compact
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
                        <span>{list.kind === 'ordered' ? t.lists.orderedType : t.lists.collectionType}</span>
                      </span>

                      {list.pinned && (
                        <span className="flex items-center gap-1 text-[var(--muted)]">
                          <Pin className="w-3 h-3" />
                          <span>{t.lists.pinnedBadge}</span>
                        </span>
                      )}
                    </div>

                    <h2 className="text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--accent-text)] transition-colors truncate">
                      {list.name}
                    </h2>

                    {list.description && <p className="text-xs text-[var(--muted)] line-clamp-1">{list.description}</p>}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-[var(--muted)] tabular-nums">
                      <span>{t.lists.totalTitlesLabel(stats.totalCount)}</span>
                      <span>{t.lists.progressLabel(stats.completedCount, stats.totalCount)}</span>
                    </div>

                    <ProgressBar aria-label={t.lists.progressAria(list.name)} value={pct} size="sm" className="w-full">
                      <ProgressBar.Track>
                        <ProgressBar.Fill />
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
      <Modal.Backdrop
        isOpen={createOpen}
        onOpenChange={(open) => {
          if (!creating) setCreateOpen(open);
        }}
        isDismissable={!creating}
        isKeyboardDismissDisabled={creating}
      >
        <Modal.Container size="md" placement="center" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{t.lists.createModal.title}</Modal.Heading>
            </Modal.Header>

            <form onSubmit={handleCreateSubmit} className="flex min-h-0 flex-col">
              <Modal.Body className="space-y-4">
                <TextField
                  value={name}
                  onChange={(val) => {
                    setName(val);
                    setNameError(null);
                  }}
                  isInvalid={Boolean(nameError)}
                  fullWidth
                  variant="secondary"
                >
                  <Label>{t.lists.createModal.nameLabel}</Label>
                  <Input placeholder={t.lists.createModal.namePlaceholder} />
                  {nameError && <FieldError>{nameError}</FieldError>}
                </TextField>

                <RadioGroup value={kind} onChange={(val) => setKind(val as ListKind)} variant="secondary">
                  <Label>{t.lists.createModal.kindLabel}</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1">
                    <Radio
                      value="ordered"
                      className="m-0 min-w-0 rounded-xl border border-border p-3 data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft"
                    >
                      <Radio.Content className="min-h-11 w-full">
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <Label>{t.lists.orderedType}</Label>
                      </Radio.Content>
                      <Description className="pl-7">{t.lists.orderedTypeHint}</Description>
                    </Radio>

                    <Radio
                      value="collection"
                      className="m-0 min-w-0 rounded-xl border border-border p-3 data-[selected=true]:border-accent data-[selected=true]:bg-accent-soft"
                    >
                      <Radio.Content className="min-h-11 w-full">
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <Label>{t.lists.collectionType}</Label>
                      </Radio.Content>
                      <Description className="pl-7">{t.lists.collectionTypeHint}</Description>
                    </Radio>
                  </div>
                </RadioGroup>

                <TextField value={description} onChange={setDescription} fullWidth variant="secondary">
                  <Label>{t.lists.createModal.descriptionLabel}</Label>
                  <Input placeholder={t.lists.createModal.descriptionPlaceholder} />
                </TextField>

                <div className="pt-1">
                  <Switch isSelected={pinned} onChange={setPinned}>
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <Label>{t.lists.createModal.pinnedLabel}</Label>
                    </Switch.Content>
                  </Switch>
                </div>
              </Modal.Body>

              <Modal.Footer>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  isDisabled={creating}
                  onPress={() => setCreateOpen(false)}
                >
                  {t.lists.createModal.cancel}
                </Button>
                <Button type="submit" variant="primary" size="sm" isPending={creating}>
                  {t.lists.createModal.submit}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
};
