import React, { useState, useEffect } from 'react';
import {
  Modal,
  Alert,
  TextField,
  NumberField,
  Label,
  Input,
  TextArea,
  FieldError,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  toast,
} from '@heroui/react';
import { useTracker } from '../../context/TrackerContext';
import { MediaType } from '../../domain/types';
import type { ManualSeed } from './linkImportModel';
import { useI18n } from '../../i18n';

interface ManualItemDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialSeed: ManualSeed | null;
  onCreated: (titleId: string) => void;
}

export const ManualItemDialog: React.FC<ManualItemDialogProps> = ({ isOpen, onOpenChange, initialSeed, onCreated }) => {
  const { createCustomOrLinkTitle } = useTracker(() => null);
  const { t, translateError } = useI18n();

  const [title, setTitle] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('movie');
  const [posterUrl, setPosterUrl] = useState('');
  const [overview, setOverview] = useState('');
  const [episodeCount, setEpisodeCount] = useState('0');
  const [year, setYear] = useState('');
  const [runtime, setRuntime] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialSeed) {
        setYear(initialSeed.year == null ? '' : String(initialSeed.year));
        setRuntime(initialSeed.runtimeMin == null ? '' : String(initialSeed.runtimeMin));
        setTitle(initialSeed.title);
        setMediaType(initialSeed.mediaType);
        setPosterUrl(initialSeed.posterUrl);
        setOverview(initialSeed.overview);
        setEpisodeCount(String(initialSeed.episodeCount || 0));
      } else {
        setYear('');
        setRuntime('');
        setTitle('');
        setMediaType('movie');
        setPosterUrl('');
        setOverview('');
        setEpisodeCount('0');
      }
    }
  }, [isOpen, initialSeed]);

  const invalidYear = year !== '' && (!Number.isInteger(Number(year)) || Number(year) < 1800 || Number(year) > 2200);
  const invalidRuntime =
    runtime !== '' && (!Number.isFinite(Number(runtime)) || Number(runtime) < 0 || Number(runtime) > 100000);
  const invalidCount =
    mediaType !== 'movie' &&
    (!Number.isInteger(Number(episodeCount)) || Number(episodeCount) < 0 || Number(episodeCount) > 2000);
  const invalid = invalidYear || invalidRuntime || invalidCount;

  const handleSave = async () => {
    if (!title.trim() || invalid || saving) return;
    setSaving(true);
    try {
      const epCount = Math.max(0, parseInt(episodeCount, 10) || 0);
      const createdDoc = await createCustomOrLinkTitle({
        name: title.trim(),
        mediaType,
        year: year === '' ? null : Number(year),
        runtimeMin: runtime === '' ? null : Number(runtime),
        posterPath: posterUrl.trim() || null,
        overview: overview.trim(),
        uploader: initialSeed?.uploader ?? null,
        episodeCount: mediaType === 'movie' ? 0 : epCount,
        episodes:
          mediaType !== 'movie' && initialSeed?.episodes && initialSeed.episodes.length === epCount
            ? initialSeed.episodes
            : undefined,
        source: initialSeed?.source ?? 'custom',
        sourceUrl: initialSeed?.sourceUrl ?? null,
      });
      onCreated(createdDoc.id);
    } catch (err) {
      toast.danger(translateError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="md" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t.app.close} />
          <Modal.Header>
            <Modal.Heading>
              {initialSeed?.source === 'url' ? t.search.manual.parsedPreviewTitle : t.search.manual.title}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            {Boolean(initialSeed?.skippedCount) && <p>{t.upstream.skippedEntries(initialSeed?.skippedCount || 0)}</p>}
            {initialSeed?.warning && (
              <Alert status="warning">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{translateError({ code: initialSeed.warning })}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
            <TextField value={title} onChange={setTitle} isRequired>
              <Label>{t.search.manual.nameLabel}</Label>
              <Input placeholder={t.search.manual.namePlaceholder} />
            </TextField>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted">{t.search.manual.typeLabel}</Label>
              <div>
                <ToggleButtonGroup
                  aria-label={t.search.manual.typeLabel}
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={new Set([mediaType])}
                  onSelectionChange={(keys) => {
                    const k = Array.from(keys)[0] as MediaType;
                    if (k) {
                      setMediaType(k);
                      if (k === 'tv' && episodeCount === '0' && !initialSeed) {
                        setEpisodeCount('12');
                      }
                    }
                  }}
                  size="sm"
                >
                  <ToggleButton id="movie">{t.mediaType.movie}</ToggleButton>
                  <ToggleButton id="tv">{t.mediaType.tv}</ToggleButton>
                  <ToggleButton id="other">{t.mediaType.other}</ToggleButton>
                </ToggleButtonGroup>
              </div>
            </div>

            <div className="grid grid-cols-1 min-[390px]:grid-cols-2 items-end gap-3">
              <NumberField
                value={year === '' ? NaN : Number(year)}
                onChange={(value) => setYear(value == null || Number.isNaN(value) ? '' : String(value))}
                minValue={1800}
                maxValue={2200}
                formatOptions={{ useGrouping: false }}
                isInvalid={invalidYear}
              >
                <Label>{t.search.manual.yearLabel}</Label>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input />
                  <NumberField.IncrementButton />
                </NumberField.Group>
                <FieldError>{t.search.manual.invalidYear}</FieldError>
              </NumberField>
              <NumberField
                value={runtime === '' ? NaN : Number(runtime)}
                onChange={(value) => setRuntime(value == null || Number.isNaN(value) ? '' : String(value))}
                minValue={0}
                maxValue={100000}
                formatOptions={{ useGrouping: false }}
                isInvalid={invalidRuntime}
              >
                <Label>{t.search.manual.runtimeLabel}</Label>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input />
                  <NumberField.IncrementButton />
                </NumberField.Group>
                <FieldError>{t.search.manual.invalidRuntime}</FieldError>
              </NumberField>
            </div>

            <TextField value={posterUrl} onChange={setPosterUrl}>
              <Label>{t.search.manual.posterUrlLabel}</Label>
              <Input placeholder={t.search.manual.posterUrlPlaceholder} type="url" />
            </TextField>

            {mediaType !== 'movie' && (
              <NumberField
                value={episodeCount === '' ? NaN : Number(episodeCount)}
                onChange={(value) => setEpisodeCount(value == null || Number.isNaN(value) ? '' : String(value))}
                minValue={0}
                maxValue={2000}
                formatOptions={{ useGrouping: false }}
                isInvalid={invalidCount}
              >
                <Label>{t.search.manual.episodeCountLabel}</Label>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input />
                  <NumberField.IncrementButton />
                </NumberField.Group>
                <FieldError>{t.search.manual.invalidCount}</FieldError>
              </NumberField>
            )}

            <TextField value={overview} onChange={setOverview}>
              <Label>{t.search.manual.overviewLabel}</Label>
              <TextArea rows={3} />
            </TextField>

            {initialSeed?.episodes && initialSeed.episodes.length > 0 && mediaType !== 'movie' && (
              <div className="p-3 rounded-lg bg-surface-secondary text-xs text-muted space-y-1 max-h-36 overflow-y-auto">
                <div className="font-medium text-foreground">
                  {t.search.linkImport.playlistPreviewLabel(initialSeed.episodes.length)}
                </div>
                {initialSeed.episodes.slice(0, 10).map((ep, idx) => (
                  <div key={idx} className="truncate">
                    {idx + 1}. {ep.name || t.detail.seasons.episodeDefaultName(idx + 1)}
                  </div>
                ))}
                {initialSeed.episodes.length > 10 && (
                  <div>{t.search.linkImport.playlistMoreEpisodes(initialSeed.episodes.length - 10)}</div>
                )}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="gap-2">
            <Button variant="tertiary" onPress={() => onOpenChange(false)}>
              {t.app.cancel}
            </Button>
            <Button variant="primary" onPress={handleSave} isDisabled={!title.trim() || saving || invalid}>
              {saving ? t.app.loading : t.search.manual.submitButton}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};
