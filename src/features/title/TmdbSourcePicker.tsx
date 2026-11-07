import { useEffect, useState } from 'react';
import { Button, Label, ListBox, Modal, SearchField } from '@heroui/react';
import { searchTmdbApi } from '../../data/api';
import type { TitleDoc, TmdbSearchItem } from '../../domain/types';
import { useI18n } from '../../i18n';

export function TmdbSourcePicker({
  title,
  busy,
  onClose,
  onSelect,
}: {
  title: TitleDoc;
  busy: boolean;
  onClose: () => void;
  onSelect: (item: TmdbSearchItem) => void;
}) {
  const { t, locale, translateError } = useI18n();
  const [query, setQuery] = useState(title.names.zh || title.names.en || title.names.original);
  const [results, setResults] = useState<TmdbSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setResults([]);
    setError('');
    if (!query.trim()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      void searchTmdbApi(query.trim(), locale === 'en' ? 'en-US' : 'zh-CN', controller.signal)
        .then((response) => {
          if (!controller.signal.aborted) {
            setResults(
              response.results.filter((item) => title.mediaType === 'other' || item.mediaType === title.mediaType),
            );
            if (response.configured === false) setError(translateError({ code: 'TMDB_NOT_CONFIGURED' }));
          }
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) setError(translateError(cause));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, locale, title.mediaType, translateError]);
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      isDismissable={!busy}
    >
      <Modal.Container size="md" scroll="inside">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t.upstream.relink}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-3">
            <SearchField value={query} onChange={setQuery} isDisabled={busy}>
              <Label>{t.upstream.search}</Label>
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <p className="text-sm text-muted">{t.upstream.sourceHint}</p>
            <p role="status">{error || (loading ? t.app.loading : !results.length ? t.upstream.noResults : '')}</p>
            <ListBox
              aria-label={t.upstream.search}
              onAction={(key) => {
                const result = results.find((item) => item.id === key);
                if (result && !busy) onSelect(result);
              }}
            >
              {results.map((item) => {
                const name = (locale === 'en' ? item.names.en : item.names.zh) || item.names.original;
                return (
                  <ListBox.Item id={item.id} key={item.id} textValue={name} isDisabled={busy}>
                    <Label>
                      {name} {item.year ? '(' + item.year + ')' : ''} · {t.mediaType[item.mediaType]}
                    </Label>
                  </ListBox.Item>
                );
              })}
            </ListBox>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" isDisabled={busy} onPress={onClose}>
              {t.app.cancel}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
