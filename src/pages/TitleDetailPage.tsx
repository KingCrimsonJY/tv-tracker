import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@heroui/react';
import { PlaythroughHistory } from '../features/title/PlaythroughHistory';
import { PrimaryAction } from '../features/title/PrimaryAction';
import { RatingsRow } from '../features/title/RatingsRow';
import { ResumeDialog } from '../features/title/ResumeDialog';
import { SeasonPanel } from '../features/title/SeasonPanel';
import { TitleHero } from '../features/title/TitleHero';
import { TitleMenu } from '../features/title/TitleMenu';
import { useTitleDetail } from '../features/title/useTitleDetail';
import { zh } from '../i18n/zh';

export const TitleDetailPage: React.FC = () => {
  const { titleId } = useParams<{ titleId: string }>();
  const navigate = useNavigate();

  const {
    tracker,
    title,
    regularSeasons,
    specialsSeason,
    airedKeySet,
    progress,
    state,
    selectedSeasonNum,
    setSelectedSeasonNum,
    currentSeason,
    currentSeasonState,
    specialsSeasonState,
    primary,
    secondary,
    overviewText,
    overviewExpanded,
    setOverviewExpanded,
    metaParts,
    menuOpen,
    setMenuOpen,
    resumeOpen,
    setResumeOpen,
    resumeEpisodeKey,
    openResumeModal,
    langModalOpen,
    setLangModalOpen,
    editModalOpen,
    setEditModalOpen,
    addToListModalOpen,
    setAddToListModalOpen,
    handlePrimaryAction,
    primaryActionLabel,
    hasMovieResume,
    movieResumePct,
    markEpisodeUpTo,
  } = useTitleDetail(titleId);

  if (!title || !state) {
    return (
      <div className="px-6 py-16 text-center space-y-4">
        <p className="text-base text-[var(--muted)]">{zh.detail.notFound}</p>
        <Button
          variant="secondary"
          size="sm"
          onPress={() => navigate('/library')}
        >
          {zh.detail.backToLibrary}
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <TitleHero
        title={title}
        state={state}
        primary={primary}
        secondary={secondary}
        metaParts={metaParts}
        onBack={() => navigate(-1)}
      />

      <div className="px-4 sm:px-6 lg:px-10 mt-3 space-y-6">
        <div className="sm:pl-[11.25rem] md:pl-[12.75rem] lg:pl-[13.75rem] space-y-3">
          <RatingsRow title={title} primary={primary} />

          <PrimaryAction
            title={title}
            state={state}
            label={primaryActionLabel}
            hasMovieResume={hasMovieResume}
            movieResumePct={movieResumePct}
            onPrimaryAction={handlePrimaryAction}
            onOpenMenu={() => setMenuOpen(true)}
          />
        </div>

        {/* Overview Clamped to 3 lines with Expand */}
        <div className="max-w-3xl">
          <p
            className={`text-sm sm:text-base text-[var(--foreground-secondary)] leading-relaxed ${
              overviewExpanded ? '' : 'line-clamp-3'
            }`}
          >
            {overviewText}
          </p>
          {overviewText.length > 110 && (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setOverviewExpanded((v) => !v)}
              className="mt-1.5 px-2 h-7 text-xs font-medium text-[var(--accent-text)]"
            >
              {overviewExpanded
                ? zh.detail.overview.collapse
                : zh.detail.overview.expand}
            </Button>
          )}
        </div>

        {/* Seasons & Episodes */}
        <SeasonPanel
          title={title}
          state={state}
          regularSeasons={regularSeasons}
          specialsSeason={specialsSeason}
          specialsSeasonState={specialsSeasonState}
          currentSeason={currentSeason}
          currentSeasonState={currentSeasonState}
          airedKeySet={airedKeySet}
          selectedSeasonNum={selectedSeasonNum}
          onSelectSeason={setSelectedSeasonNum}
          progress={progress}
          onToggleSeasonWatched={(sNum, markWatched) =>
            tracker.toggleSeason(title.id, sNum, markWatched)
          }
          onToggleEpisodeWatched={(epKey) =>
            tracker.toggleEpisode(title.id, epKey)
          }
          onMarkEpisodeUpTo={(epKey) => markEpisodeUpTo(title.id, epKey)}
          onRecordResume={(epKey) => openResumeModal(epKey)}
        />

        {/* Playthrough History */}
        <PlaythroughHistory
          title={title}
          state={state}
          onCancelRewatch={() => tracker.cancelTitleRewatch(title.id)}
        />
      </div>

      {/* Secondary Actions Drawer + Modals */}
      <TitleMenu
        title={title}
        menuOpen={menuOpen}
        onMenuOpenChange={setMenuOpen}
        langModalOpen={langModalOpen}
        onLangModalOpenChange={setLangModalOpen}
        editModalOpen={editModalOpen}
        onEditModalOpenChange={setEditModalOpen}
        addToListModalOpen={addToListModalOpen}
        onAddToListModalOpenChange={setAddToListModalOpen}
        lists={tracker.lists}
        entriesByList={tracker.entriesByList}
        onOpenResumeModal={() => openResumeModal()}
        onMarkWholeTitleWatched={() => tracker.markWholeTitle(title.id, true)}
        onSetManualState={(manualState) =>
          tracker.setTitleManualState(title.id, manualState)
        }
        onRefreshMetadata={async () => {
          await tracker.refreshTitleMetadata(title.id);
          await tracker.fetchAndCacheTitleRatings(title.id);
        }}
        onRefreshPlaylist={async () => {
          await tracker.refreshLinkTitlePlaylist(title.id);
        }}
        onUpdateTitleLanguage={(displayLang) =>
          tracker.updateTitleLanguage(title.id, displayLang)
        }
        onUpdateTitleDetails={(input) =>
          tracker.updateTitleDetails(title.id, input)
        }
        onAddTitleToList={(listId, tId) => tracker.addTitleToList(listId, tId)}
        onRemoveEntryFromList={(listId, entryId) =>
          tracker.removeEntryFromList(listId, entryId)
        }
        onDeleteTitle={async () => {
          await tracker.removeTitle(title.id);
          navigate('/library', { replace: true });
        }}
      />

      {/* Resume Time Dialog */}
      <ResumeDialog
        isOpen={resumeOpen}
        onOpenChange={setResumeOpen}
        title={title}
        regularSeasons={regularSeasons}
        initialEpisodeKey={resumeEpisodeKey}
        onSaveResume={(resume) => tracker.saveResume(title.id, resume)}
      />
    </div>
  );
};
