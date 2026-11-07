import React, { useState, useRef, useEffect } from 'react';
import { Modal, TextField, Label, Input, Button, toast } from '@heroui/react';
import { importLinkApi, LinkImportResult, TmdbSearchItem } from '../../data/api';
import { linkResultToManualSeed, type ManualSeed } from './linkImportModel';
import { useI18n } from '../../i18n';

interface LinkImportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSearchTmdb: (suggestedTitle: string) => void;
  onSelectTmdb: (hit: TmdbSearchItem) => Promise<void>;
  onParsedToManual: (seed: ManualSeed) => void;
}

export const LinkImportDialog: React.FC<LinkImportDialogProps> = ({
  isOpen,
  onOpenChange,
  onSearchTmdb,
  onSelectTmdb,
  onParsedToManual,
}) => {
  const request = useRef<AbortController | null>(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [tmdbSuggestion, setTmdbSuggestion] = useState<LinkImportResult | null>(null);
  const { t, locale, translateError } = useI18n();

  useEffect(() => {
    if (!isOpen) {
      request.current?.abort();
      setLoading(false);
      setTmdbSuggestion(null);
    }
    return () => request.current?.abort();
  }, [isOpen]);

  const finishToManual = (res: LinkImportResult) => {
    onParsedToManual(linkResultToManualSeed(res));
    setUrl('');
    setTmdbSuggestion(null);
    if (res.warning || res.fallbackUsed === 'og') {
      toast.warning(translateError({ code: res.warning || 'LINK_METADATA_INCOMPLETE' }));
    } else {
      toast.success(t.search.linkImport.parseSuccessToast);
    }
  };

  const handleParse = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setTmdbSuggestion(null);
    try {
      const res = await importLinkApi(trimmed, undefined, controller.signal);
      if (controller.signal.aborted) return;
      if (res.kind === 'tmdb-suggestion') {
        setTmdbSuggestion(res);
        return;
      }
      finishToManual(res);
    } catch (err) {
      if (!controller.signal.aborted) toast.danger(translateError(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="md" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t.app.close} />
          <Modal.Header>
            <Modal.Heading>{t.search.linkImport.title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              {t.search.linkImport.description}
            </p>
            <TextField value={url} onChange={(value) => { setUrl(value); setTmdbSuggestion(null); }} isRequired isDisabled={loading}>
              <Label>{t.search.linkImport.urlLabel}</Label>
              <Input placeholder={t.search.linkImport.urlPlaceholder} type="text" />
            </TextField>

            {tmdbSuggestion && (
              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-2.5">
                <div className="text-sm font-medium text-[var(--foreground)] break-words">
                  {t.search.linkImport.tmdbSuggestionTitle(tmdbSuggestion.seriesTitle || tmdbSuggestion.title)}
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {t.search.linkImport.tmdbSuggestionDescription}
                </p>
                <div className="flex flex-col gap-2">
                  {tmdbSuggestion.tmdbMatches?.map(hit => <Button key={hit.id} variant="secondary" className="h-auto justify-start whitespace-normal"
                    isDisabled={loading} onPress={async () => {
                      setLoading(true);
                      try { await onSelectTmdb(hit); onOpenChange(false); }
                      catch (error) { toast.danger(translateError(error)); }
                      finally { setLoading(false); }
                    }}>
                    {(locale === 'en' ? hit.names.en : hit.names.zh) || hit.names.original} · {hit.year || ''} · {t.mediaType[hit.mediaType]}
                  </Button>)}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-auto min-h-9 whitespace-normal text-left break-words"
                    variant="primary"
                    onPress={() => {
                      const q = tmdbSuggestion.seriesTitle || tmdbSuggestion.title;
                      setTmdbSuggestion(null);
                      setUrl('');
                      onSearchTmdb(q);
                    }}
                  >
                    {t.search.linkImport.searchTmdbButton(tmdbSuggestion.seriesTitle || tmdbSuggestion.title)}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => finishToManual(tmdbSuggestion)}
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
