import React from 'react';
import { CheckCheck } from 'lucide-react';
import { Button, Label, ListBox, ProgressBar, Select, Tabs } from '@heroui/react';
import type { ComputedSeasonState, ComputedTitleState } from '../../domain/progress';
import type { ProgressDoc, SeasonDoc, TitleDoc } from '../../domain/types';
import { zh } from '../../i18n/zh';
import { EpisodeRow } from './EpisodeRow';

interface SeasonPanelProps {
  title: TitleDoc;
  state: ComputedTitleState;
  regularSeasons: SeasonDoc[];
  specialsSeason: SeasonDoc | undefined;
  specialsSeasonState: ComputedSeasonState | null;
  currentSeason: SeasonDoc | undefined;
  currentSeasonState: ComputedSeasonState | null;
  airedKeySet: Set<string>;
  selectedSeasonNum: number;
  onSelectSeason: (seasonNum: number) => void;
  progress: ProgressDoc | undefined;
  onToggleSeasonWatched: (seasonNumber: number, markWatched: boolean) => void;
  onToggleEpisodeWatched: (episodeKey: string) => void;
  onMarkEpisodeUpTo: (episodeKey: string) => void;
  onRecordResume: (episodeKey: string) => void;
}

export const SeasonPanel: React.FC<SeasonPanelProps> = ({
  title,
  state,
  regularSeasons,
  specialsSeason,
  specialsSeasonState,
  currentSeason,
  currentSeasonState,
  airedKeySet,
  selectedSeasonNum,
  onSelectSeason,
  progress,
  onToggleSeasonWatched,
  onToggleEpisodeWatched,
  onMarkEpisodeUpTo,
  onRecordResume,
}) => {
  if (regularSeasons.length === 0) return null;

  const activeSeasonKey = String(currentSeason?.seasonNumber ?? selectedSeasonNum);
  const isSingleSeasonCustomOrUrl =
    (title.source === 'custom' || title.source === 'url') &&
    regularSeasons.length === 1;

  const renderSeasonCard = (
    season: SeasonDoc,
    seasonState: ComputedSeasonState,
    hideHeader = false
  ) => (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      {!hideHeader && (
        <div className="p-4 sm:p-5 border-b border-[var(--separator)] flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
              <span className="text-[var(--foreground)]">
                {season.name || zh.detail.seasons.tabLabel(season.seasonNumber)}
              </span>
              <span className="text-[var(--muted)] tabular-nums">
                {zh.detail.seasons.progressText(
                  seasonState.watchedCount,
                  seasonState.airedCount
                )}
              </span>
            </div>
            <ProgressBar
              aria-label={zh.detail.seasons.progressAria(season.seasonNumber)}
              value={
                seasonState.airedCount > 0
                  ? Math.round(
                      (seasonState.watchedCount / seasonState.airedCount) * 100
                    )
                  : 0
              }
              size="sm"
              className="w-full"
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          </div>

          {seasonState.airedCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onPress={() =>
                onToggleSeasonWatched(
                  season.seasonNumber,
                  seasonState.state !== 'complete'
                )
              }
              className="shrink-0"
            >
              <CheckCheck className="w-4 h-4" />
              <span>
                {seasonState.state === 'complete'
                  ? zh.detail.seasons.unmarkWholeSeason
                  : zh.detail.seasons.markWholeSeason}
              </span>
            </Button>
          )}
        </div>
      )}

      {/* Episode List */}
      <div className="divide-y divide-[var(--separator)]">
        {season.episodes.map((ep) => (
          <EpisodeRow
            key={ep.key}
            title={title}
            ep={ep}
            seasonNumber={season.seasonNumber}
            aired={airedKeySet.has(ep.key)}
            progress={progress}
            isNextUp={state.nextUp?.key === ep.key}
            onToggleWatched={onToggleEpisodeWatched}
            onMarkUpTo={onMarkEpisodeUpTo}
            onRecordResume={onRecordResume}
          />
        ))}
      </div>
    </div>
  );

  return (
    <section className="space-y-4">
      {isSingleSeasonCustomOrUrl ? (
        currentSeason &&
        currentSeasonState &&
        renderSeasonCard(currentSeason, currentSeasonState, true)
      ) : regularSeasons.length <= 6 ? (
        <Tabs
          selectedKey={activeSeasonKey}
          onSelectionChange={(key) => onSelectSeason(Number(key))}
          className="gap-4"
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label={zh.detail.seasons.selectAria}>
              {regularSeasons.map((s) => (
                <Tabs.Tab key={s.seasonNumber} id={String(s.seasonNumber)}>
                  {zh.detail.seasons.tabLabel(s.seasonNumber)}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>

          {regularSeasons.map((s) => (
            <Tabs.Panel key={s.seasonNumber} id={String(s.seasonNumber)}>
              {currentSeason?.seasonNumber === s.seasonNumber &&
              currentSeasonState
                ? renderSeasonCard(currentSeason, currentSeasonState)
                : null}
            </Tabs.Panel>
          ))}
        </Tabs>
      ) : (
        <>
          <Select
            aria-label={zh.detail.seasons.selectAria}
            selectedKey={activeSeasonKey}
            onSelectionChange={(key) => {
              if (key != null) onSelectSeason(Number(key));
            }}
            variant="secondary"
            className="max-w-xs"
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox aria-label={zh.detail.seasons.selectAria}>
                {regularSeasons.map((s) => {
                  const label = `${zh.detail.seasons.tabLabel(s.seasonNumber)} (${s.episodes.length} 集)`;
                  return (
                    <ListBox.Item
                      key={s.seasonNumber}
                      id={String(s.seasonNumber)}
                      textValue={label}
                    >
                      <Label>{label}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  );
                })}
              </ListBox>
            </Select.Popover>
          </Select>

          {currentSeason &&
            currentSeasonState &&
            renderSeasonCard(currentSeason, currentSeasonState)}
        </>
      )}

      {/* Collapsed Specials Section at Bottom */}
      {specialsSeason &&
        specialsSeason.episodes.length > 0 &&
        specialsSeasonState && (
          <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden group">
            <summary className="p-4 sm:p-5 cursor-pointer select-none flex items-center justify-between text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
              <span>
                {zh.detail.seasons.specialsCollapsedTitle(
                  specialsSeasonState.watchedCount,
                  specialsSeasonState.airedCount
                )}
              </span>
              <span className="text-xs group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <div className="border-t border-[var(--separator)] divide-y divide-[var(--separator)]">
              {specialsSeason.episodes.map((ep) => (
                <EpisodeRow
                  key={ep.key}
                  title={title}
                  ep={ep}
                  seasonNumber={0}
                  aired={airedKeySet.has(ep.key)}
                  progress={progress}
                  onToggleWatched={onToggleEpisodeWatched}
                  onMarkUpTo={onMarkEpisodeUpTo}
                  onRecordResume={onRecordResume}
                />
              ))}
            </div>
          </details>
        )}
    </section>
  );
};
