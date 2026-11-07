import { useState } from 'react';
import { Alert, Button, Card, Description, Label, Modal, NumberField, Switch, ToggleButton, ToggleButtonGroup, toast } from '@heroui/react';
import { useTracker } from '../../context/TrackerContext';
import { previewStructureApi } from '../../data/api';
import type { StructurePreview } from '../../domain/structure';
import type { TitleDoc } from '../../domain/types';
import { useI18n } from '../../i18n';

export function UpstreamPanel({ title }: { title: TitleDoc }) {
  const { t, translateError } = useI18n();
  const { setStructureLock, resolveStructure, changeTitleSource, progressByTitle } = useTracker();
  const [preview, setPreview] = useState<StructurePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [sourceId, setSourceId] = useState(Number.NaN);
  const [sourceType, setSourceType] = useState<'movie' | 'tv'>(title.mediaType === 'movie' ? 'movie' : 'tv');
  const archived = Object.values(progressByTitle[title.id] || {}).reduce((sum, p) => sum + (p.archivedWatched?.length || 0), 0);
  if (title.source === 'custom' && !archived) return null;
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await action(); } catch (error) { toast.danger(translateError(error)); }
    finally { setBusy(false); }
  };
  return (
    <Card>
      <Card.Header><Card.Title>{t.upstream.title}</Card.Title></Card.Header>
      <Card.Content className="space-y-4">
        {title.source !== 'custom' && <Switch isSelected={Boolean(title.structureLocked)} isDisabled={busy}
          onChange={locked => void run(() => setStructureLock(title.id, locked))}>
          <Switch.Content><Switch.Control><Switch.Thumb /></Switch.Control><Label>{t.upstream.lock}</Label></Switch.Content>
          <Description>{t.upstream.lockHint}</Description>
        </Switch>}
        {archived > 0 && <p>{t.upstream.archivedCount(archived)}</p>}
        {title.sourceUnavailable && <Alert status="warning"><Alert.Indicator /><Alert.Content>
          <Alert.Title>{t.upstream.unavailable}</Alert.Title><Alert.Description>{t.upstream.unavailableHint}</Alert.Description>
        </Alert.Content></Alert>}
        {title.upstreamChange && <Alert status="warning"><Alert.Indicator /><Alert.Content>
          <Alert.Title>{t.upstream.changed}</Alert.Title><Alert.Description>{t.upstream.changedHint}</Alert.Description>
          <Button variant="secondary" isDisabled={busy} onPress={() => void run(async () => { setPreview(await previewStructureApi(title.id)); })}>{t.upstream.preview}</Button>
        </Alert.Content></Alert>}
        {title.sourceUnavailable && <div className="flex flex-col gap-3">
          {title.mediaType === 'other' && <ToggleButtonGroup aria-label={t.search.manual.typeLabel}
            selectionMode="single" disallowEmptySelection selectedKeys={new Set([sourceType])}
            onSelectionChange={keys => { const value = [...keys][0]; if (value === 'movie' || value === 'tv') setSourceType(value); }}>
            <ToggleButton id="movie">{t.mediaType.movie}</ToggleButton>
            <ToggleButton id="tv">{t.mediaType.tv}</ToggleButton>
          </ToggleButtonGroup>}
          <NumberField value={sourceId} onChange={setSourceId} minValue={1} formatOptions={{ useGrouping: false }} isDisabled={busy}>
            <Label>{t.upstream.tmdbId}</Label><NumberField.Group><NumberField.Input /></NumberField.Group>
            <Description>{t.upstream.sourceHint}</Description>
          </NumberField>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" isDisabled={busy || !Number.isSafeInteger(sourceId) || sourceId < 1}
              onPress={() => void run(() => changeTitleSource(title.id, { action: 'relink', sourceId: String(sourceId), mediaType: sourceType }))}>{t.upstream.relink}</Button>
            <Button variant="secondary" isDisabled={busy} onPress={() => void run(() => changeTitleSource(title.id, { action: 'manual' }))}>{t.upstream.manual}</Button>
          </div>
        </div>}
      </Card.Content>
      <Modal.Backdrop isOpen={Boolean(preview)} onOpenChange={open => { if (!open && !busy) setPreview(null); }} isDismissable={!busy} isKeyboardDismissDisabled={busy}>
        <Modal.Container size="md" scroll="inside"><Modal.Dialog>
          <Modal.Header><Modal.Heading>{t.upstream.previewTitle}</Modal.Heading></Modal.Header>
          <Modal.Body className="space-y-3">
            <p>{t.upstream.previewHint}</p>
            {preview && <><p>{t.upstream.counts(preview.migrated, preview.archived)}</p>
              <div className="space-y-2">{preview.changes.map((change, index) => <p key={index}>
                {change.from || t.upstream.added} → {change.to || t.upstream.archived}
              </p>)}</div></>}
            {title.structureLocked && <p>{t.upstream.lockedHint}</p>}
          </Modal.Body>
          <Modal.Footer className="flex-wrap">
            <Button variant="ghost" isDisabled={busy} onPress={() => setPreview(null)}>{t.app.close}</Button>
            <Button variant="secondary" isDisabled={busy} onPress={() => void run(async () => {
              if (preview) { await resolveStructure(title.id, { version: preview.version, signature: preview.signature, decision: 'keep' }); setPreview(null); }
            })}>{t.upstream.keep}</Button>
            <Button isDisabled={busy || title.structureLocked} onPress={() => void run(async () => {
              if (preview) { await resolveStructure(title.id, { version: preview.version, signature: preview.signature, decision: 'adopt' }); setPreview(null); }
            })}>{t.upstream.adopt}</Button>
          </Modal.Footer>
        </Modal.Dialog></Modal.Container>
      </Modal.Backdrop>
    </Card>
  );
}
