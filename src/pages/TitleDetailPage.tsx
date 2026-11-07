import React from 'react';
import { Button } from '@heroui/react';
import { UpstreamPanel } from '../features/title/UpstreamPanel';
import { useTitleDetail } from '../features/title/useTitleDetail';
import { TitleHero } from '../features/title/TitleHero';
import { RatingsRow } from '../features/title/RatingsRow';
import { PrimaryAction } from '../features/title/PrimaryAction';
import { SeasonPanel } from '../features/title/SeasonPanel';
import { PlaythroughHistory } from '../features/title/PlaythroughHistory';
import { ResumeDialog } from '../features/title/ResumeDialog';
import { TitleModals } from '../features/title/TitleModals';
import { useI18n } from '../i18n';

export const TitleDetailPage: React.FC = () => {
  const detail = useTitleDetail();
  const { t } = useI18n();

  if (!detail.title || !detail.titleState) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--muted)] mb-4">{t.detail.notFound}</p>
        <Button variant="secondary" onPress={() => detail.navigate('/library')}>
          {t.detail.backToLibrary}
        </Button>
      </div>
    );
  }

  const { title, titleState, activeProgress, seasons, regularSeasons, specialSeason } = detail;

  return (
    <div className="pb-12">
      <TitleHero
        title={title}
        titleState={titleState}
        displayTitle={detail.displayTitle}
        showOriginalSub={detail.showOriginalSub}
        metaParts={detail.metaParts}
        onBack={() => detail.navigate(-1)}
      >
        <RatingsRow title={title} />

        <div className="flex items-center gap-3 flex-wrap pt-1">
          <PrimaryAction
            title={title}
            seasons={seasons}
            titleState={titleState}
            activeProgress={activeProgress}
            today={detail.today}
            onMarkMovieWatched={() => void detail.markWholeTitle(title.id, true)}
            onStartRewatch={() => void detail.startTitleRewatch(title.id)}
            onToggleEpisode={(epKey) => void detail.toggleEpisode(title.id, epKey)}
            onOpenResume={(epKey) => {
              detail.setResumeDefaultEpKey(epKey ?? title.resume?.episodeKey ?? titleState.nextUp?.key ?? null);
              detail.setResumeDialogOpen(true);
            }}
          />
          {detail.menuNode}
        </div>
      </TitleHero>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 mt-5">
        <div className="max-w-3xl space-y-1.5">
          {title.uploader && (
            <p className="text-xs font-medium text-[var(--muted)]">
              {t.detail.uploaderPrefix(title.uploader)}
            </p>
          )}
          <p
            className={`text-sm ${
              detail.hasOverviewText ? 'text-[var(--foreground)]/90' : 'text-[var(--muted)]'
            } leading-relaxed ${!detail.overviewExpanded ? 'line-clamp-3' : ''}`}
          >
            {detail.overviewText}
          </p>
          {detail.hasOverviewText && detail.overviewText.length > 140 && (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => detail.setOverviewExpanded(!detail.overviewExpanded)}
              className="mt-1 -ml-2"
            >
              {detail.overviewExpanded ? t.detail.overview.collapse : t.detail.overview.expand}
            </Button>
          )}
        </div>

        <UpstreamPanel key={title.id} title={title} />

        {titleState.isEpisodic && (
          <SeasonPanel
            key={title.id}
            title={title}
            seasons={regularSeasons}
            specialSeason={specialSeason}
            activeProgress={activeProgress}
            today={detail.today}
            highlightEpKey={detail.highlightEpKey}
            onToggleEpisode={(epKey) => void detail.toggleEpisode(title.id, epKey)}
            onMarkSeason={(seasonNum, mark) => void detail.toggleSeason(title.id, seasonNum, mark)}
            onMarkUpTo={(epKey) => void detail.markUpTo(title.id, epKey)}
            onOpenResumeForEpisode={(epKey) => {
              detail.setResumeDefaultEpKey(epKey);
              detail.setResumeDialogOpen(true);
            }}
          />
        )}

        <PlaythroughHistory
          playthroughs={title.playthroughs}
          onUndoLatest={() => detail.setUndoPlaythroughOpen(true)}
          onDeletePlaythrough={(ptId) => detail.setDeletePlaythroughId(ptId)}
        />
      </div>

      <ResumeDialog
        isOpen={detail.resumeDialogOpen}
        onOpenChange={detail.setResumeDialogOpen}
        title={title}
        seasons={seasons}
        defaultEpisodeKey={detail.resumeDefaultEpKey}
        onSave={(seconds, epKey) =>
          void detail.saveResume(title.id, { seconds, episodeKey: epKey })
        }
        onClear={() => void detail.saveResume(title.id, null)}
      />

      <TitleModals
        title={title}
        lists={detail.lists}
        entriesByList={detail.entriesByList}
        addToListOpen={detail.addToListOpen}
        onAddToListOpenChange={detail.setAddToListOpen}
        onAddListEntry={(listId, titleId) => void detail.addTitleToList(listId, titleId)}
        onRemoveListEntry={(listId, entryId) => void detail.removeEntryFromList(listId, entryId)}
        langModalOpen={detail.langModalOpen}
        onLangModalOpenChange={detail.setLangModalOpen}
        onUpdateDisplayLang={(displayLang) =>
          void detail.updateTitleLanguage(title.id, displayLang)
        }
        editModalOpen={detail.editModalOpen}
        onEditModalOpenChange={detail.setEditModalOpen}
        onUpdateTitle={(patch) => void detail.updateTitleDetails(title.id, patch)}
        deleteConfirmOpen={detail.deleteConfirmOpen}
        onDeleteConfirmOpenChange={detail.setDeleteConfirmOpen}
        onConfirmDelete={async () => {
          await detail.removeTitle(title.id);
          detail.setDeleteConfirmOpen(false);
          detail.navigate('/library');
        }}
        undoPlaythroughOpen={detail.undoPlaythroughOpen}
        onUndoPlaythroughOpenChange={detail.setUndoPlaythroughOpen}
        onConfirmUndoPlaythrough={async () => {
          await detail.cancelTitleRewatch(title.id);
          detail.setUndoPlaythroughOpen(false);
        }}
        deletePlaythroughId={detail.deletePlaythroughId}
        onDeletePlaythroughIdChange={detail.setDeletePlaythroughId}
        onConfirmDeletePlaythrough={async (ptId) => {
          await detail.deleteTitlePlaythrough(title.id, ptId);
          detail.setDeletePlaythroughId(null);
        }}
      />
    </div>
  );
};
