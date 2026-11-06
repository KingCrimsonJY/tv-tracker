import React, { useState } from 'react';
import { Modal, TextField, Label, Input, Button, toast } from '@heroui/react';
import { importLinkApi, LinkImportResult } from '../../data/api';
import { LinkImportEpisodeSeed, MediaType } from '../../domain/types';
import { useI18n } from '../../i18n';

export interface ManualSeed {
  title: string;
  mediaType: MediaType;
  posterUrl: string;
  overview: string;
  uploader?: string | null;
  episodeCount: number;
  episodes?: LinkImportEpisodeSeed[];
  source: 'url' | 'custom';
  sourceUrl: string | null;
}

interface LinkImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSearchTmdb: (suggestedTitle: string) => void;
  onParsedToManual: (seed: ManualSeed) => void;
}

export const LinkImportDialog: React.FC<LinkImportDialogProps> = ({
  isOpen,
  onOpenChange,
  onSearchTmdb,
  onParsedToManual,
}) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [tmdbSuggestion, setTmdbSuggestion] = useState<LinkImportResult | null>(null);
  const { t, translateError } = useI18n();

  const finishToManual = (res: LinkImportResult, sourceUrl: string) => {
    onParsedToManual({
      title: res.title || '',
      mediaType: res.episodes && res.episodes.length > 1 ? 'other' : 'movie',
      posterUrl: res.posterUrl || '',
      overview: res.overview || '',
      uploader: res.uploader ?? null,
      episodeCount: res.episodes?.length ?? 0,
      episodes: res.episodes,
      source: 'url',
      sourceUrl: res.sourceUrl || sourceUrl,
    });
    setUrl('');
    setTmdbSuggestion(null);
    toast.success(t.search.linkImport.parseSuccessToast);
  };

  const handleParse = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setTmdbSuggestion(null);
    try {
      const res = await importLinkApi(trimmed);
      if (res.kind === 'tmdb-suggestion') {
        setTmdbSuggestion(res);
        return;
      }
      finishToManual(res, trimmed);
    } catch (err) {
      toast.danger(translateError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="md">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{t.search.linkImport.title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              {t.search.linkImport.description}
            </p>
            <TextField value={url} onChange={setUrl} isRequired>
              <Label>{t.search.linkImport.urlLabel}</Label>
              <Input placeholder={t.search.linkImport.urlPlaceholder} type="url" />
            </TextField>

            {tmdbSuggestion && (
              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-2.5">
                <div className="text-sm font-medium text-[var(--foreground)]">
                  {t.search.linkImport.tmdbSuggestionTitle(tmdbSuggestion.title)}
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {t.search.linkImport.tmdbSuggestionDescription}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="primary"
                    onPress={() => {
                      const q = tmdbSuggestion.title;
                      setTmdbSuggestion(null);
                      setUrl('');
                      onSearchTmdb(q);
                    }}
                  >
                    {t.search.linkImport.searchTmdbButton(tmdbSuggestion.title)}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => finishToManual(tmdbSuggestion, url.trim())}
                  >
                    {t.search.linkImport.addAsLinkAnywayButton}
                  </Button>
                </div>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="gap-2">
            <Button variant="tertiary" onPress={() => onOpenChange(false)}>
              {t.app.cancel}
            </Button>
            <Button
              variant="primary"
              onPress={handleParse}
              isDisabled={!url.trim() || loading}
            >
              {loading ? t.search.linkImport.parsing : t.search.linkImport.parseButton}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};
