import { TmdbSourcePicker } from './TmdbSourcePicker';
import { resolveLocalizedText } from '../../domain/ordering';
import { useState } from 'react';
import { Alert, Button, Card, Modal, toast } from '@heroui/react';
import { useTracker } from '../../context/TrackerContext';
import { previewStructureApi } from '../../data/api';
import type { StructurePreview } from '../../domain/structure';
import type { TitleDoc } from '../../domain/types';
import { useI18n } from '../../i18n';

export function UpstreamPanel({ title }: { title: TitleDoc }) {
  const { t, locale, translateError } = useI18n();
  const { resolveStructure, changeTitleSource, progressByTitle } = useTracker();
  const [preview, setPreview] = useState<StructurePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickingSource, setPickingSource] = useState(false);

  const archived = Object.values(progressByTitle[title.id] || {}).reduce(
    (sum, p) => sum + (p.archivedWatched?.length || 0),
    0,
  );
  if (!title.upstreamChange && !title.sourceUnavailable && !archived) return null;
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.danger(translateError(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <Card.Header>
        <Card.Title>{t.upstream.title}</Card.Title>
      </Card.Header>
      <Card.Content className="space-y-4">
        {archived > 0 && <p>{t.upstream.archivedCount(archived)}</p>}
        {title.sourceUnavailable && (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t.upstream.unavailable}</Alert.Title>
              <Alert.Description>{t.upstream.unavailableHint}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        {title.upstreamChange && (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t.upstream.changed}</Alert.Title>
              <Alert.Description>{t.upstream.changedHint}</Alert.Description>
              <Button
                variant="secondary"
                isDisabled={busy}
                onPress={() =>
                  void run(async () => {
                    setPreview(await previewStructureApi(title.id));
                  })
                }
              >
                {t.upstream.preview}
              </Button>
            </Alert.Content>
          </Alert>
        )}
        {title.sourceUnavailable && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" isDisabled={busy} onPress={() => setPickingSource(true)}>
                {t.upstream.relink}
              </Button>
              <Button
                variant="secondary"
                isDisabled={busy}
                onPress={() => void run(() => changeTitleSource(title.id, { action: 'manual' }))}
              >
                {t.upstream.manual}
              </Button>
            </div>
          </div>
        )}
      </Card.Content>
      {pickingSource && (
        <TmdbSourcePicker
          title={title}
          busy={busy}
          onClose={() => setPickingSource(false)}
          onSelect={(item) =>
            void run(async () => {
              await changeTitleSource(title.id, {
                action: 'relink',
                sourceId: item.sourceId,
                mediaType: item.mediaType,
              });
              setPickingSource(false);
            })
          }
        />
      )}
      <Modal.Backdrop
        isOpen={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open && !busy) setPreview(null);
        }}
        isDismissable={!busy}
        isKeyboardDismissDisabled={busy}
      >
        <Modal.Container size="md" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{t.upstream.previewTitle}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-3">
              <p>{t.upstream.previewHint}</p>
              {preview && (
                <>
                  <p>{t.upstream.seasonSummary(preview.localSeasons, preview.sourceSeasons)}</p>
                  <p>{t.upstream.counts(preview.migrated, preview.archived)}</p>
                  <div className="space-y-2">
                    {preview.changes.map((change, index) => (
                      <p key={index}>
                        {change.from
                          ? [
                              t.upstream.episodeRef(change.from.seasonNumber, change.from.episodeNumber),
                              resolveLocalizedText(change.from.name, locale),
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          : t.upstream.added}
                        {' → '}
                        {change.to
                          ? [
                              t.upstream.episodeRef(change.to.seasonNumber, change.to.episodeNumber),
                              resolveLocalizedText(change.to.name, locale),
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          : t.upstream.archived}
                      </p>
                    ))}
                  </div>
                </>
              )}
              {title.structureLocked && <p>{t.upstream.lockedHint}</p>}
            </Modal.Body>
            <Modal.Footer className="flex-wrap">
              <Button variant="ghost" isDisabled={busy} onPress={() => setPreview(null)}>
                {t.app.close}
              </Button>
              <Button
                variant="secondary"
                isDisabled={busy}
                onPress={() =>
                  void run(async () => {
                    if (preview) {
                      await resolveStructure(title.id, {
                        version: preview.version,
                        signature: preview.signature,
                        decision: 'keep',
                      });
                      setPreview(null);
                    }
                  })
                }
              >
                {t.upstream.keep}
              </Button>
              <Button
                isDisabled={busy || title.structureLocked}
                onPress={() =>
                  void run(async () => {
                    if (preview) {
                      await resolveStructure(title.id, {
                        version: preview.version,
                        signature: preview.signature,
                        decision: 'adopt',
                      });
                      setPreview(null);
                    }
                  })
                }
              >
                {t.upstream.adopt}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Card>
  );
}
