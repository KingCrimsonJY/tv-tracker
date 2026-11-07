import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  TextField,
  Label,
  Description,
  Input,
  Select,
  ListBox,
  Button,
  FieldError,
} from '@heroui/react';
import { SeasonDoc, TitleDoc } from '../../domain/types';
import { makeEpisodeKey } from '../../domain/airing';
import { formatSeconds, parseTimeInput } from '../../domain/time';
import { resolveLocalizedText } from '../../domain/ordering';
import { useI18n } from '../../i18n';

interface ResumeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: TitleDoc;
  seasons: SeasonDoc[];
  defaultEpisodeKey: string | null;
  onSave: (seconds: number, episodeKey: string | null) => void;
  onClear: () => void;
}

export const ResumeDialog: React.FC<ResumeDialogProps> = ({
  isOpen,
  onOpenChange,
  title,
  seasons,
  defaultEpisodeKey,
  onSave,
  onClear,
}) => {
  const { t, locale, translateTimeError } = useI18n();
  const isEpisodeBased = title.mediaType === 'tv' || seasons.length > 0;

  const allEpisodes = useMemo(() => {
    const list: Array<{ key: string; label: string; runtime: number | null }> = [];
    for (const s of [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber)) {
      for (const ep of [...s.episodes].sort((a, b) => a.number - b.number)) {
        const key = makeEpisodeKey(s.seasonNumber, ep.number);
        const epName =
          resolveLocalizedText(ep.name, locale) ||
          t.detail.seasons.episodeDefaultName(ep.number);
        list.push({
          key,
          label: t.detail.resumeModal.episodeSelectOption(s.seasonNumber, ep.number, epName),
          runtime: ep.runtime,
        });
      }
    }
    return list;
  }, [seasons, locale, t.detail.seasons, t.detail.resumeModal]);

  const [selectedEpKey, setSelectedEpKey] = useState<string | null>(defaultEpisodeKey);
  const [timeInput, setTimeInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedEpKey(title.resume?.episodeKey ?? defaultEpisodeKey ?? allEpisodes[0]?.key ?? null);
      setTimeInput(title.resume ? formatSeconds(title.resume.seconds) : '');
      setError(null);
    }
  }, [isOpen, title.resume, defaultEpisodeKey, allEpisodes]);

  const currentRuntime = useMemo(() => {
    if (!isEpisodeBased) return title.runtimeMin;
    const found = allEpisodes.find((e) => e.key === selectedEpKey);
    return found?.runtime ?? title.runtimeMin ?? null;
  }, [isEpisodeBased, title.runtimeMin, allEpisodes, selectedEpKey]);

  const handleConfirm = () => {
    const parsed = parseTimeInput(timeInput, currentRuntime);
    if (!parsed.ok) {
      setError(translateTimeError(parsed));
      return;
    }
    onSave(parsed.seconds, isEpisodeBased ? selectedEpKey : null);
    onOpenChange(false);
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="sm" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t.app.close} />
          <Modal.Header>
            <Modal.Heading>{t.detail.resumeModal.title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            {isEpisodeBased && allEpisodes.length > 0 && (
              <Select
                selectedKey={selectedEpKey ?? undefined}
                onSelectionChange={(k) => k && setSelectedEpKey(String(k))}
              >
                <Label>{t.detail.resumeModal.episodeLabel}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox className="max-h-60 overflow-y-auto">
                    {allEpisodes.map((ep) => (
                      <ListBox.Item key={ep.key} id={ep.key} textValue={ep.label}>
                        {ep.label}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            )}

            <TextField
              value={timeInput}
              onChange={(val) => {
                setTimeInput(val);
                setError(null);
              }}
              isInvalid={Boolean(error)}
              isRequired
            >
              <Label>{t.detail.resumeModal.timeLabel}</Label>
              <Input placeholder={t.detail.resumeModal.timePlaceholder} />
              {currentRuntime && (
                <Description className="text-xs text-muted mt-1">
                  {t.detail.resumeModal.runtimeHint(currentRuntime)}
                </Description>
              )}
              {error && <FieldError>{error}</FieldError>}
            </TextField>
          </Modal.Body>
          <Modal.Footer className="justify-between">
            {title.resume ? (
              <Button
                variant="danger-soft"
                onPress={() => {
                  onClear();
                  onOpenChange(false);
                }}
              >
                {t.detail.resumeModal.clearButton}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button variant="tertiary" onPress={() => onOpenChange(false)}>
                {t.app.cancel}
              </Button>
              <Button variant="primary" onPress={handleConfirm}>
                {t.detail.resumeModal.saveButton}
              </Button>
            </div>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};
