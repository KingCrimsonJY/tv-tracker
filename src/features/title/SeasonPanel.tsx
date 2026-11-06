import React, { useState, useEffect } from 'react';
import { Tabs, Select, ListBox, Button, ProgressBar, Disclosure, Label } from '@heroui/react';
import { CheckCheck, RotateCcw, ChevronDown } from 'lucide-react';
import { ProgressDoc, SeasonDoc, TitleDoc } from '../../domain/types';
import { makeEpisodeKey, parseEpisodeKey } from '../../domain/airing';
import { computeSeasonState } from '../../domain/status';
import { resolveLocalizedText } from '../../domain/ordering';
import { EpisodeRow } from './EpisodeRow';
import { useI18n } from '../../i18n';

interface SeasonPanelProps {
  title: TitleDoc;
  seasons: SeasonDoc[];
  specialSeason?: SeasonDoc;
  activeProgress?: ProgressDoc;
  today: string;
  highlightEpKey: string | null;
  onToggleEpisode: (epKey: string) => void;
  onMarkSeason: (seasonNumber: number, markWatched: boolean) => void;
  onMarkUpTo: (epKey: string) => void;
  onOpenResumeForEpisode: (epKey: string) => void;
}

export const SeasonPanel: React.FC<SeasonPanelProps> = ({
  title,
  seasons,
  specialSeason,
  activeProgress,
  today,
  highlightEpKey,
  onToggleEpisode,
  onMarkSeason,
  onMarkUpTo,
  onOpenResumeForEpisode,
}) => {
  const { t, locale } = useI18n();
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(
    seasons[0]?.seasonNumber ?? 1
  );

  useEffect(() => {
    if (highlightEpKey) {
      const parsed = parseEpisodeKey(highlightEpKey);
      if (parsed && parsed.seasonNumber > 0) {
        setSelectedSeasonNum(parsed.seasonNumber);
      }
      setTimeout(() => {
        const el = document.getElementById(`episode-${highlightEpKey}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    } else if (seasons.length > 0 && !seasons.some((s) => s.seasonNumber === selectedSeasonNum)) {
      setSelectedSeasonNum(seasons[0].seasonNumber);
    }
  }, [highlightEpKey, seasons, selectedSeasonNum]);

  if (seasons.length === 0 && !specialSeason) {
    return null;
  }

  const renderSeasonBlock = (season: SeasonDoc) => {
    const sState = computeSeasonState(season, activeProgress, {
      todayStr: today,
      treatAllAsAired: title.source !== 'tmdb',
      allSeasons: seasons,
    });
    const pct =
      sState.airedCount > 0 ? Math.round((sState.watchedCount / sState.airedCount) * 100) : 0;
    const allAiredWatched = sState.airedCount > 0 && sState.watchedCount >= sState.airedCount;
    const resolvedSeasonName =
      resolveLocalizedText(season.name, locale) ||
      t.detail.seasons.tabLabel(season.seasonNumber);

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
          <div className="space-y-1.5 flex-1 max-w-md">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--foreground)]">
                {resolvedSeasonName} ·{' '}
                {t.detail.seasons.progressText(sState.watchedCount, sState.airedCount)}
              </span>
              <span className="text-[var(--muted)]">{pct}%</span>
            </div>
            <ProgressBar
              aria-label={t.detail.seasons.progressAria(season.seasonNumber)}
              value={pct}
              size="sm"
              color="accent"
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          </div>

          {sState.airedCount > 0 && (
            <Button
              size="sm"
              variant={allAiredWatched ? 'tertiary' : 'secondary'}
              onPress={() => onMarkSeason(season.seasonNumber, !allAiredWatched)}
            >
              {allAiredWatched ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  {t.detail.seasons.unmarkWholeSeason}
                </>
              ) : (
                <>
                  <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                  {t.detail.seasons.markWholeSeason}
                </>
              )}
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {[...season.episodes]
            .sort((a, b) => a.number - b.number)
            .map((ep) => {
              const epKey = makeEpisodeKey(season.seasonNumber, ep.number);
              const isWatched = Boolean(activeProgress?.watched[epKey]);
              const resumeSeconds =
                title.resume && title.resume.episodeKey === epKey ? title.resume.seconds : null;
              return (
                <EpisodeRow
                  key={epKey}
                  seasonNumber={season.seasonNumber}
                  episode={ep}
                  isWatched={isWatched}
                  resumeSeconds={resumeSeconds}
                  today={today}
                  treatAllAsAired={title.source !== 'tmdb'}
                  isHighlighted={highlightEpKey === epKey}
                  onToggle={() => onToggleEpisode(epKey)}
                  onMarkUpToHere={() => onMarkUpTo(epKey)}
                  onRecordTime={() => onOpenResumeForEpisode(epKey)}
                />
              );
            })}
        </div>
      </div>
    );
  };

  const currentSeason = seasons.find((s) => s.seasonNumber === selectedSeasonNum) ?? seasons[0];
  const specialState = specialSeason
    ? computeSeasonState(specialSeason, activeProgress, {
        todayStr: today,
        treatAllAsAired: title.source !== 'tmdb',
      })
    : null;

  return (
    <div className="space-y-6">
      {seasons.length === 1 && renderSeasonBlock(currentSeason)}

      {seasons.length > 1 &&
        (seasons.length <= 6 ? (
          <Tabs
            selectedKey={String(currentSeason.seasonNumber)}
            onSelectionChange={(k) => setSelectedSeasonNum(Number(k))}
          >
            <Tabs.ListContainer className="mb-4 overflow-x-auto">
              <Tabs.List aria-label={t.detail.seasons.selectAria}>
                {seasons.map((s) => (
                  <Tabs.Tab key={s.seasonNumber} id={String(s.seasonNumber)}>
                    {t.detail.seasons.tabLabel(s.seasonNumber)}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {seasons.map((s) => (
              <Tabs.Panel key={s.seasonNumber} id={String(s.seasonNumber)}>
                {renderSeasonBlock(s)}
              </Tabs.Panel>
            ))}
          </Tabs>
        ) : (
          <div className="space-y-4">
            <Select
              aria-label={t.detail.seasons.selectAria}
              selectedKey={String(currentSeason.seasonNumber)}
              onSelectionChange={(k) => k && setSelectedSeasonNum(Number(k))}
              className="max-w-xs"
            >
              <Label>{t.detail.seasons.selectAria}</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox className="max-h-64 overflow-y-auto">
                  {seasons.map((s) => {
                    const optionLabel = t.detail.seasons.selectOptionWithCount(
                      t.detail.seasons.tabLabel(s.seasonNumber),
                      s.episodes.length
                    );
                    return (
                      <ListBox.Item
                        key={s.seasonNumber}
                        id={String(s.seasonNumber)}
                        textValue={optionLabel}
                      >
                        {optionLabel}
                      </ListBox.Item>
                    );
                  })}
                </ListBox>
              </Select.Popover>
            </Select>
            {renderSeasonBlock(currentSeason)}
          </div>
        ))}

      {specialSeason && specialSeason.episodes.length > 0 && specialState && (
        <Disclosure className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
          <Disclosure.Heading>
            <Button variant="ghost" className="w-full justify-between">
              <span>
                {t.detail.seasons.specialsCollapsedTitle(
                  specialState.watchedCount,
                  specialState.airedCount
                )}
              </span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </Disclosure.Heading>
          <Disclosure.Content className="pt-3">
            {renderSeasonBlock(specialSeason)}
          </Disclosure.Content>
        </Disclosure>
      )}
    </div>
  );
};
