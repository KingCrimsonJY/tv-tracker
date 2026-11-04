import React from 'react';
import { CheckCheck } from 'lucide-react';
import { Button, ListBox, ProgressBar, Select, Tabs } from '@heroui/react';
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

  return (
    <section className="space-y-4">
      {/* Season Selector: Tabs if <= 6 seasons, otherwise Select */}
      {regularSeasons.length <= 6 ? (
        <Tabs
          selectedKey={activeSeasonKey}
          onSelectionChange={(key) => onSelectSeason(Number(key))}
          variant="secondary"
        >
          <Tabs.ListContainer className="overflow-x-auto no-scrollbar border-b border-[var(--separator)]">
            <Tabs.List aria-label={zh.detail.seasons.selectAria} className="flex items-center gap-1">
              {regularSeasons.map((s) => (
                <Tabs.Tab
                  key={s.seasonNumber}
                  id={String(s.seasonNumber)}
                  className="px-4 py-2.5 min-h-[44px] text-sm font-medium whitespace-nowrap"
                >
                  {zh.detail.seasons.tabLabel(s.seasonNumber)}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      ) : (
        <Select
          aria-label={zh.detail.seasons.selectAria}
          selectedKey={activeSeasonKey}
          onSelectionChange={(key) => {
            if (key != null) onSelectSeason(Number(key));
          }}
          className="max-w-xs"
        >
          <Select.Trigger className="h-11 px-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm font-medium text-[var(--foreground)] flex items-center justify-between gap-3">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover className="bg-[var(--overlay)] border border-[var(--border)] rounded-xl p-1 max-h-64 overflow-y-auto">
            <ListBox aria-label={zh.detail.seasons.selectAria}>
              {regularSeasons.map((s) => {
                const label = `${zh.detail.seasons.tabLabel(s.seasonNumber)} (${s.episodes.length} 集)`;
                return (
                  <ListBox.Item
                    key={s.seasonNumber}
                    id={String(s.seasonNumber)}
                    textValue={label}
                    className="px-3 py-2 rounded-lg text-sm text-[var(--foreground)] hover:bg-[var(--surface-secondary)] cursor-pointer outline-none"
                  >
                    {label}
                  </ListBox.Item>
                );
              })}
            </ListBox>
          </Select.Popover>
        </Select>
      )}

      {/* Current Season Header & Progress */}
      {currentSeason && currentSeasonState && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[var(--separator)] flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
                <span className="text-[var(--foreground)]">
                  {currentSeason.name ||
                    zh.detail.seasons.tabLabel(currentSeason.seasonNumber)}
                </span>
                <span className="text-[var(--muted)] tabular-nums">
                  {zh.detail.seasons.progressText(
                    currentSeasonState.watchedCount,
                    currentSeasonState.airedCount
                  )}
                </span>
              </div>
              <ProgressBar
                aria-label={zh.detail.seasons.progressAria(
                  currentSeason.seasonNumber
                )}
                value={
                  currentSeasonState.airedCount > 0
                    ? Math.round(
                        (currentSeasonState.watchedCount /
                          currentSeasonState.airedCount) *
                          100
                      )
                    : 0
                }
                size="sm"
                className="w-full"
              >
                <ProgressBar.Track className="h-1.5 bg-[var(--surface-tertiary)] rounded-full overflow-hidden">
                  <ProgressBar.Fill className="h-full bg-[var(--accent)] rounded-full" />
                </ProgressBar.Track>
              </ProgressBar>
            </div>

            {currentSeasonState.airedCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onPress={() =>
                  onToggleSeasonWatched(
                    currentSeason.seasonNumber,
                    currentSeasonState.state !== 'complete'
                  )
                }
                className="gap-1.5 text-xs shrink-0"
              >
                <CheckCheck className="w-4 h-4" />
                <span>
                  {currentSeasonState.state === 'complete'
                    ? zh.detail.seasons.unmarkWholeSeason
                    : zh.detail.seasons.markWholeSeason}
                </span>
              </Button>
            )}
          </div>

          {/* Episode List */}
          <div className="divide-y divide-[var(--separator)]">
            {currentSeason.episodes.map((ep) => (
              <EpisodeRow
                key={ep.key}
                title={title}
                ep={ep}
                seasonNumber={currentSeason.seasonNumber}
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
