import { extractGenreIdsFromNames } from '../../src/domain/genres.ts';
import { splitUploaderPrefixFromOverview } from '../../src/domain/progress.ts';
import { DEFAULT_APP_SETTINGS, importPayloadSchema } from '../../src/domain/schemas.ts';
import type {
  AppSettingsDoc,
  AppStateSnapshot,
  ListEntryDoc,
  ProgressDoc,
  SeasonDoc,
  StateMutationResult,
  TitleDoc,
  WatchListDoc,
  ZhenjiExportV2,
} from '../../src/domain/types.ts';
import { createSafetyBackup } from './backup.ts';
import { getSettings } from './settingsAuthRepo.ts';
import {
  type DbContext,
  serializeEntryData,
  serializeListData,
  serializeTitleData,
  type StoredProgressData,
} from './types.ts';

export function getState(ctx: DbContext): AppStateSnapshot {
  const version = ctx.getVersion();
  const settings = getSettings(ctx);

  const titles: Record<string, TitleDoc> = {};
  const titleRows = ctx.db.prepare('SELECT id, data FROM titles').all() as Array<{
    id: string;
    data: string;
  }>;
  for (const row of titleRows) {
    const data = JSON.parse(row.data) as Omit<TitleDoc, 'id'>;
    titles[row.id] = { ...data, id: row.id };
  }

  const seasonsByTitle: Record<string, SeasonDoc[]> = {};
  const seasonRows = ctx.db
    .prepare('SELECT title_id, season_number, data FROM seasons ORDER BY season_number ASC')
    .all() as Array<{
    title_id: string;
    season_number: number;
    data: string;
  }>;
  for (const row of seasonRows) {
    const season = JSON.parse(row.data) as SeasonDoc;
    if (!seasonsByTitle[row.title_id]) {
      seasonsByTitle[row.title_id] = [];
    }
    seasonsByTitle[row.title_id].push(season);
  }

  const progressByTitle: Record<string, Record<string, ProgressDoc>> = {};
  const progressRows = ctx.db
    .prepare('SELECT title_id, playthrough_id, data FROM progress')
    .all() as Array<{
    title_id: string;
    playthrough_id: string;
    data: string;
  }>;
  for (const row of progressRows) {
    const data = JSON.parse(row.data) as StoredProgressData;
    if (!progressByTitle[row.title_id]) {
      progressByTitle[row.title_id] = {};
    }
    progressByTitle[row.title_id][row.playthrough_id] = {
      playthroughId: row.playthrough_id,
      watched: data.watched || {},
      archivedWatched: data.archivedWatched,
      ...(data.movieWatchedAt !== undefined ? { movieWatchedAt: data.movieWatchedAt } : {}),
    };
  }

  const lists: Record<string, WatchListDoc> = {};
  const listRows = ctx.db
    .prepare('SELECT id, data, rank FROM lists ORDER BY rank ASC')
    .all() as Array<{
    id: string;
    data: string;
    rank: string;
  }>;
  for (const row of listRows) {
    const data = JSON.parse(row.data) as Omit<WatchListDoc, 'id'>;
    lists[row.id] = { ...data, id: row.id, rank: row.rank };
  }

  const entriesByList: Record<string, ListEntryDoc[]> = {};
  const entryRows = ctx.db
    .prepare('SELECT id, list_id, title_id, rank, data FROM list_entries ORDER BY rank ASC')
    .all() as Array<{
    id: string;
    list_id: string;
    title_id: string;
    rank: string;
    data: string;
  }>;
  for (const row of entryRows) {
    const data = JSON.parse(row.data) as Omit<ListEntryDoc, 'id'>;
    if (!entriesByList[row.list_id]) {
      entriesByList[row.list_id] = [];
    }
    entriesByList[row.list_id].push({
      ...data,
      id: row.id,
      titleId: row.title_id,
      rank: row.rank,
    });
  }

  return {
    version,
    titles,
    seasonsByTitle,
    progressByTitle,
    lists,
    entriesByList,
    settings,
  };
}

export function exportData(
  ctx: DbContext,
  exportedAt = new Date().toISOString()
): ZhenjiExportV2 {
  const state = getState(ctx);
  return {
    format: 'zhenji-export',
    version: 2,
    exportedAt,
    settings: state.settings,
    titles: state.titles,
    seasonsByTitle: state.seasonsByTitle,
    progressByTitle: state.progressByTitle,
    lists: state.lists,
    entriesByList: state.entriesByList,
  };
}

