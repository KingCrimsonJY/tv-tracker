import React, { useEffect, useState } from 'react';
import { ListVideo } from 'lucide-react';
import { Button } from '@heroui/react';
import { MediaImage } from '../../components/MediaImage';
import type { CustomTitleInput } from '../../context/TrackerContext';
import type { LinkImportResult, MediaType } from '../../domain/types';
import { zh } from '../../i18n/zh';

interface ManualItemDialogProps {
  initialSeed?: LinkImportResult | null;
  onSubmitCustomItem: (input: CustomTitleInput) => Promise<void>;
}

export const ManualItemDialog: React.FC<ManualItemDialogProps> = ({
  initialSeed,
  onSubmitCustomItem,
}) => {
  const [manualName, setManualName] = useState(initialSeed?.title || '');
  const [manualOrigName, setManualOrigName] = useState('');
  const [manualType, setManualType] = useState<MediaType>(
    initialSeed ? 'other' : 'movie'
  );
  const [manualYear, setManualYear] = useState(
    initialSeed?.year ? String(initialSeed.year) : ''
  );
  const [manualPoster, setManualPoster] = useState(initialSeed?.posterUrl || '');
  const [manualEpisodes, setManualEpisodes] = useState(
    initialSeed?.episodes && initialSeed.episodes.length > 0
      ? String(initialSeed.episodes.length)
      : ''
  );
  const [manualRuntime, setManualRuntime] = useState(
    initialSeed?.runtimeMin ? String(initialSeed.runtimeMin) : ''
  );
  const [manualOverview, setManualOverview] = useState(
    initialSeed?.overview || ''
  );
  const [manualSourceUrl, setManualSourceUrl] = useState(
    initialSeed?.sourceUrl || ''
  );
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSeed) {
      setManualName(initialSeed.title);
      setManualOrigName('');
      setManualPoster(initialSeed.posterUrl || '');
      setManualOverview(initialSeed.overview || '');
      setManualSourceUrl(initialSeed.sourceUrl);
      setManualYear(initialSeed.year ? String(initialSeed.year) : '');
      setManualRuntime(
        initialSeed.runtimeMin ? String(initialSeed.runtimeMin) : ''
      );
      setManualEpisodes(
        initialSeed.episodes && initialSeed.episodes.length > 0
          ? String(initialSeed.episodes.length)
          : ''
      );
      setManualType('other');
      setManualError(null);
    }
  }, [initialSeed]);

  const seedEpisodes =
    initialSeed?.episodes && initialSeed.episodes.length > 0
      ? initialSeed.episodes
      : undefined;

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) {
      setManualError(zh.search.manual.namePlaceholder);
      return;
    }

    const epCount = manualEpisodes.trim()
      ? Math.max(0, Math.floor(Number(manualEpisodes)))
      : seedEpisodes?.length;
    const yr = manualYear.trim() ? Number(manualYear) : undefined;
    const rt = manualRuntime.trim() ? Number(manualRuntime) : undefined;

    await onSubmitCustomItem({
      source: manualSourceUrl.trim() ? 'url' : 'custom',
      name: manualName.trim(),
      originalName: manualOrigName.trim() || undefined,
      mediaType: manualType,
      posterPath: manualPoster.trim() || null,
      episodeCount: epCount,
      episodes: seedEpisodes,
      overview: manualOverview.trim() || undefined,
      sourceUrl: manualSourceUrl.trim() || undefined,
      year: yr && Number.isFinite(yr) ? yr : null,
      runtimeMin: rt && Number.isFinite(rt) ? rt : null,
    });
  };

  return (
    <section className="max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-5">
      <div className="flex items-start gap-4">
        {manualPoster.trim() && (
          <div className="w-20 sm:w-24 shrink-0 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface-secondary)]">
            <MediaImage
              src={manualPoster.trim()}
              alt={manualName || zh.search.manual.ParsedPreviewTitle}
              aspect="poster"
              mediaType={manualType}
            />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {manualSourceUrl
              ? zh.search.manual.ParsedPreviewTitle
              : zh.search.manual.title}
          </h2>
          {seedEpisodes && (
            <p className="text-xs font-medium text-[var(--accent-text)]">
              {zh.search.linkImport.playlistPreviewLabel(seedEpisodes.length)}
            </p>
          )}
        </div>
      </div>

      {seedEpisodes && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--foreground)]">
            <span className="inline-flex items-center gap-1.5">
              <ListVideo className="w-4 h-4 text-[var(--accent-text)]" />
              <span>
                {zh.search.linkImport.playlistPreviewLabel(seedEpisodes.length)}
              </span>
            </span>
          </div>
          <ul className="space-y-1 text-xs text-[var(--muted)]">
            {seedEpisodes.slice(0, 5).map((ep, idx) => (
              <li key={ep.sourceVideoId || idx} className="truncate">
                <span className="font-mono text-[var(--foreground-secondary)] mr-1.5">
                  E{idx + 1}
                </span>
                <span>{ep.name}</span>
              </li>
            ))}
            {seedEpisodes.length > 5 && (
              <li className="text-[var(--muted)] pt-0.5">
                {zh.search.linkImport.playlistMoreEpisodes(
                  seedEpisodes.length - 5
                )}
              </li>
            )}
          </ul>
        </div>
      )}

      <form onSubmit={handleManualSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label
              htmlFor="manual-title"
              className="block text-xs text-[var(--muted)] mb-1"
            >
              {zh.search.manual.nameLabel}
            </label>
            <input
              id="manual-title"
              type="text"
              required
              value={manualName}
              onChange={(e) => {
                setManualName(e.target.value);
                setManualError(null);
              }}
              placeholder={zh.search.manual.namePlaceholder}
              className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]"
            />
          </div>

          <div>
            <label
              htmlFor="manual-orig-title"
              className="block text-xs text-[var(--muted)] mb-1"
            >
              {zh.search.manual.originalNameLabel}
            </label>
            <input
              id="manual-orig-title"
              type="text"
              value={manualOrigName}
              onChange={(e) => setManualOrigName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label
              htmlFor="manual-type"
              className="block text-xs text-[var(--muted)] mb-1"
            >
              {zh.search.manual.typeLabel}
            </label>
            <select
              id="manual-type"
              value={manualType}
              onChange={(e) => setManualType(e.target.value as MediaType)}
              className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]"
            >
              <option value="movie">{zh.mediaType.movie}</option>
              <option value="tv">{zh.mediaType.tv}</option>
              <option value="other">{zh.mediaType.other}</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="manual-year"
              className="block text-xs text-[var(--muted)] mb-1"
            >
              {zh.search.manual.yearLabel}
            </label>
            <input
              id="manual-year"
              type="number"
              value={manualYear}
              onChange={(e) => setManualYear(e.target.value)}
              placeholder="2025"
              className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="manual-runtime"
              className="block text-xs text-[var(--muted)] mb-1"
            >
              {zh.search.manual.runtimeLabel}
            </label>
            <input
              id="manual-runtime"
              type="number"
              value={manualRuntime}
              onChange={(e) => setManualRuntime(e.target.value)}
              placeholder="45"
              className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] tabular-nums"
            />
          </div>
        </div>

        {!seedEpisodes && (
          <div>
            <label
              htmlFor="manual-episodes"
              className="block text-xs text-[var(--muted)] mb-1"
            >
              {zh.search.manual.episodeCountLabel}
            </label>
            <input
              id="manual-episodes"
              type="number"
              min="1"
              max="2000"
              value={manualEpisodes}
              onChange={(e) => setManualEpisodes(e.target.value)}
              placeholder={zh.search.manual.episodeCountPlaceholder}
              className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] tabular-nums"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="manual-poster"
            className="block text-xs text-[var(--muted)] mb-1"
          >
            {zh.search.manual.posterUrlLabel}
          </label>
          <input
            id="manual-poster"
            type="text"
            value={manualPoster}
            onChange={(e) => setManualPoster(e.target.value)}
            placeholder={zh.search.manual.posterUrlPlaceholder}
            className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]"
          />
        </div>

        {manualSourceUrl && (
          <div>
            <label
              htmlFor="manual-source"
              className="block text-xs text-[var(--muted)] mb-1"
            >
              {zh.search.manual.sourceUrlLabel}
            </label>
            <input
              id="manual-source"
              type="text"
              value={manualSourceUrl}
              onChange={(e) => setManualSourceUrl(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="manual-overview"
            className="block text-xs text-[var(--muted)] mb-1"
          >
            {zh.search.manual.overviewLabel}
          </label>
          <textarea
            id="manual-overview"
            rows={3}
            value={manualOverview}
            onChange={(e) => setManualOverview(e.target.value)}
            className="w-full p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]"
          />
        </div>

        {manualError && (
          <p className="text-xs text-[var(--danger)]">{manualError}</p>
        )}

        <div className="pt-2">
          <Button type="submit" variant="primary">
            {zh.search.manual.submitButton}
          </Button>
        </div>
      </form>
    </section>
  );
};
