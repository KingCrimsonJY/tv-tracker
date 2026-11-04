import React, { useEffect, useState } from 'react';
import { ListVideo } from 'lucide-react';
import {
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  Spinner,
  TextArea,
  TextField,
} from '@heroui/react';
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
  const [manualYear, setManualYear] = useState<number>(
    initialSeed?.year ?? Number.NaN
  );
  const [manualPoster, setManualPoster] = useState(initialSeed?.posterUrl || '');
  const [manualEpisodes, setManualEpisodes] = useState<number>(
    initialSeed?.episodes && initialSeed.episodes.length > 0
      ? initialSeed.episodes.length
      : Number.NaN
  );
  const [manualRuntime, setManualRuntime] = useState<number>(
    initialSeed?.runtimeMin ?? Number.NaN
  );
  const [manualOverview, setManualOverview] = useState(
    initialSeed?.overview || ''
  );
  const [manualSourceUrl, setManualSourceUrl] = useState(
    initialSeed?.sourceUrl || ''
  );
  const [manualError, setManualError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialSeed) {
      setManualName(initialSeed.title);
      setManualOrigName('');
      setManualPoster(initialSeed.posterUrl || '');
      setManualOverview(initialSeed.overview || '');
      setManualSourceUrl(initialSeed.sourceUrl);
      setManualYear(initialSeed.year ?? Number.NaN);
      setManualRuntime(initialSeed.runtimeMin ?? Number.NaN);
      setManualEpisodes(
        initialSeed.episodes && initialSeed.episodes.length > 0
          ? initialSeed.episodes.length
          : Number.NaN
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

    const epCount = Number.isFinite(manualEpisodes)
      ? Math.max(0, Math.floor(manualEpisodes))
      : seedEpisodes?.length;
    const yr = Number.isFinite(manualYear) ? manualYear : undefined;
    const rt = Number.isFinite(manualRuntime) ? manualRuntime : undefined;

    setSubmitting(true);
    try {
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
    } finally {
      setSubmitting(false);
    }
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
          <TextField
            value={manualName}
            onChange={(val) => {
              setManualName(val);
              setManualError(null);
            }}
            isInvalid={Boolean(manualError)}
            isRequired
            variant="secondary"
            fullWidth
          >
            <Label>{zh.search.manual.nameLabel}</Label>
            <Input placeholder={zh.search.manual.namePlaceholder} />
            {manualError && <FieldError>{manualError}</FieldError>}
          </TextField>

          <TextField
            value={manualOrigName}
            onChange={setManualOrigName}
            variant="secondary"
            fullWidth
          >
            <Label>{zh.search.manual.originalNameLabel}</Label>
            <Input />
          </TextField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Select
            selectedKey={manualType}
            onSelectionChange={(key) => {
              if (key != null) setManualType(key as MediaType);
            }}
            variant="secondary"
            fullWidth
          >
            <Label>{zh.search.manual.typeLabel}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox aria-label={zh.search.manual.typeLabel}>
                {(
                  [
                    { id: 'movie', label: zh.mediaType.movie },
                    { id: 'tv', label: zh.mediaType.tv },
                    { id: 'other', label: zh.mediaType.other },
                  ] as const
                ).map((item) => (
                  <ListBox.Item
                    key={item.id}
                    id={item.id}
                    textValue={item.label}
                  >
                    <Label>{item.label}</Label>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <NumberField
            value={manualYear}
            onChange={setManualYear}
            minValue={1888}
            maxValue={2100}
            formatOptions={{ useGrouping: false }}
            variant="secondary"
            fullWidth
          >
            <Label>{zh.search.manual.yearLabel}</Label>
            <NumberField.Group>
              <NumberField.Input placeholder="2025" />
            </NumberField.Group>
          </NumberField>

          <NumberField
            value={manualRuntime}
            onChange={setManualRuntime}
            minValue={1}
            maxValue={10000}
            formatOptions={{ useGrouping: false }}
            variant="secondary"
            fullWidth
          >
            <Label>{zh.search.manual.runtimeLabel}</Label>
            <NumberField.Group>
              <NumberField.Input placeholder="45" />
            </NumberField.Group>
          </NumberField>
        </div>

        {!seedEpisodes && (
          <NumberField
            value={manualEpisodes}
            onChange={setManualEpisodes}
            minValue={1}
            maxValue={2000}
            formatOptions={{ useGrouping: false }}
            variant="secondary"
            fullWidth
          >
            <Label>{zh.search.manual.episodeCountLabel}</Label>
            <NumberField.Group>
              <NumberField.Input
                placeholder={zh.search.manual.episodeCountPlaceholder}
              />
            </NumberField.Group>
          </NumberField>
        )}

        <TextField
          value={manualPoster}
          onChange={setManualPoster}
          variant="secondary"
          fullWidth
        >
          <Label>{zh.search.manual.posterUrlLabel}</Label>
          <Input placeholder={zh.search.manual.posterUrlPlaceholder} />
        </TextField>

        {manualSourceUrl && (
          <TextField
            value={manualSourceUrl}
            onChange={setManualSourceUrl}
            variant="secondary"
            fullWidth
          >
            <Label>{zh.search.manual.sourceUrlLabel}</Label>
            <Input />
          </TextField>
        )}

        <TextField
          value={manualOverview}
          onChange={setManualOverview}
          variant="secondary"
          fullWidth
        >
          <Label>{zh.search.manual.overviewLabel}</Label>
          <TextArea rows={3} />
        </TextField>

        <div className="pt-2">
          <Button type="submit" variant="primary" isPending={submitting}>
            {submitting && <Spinner size="sm" color="current" />}
            <span>{zh.search.manual.submitButton}</span>
          </Button>
        </div>
      </form>
    </section>
  );
};
