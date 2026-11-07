import { buildAiredEpisodeKeySet, isShowEnded } from '../../domain/airing';
import type { ProgressDoc, SeasonDoc, TitleDoc } from '../../domain/types';

export function selectPrimaryEpisode(
  title: TitleDoc, seasons: SeasonDoc[], progress: ProgressDoc | undefined,
  nextKey: string | undefined, today: string,
): string | undefined {
  const aired = buildAiredEpisodeKeySet(seasons, {
    todayStr: today, treatAllAsAired: title.source !== 'tmdb',
    showEnded: isShowEnded(title.showStatus, title.source),
  });
  const resumeKey = title.resume && title.resume.seconds > 0 ? title.resume.episodeKey : null;
  return [resumeKey, nextKey].find(key => key && aired.has(key) && !progress?.watched[key]) ?? undefined;
}