export function importData(
  ctx: DbContext,
  rawInput: unknown,
  options: { skipBackup?: boolean; now?: Date } = {}
): StateMutationResult {
  const parsed = importPayloadSchema.parse(rawInput);

  if (!options.skipBackup) {
    createSafetyBackup(ctx, 'pre-import', options.now);
  }

  return ctx.runInTransaction(() => {
    const oldTitleIds = (
      ctx.db.prepare('SELECT id FROM titles').all() as Array<{ id: string }>
    ).map((r) => r.id);
    const oldListIds = (
      ctx.db.prepare('SELECT id FROM lists').all() as Array<{ id: string }>
    ).map((r) => r.id);

    ctx.db.prepare('DELETE FROM list_entries').run();
    ctx.db.prepare('DELETE FROM lists').run();
    ctx.db.prepare('DELETE FROM progress').run();
    ctx.db.prepare('DELETE FROM seasons').run();
    ctx.db.prepare('DELETE FROM titles').run();

    const settings: AppSettingsDoc = {
      ...structuredClone(DEFAULT_APP_SETTINGS),
      ...parsed.settings,
    };
    ctx.db
      .prepare(
        `INSERT INTO settings (key, data) VALUES ('app', ?)
         ON CONFLICT(key) DO UPDATE SET data = excluded.data`
      )
      .run(JSON.stringify(settings));

    const insertTitle = ctx.db.prepare(
      'INSERT INTO titles (id, data, added_at, updated_at) VALUES (?, ?, ?, ?)'
    );
    const titles: Record<string, TitleDoc> = {};
    for (const [id, title] of Object.entries(parsed.titles)) {
      const titleDoc: TitleDoc = { ...title, id };
      if (parsed.version === 1) {
        if ((titleDoc.source === 'url' || titleDoc.source === 'custom') && titleDoc.overview?.zh) {
          const split = splitUploaderPrefixFromOverview(titleDoc.overview.zh);
          if (split.uploader) {
            titleDoc.uploader = titleDoc.uploader || split.uploader;
            titleDoc.overview = { ...titleDoc.overview, zh: split.overview };
          }
        }
        if (
          (!titleDoc.genreIds || titleDoc.genreIds.length === 0) &&
          Array.isArray(titleDoc.genres) &&
          titleDoc.genres.length > 0
        ) {
          const ids = extractGenreIdsFromNames(titleDoc.genres);
          if (ids.length > 0) {
            titleDoc.genreIds = ids;
          }
        }
      }
      titles[id] = titleDoc;
      insertTitle.run(id, serializeTitleData(titleDoc), titleDoc.addedAt, titleDoc.updatedAt);
    }

    const insertSeason = ctx.db.prepare(
      'INSERT INTO seasons (title_id, season_number, data) VALUES (?, ?, ?)'
    );
    const seasonsByTitle: Record<string, SeasonDoc[]> = {};
    for (const [titleId, seasons] of Object.entries(parsed.seasonsByTitle)) {
      if (!titles[titleId]) continue;
      const sorted = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
      seasonsByTitle[titleId] = sorted;
      for (const s of sorted) {
        insertSeason.run(titleId, s.seasonNumber, JSON.stringify(s));
      }
    }

    const insertProgress = ctx.db.prepare(
      'INSERT INTO progress (title_id, playthrough_id, data) VALUES (?, ?, ?)'
    );
    const progressByTitle: Record<string, Record<string, ProgressDoc>> = {};
    for (const [titleId, progMap] of Object.entries(parsed.progressByTitle)) {
      if (!titles[titleId]) continue;
      progressByTitle[titleId] = {};
      for (const [ptId, pDoc] of Object.entries(progMap)) {
        const payload: StoredProgressData = {
          watched: pDoc.watched || {},
          archivedWatched: pDoc.archivedWatched,
          ...(pDoc.movieWatchedAt !== undefined ? { movieWatchedAt: pDoc.movieWatchedAt } : {}),
        };
        insertProgress.run(titleId, ptId, JSON.stringify(payload));
        progressByTitle[titleId][ptId] = {
          playthroughId: ptId,
          watched: payload.watched,
          archivedWatched: payload.archivedWatched,
          ...(payload.movieWatchedAt !== undefined
            ? { movieWatchedAt: payload.movieWatchedAt }
            : {}),
        };
      }
    }

    const insertList = ctx.db.prepare('INSERT INTO lists (id, data, rank) VALUES (?, ?, ?)');
    const lists: Record<string, WatchListDoc> = {};
    for (const [listId, list] of Object.entries(parsed.lists)) {
      const listDoc: WatchListDoc = { ...list, id: listId };
      lists[listId] = listDoc;
      insertList.run(listId, serializeListData(listDoc), listDoc.rank);
    }

    const insertEntry = ctx.db.prepare(
      'INSERT INTO list_entries (id, list_id, title_id, rank, data) VALUES (?, ?, ?, ?, ?)'
    );
    const entriesByList: Record<string, ListEntryDoc[]> = {};
    for (const [listId, entries] of Object.entries(parsed.entriesByList)) {
      if (!lists[listId]) continue;
      const validEntries: ListEntryDoc[] = [];
      for (const entry of entries) {
        if (!titles[entry.titleId]) continue;
        const entryDoc: ListEntryDoc = { ...entry };
        validEntries.push(entryDoc);
        insertEntry.run(
          entryDoc.id,
          listId,
          entryDoc.titleId,
          entryDoc.rank,
          serializeEntryData(entryDoc)
        );
      }
      validEntries.sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
      entriesByList[listId] = validEntries;
    }

    const removedTitles = oldTitleIds.filter((id) => !titles[id]);
    const removedLists = oldListIds.filter((id) => !lists[id]);

    const version = ctx.bumpVersionInTx();
    return {
      version,
      replace: true,
      upserts: {
        titles,
        seasonsByTitle,
        progressByTitle,
        lists,
        entriesByList,
        settings,
      },
      deletes: {
        ...(removedTitles.length > 0 ? { titles: removedTitles } : {}),
        ...(removedLists.length > 0 ? { lists: removedLists } : {}),
      },
    };
  });
}
