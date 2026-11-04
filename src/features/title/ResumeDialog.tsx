import React, { useEffect, useState } from 'react';
import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
} from '@heroui/react';
import { formatSeconds, parseTimeInput } from '../../domain/progress';
import type { SeasonDoc, TitleDoc } from '../../domain/types';
import { zh } from '../../i18n/zh';

interface ResumeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: TitleDoc;
  regularSeasons: SeasonDoc[];
  initialEpisodeKey: string;
  onSaveResume: (
    resume: { episodeKey: string | null; seconds: number } | null
  ) => Promise<void>;
}

export const ResumeDialog: React.FC<ResumeDialogProps> = ({
  isOpen,
  onOpenChange,
  title,
  regularSeasons,
  initialEpisodeKey,
  onSaveResume,
}) => {
  const [episodeKey, setEpisodeKey] = useState(initialEpisodeKey);
  const [timeInput, setTimeInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEpisodeKey(initialEpisodeKey);
      setTimeInput(
        title.resume?.seconds ? formatSeconds(title.resume.seconds) : ''
      );
      setError(null);
    }
  }, [isOpen, initialEpisodeKey, title.resume?.seconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let knownRuntime = title.runtimeMin;
    if (title.mediaType === 'tv' && episodeKey) {
      for (const s of regularSeasons) {
        const found = s.episodes.find((ep) => ep.key === episodeKey);
        if (found?.runtime) {
          knownRuntime = found.runtime;
          break;
        }
      }
    }

    const parsed = parseTimeInput(timeInput, knownRuntime);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    const isEpisodic = title.mediaType === 'tv' || regularSeasons.length > 0;
    await onSaveResume({
      episodeKey: isEpisodic ? episodeKey || null : null,
      seconds: parsed.seconds,
    });
    onOpenChange(false);
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <Modal.Container size="sm" placement="center">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{zh.detail.resumeModal.title}</Modal.Heading>
          </Modal.Header>
          <form onSubmit={handleSubmit}>
            <Modal.Body className="space-y-4">
              {(title.mediaType === 'tv' || regularSeasons.length > 0) && (
                <Select
                  selectedKey={episodeKey}
                  onSelectionChange={(key) => {
                    if (key != null) setEpisodeKey(String(key));
                  }}
                  variant="secondary"
                  fullWidth
                >
                  <Label>{zh.detail.resumeModal.episodeLabel}</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox aria-label={zh.detail.resumeModal.episodeLabel}>
                      {regularSeasons.flatMap((s) =>
                        s.episodes.map((ep) => {
                          const label =
                            zh.detail.resumeModal.episodeSelectOption(
                              s.seasonNumber,
                              ep.number,
                              ep.name ||
                                zh.detail.seasons.episodeDefaultName(ep.number)
                            );
                          return (
                            <ListBox.Item
                              key={ep.key}
                              id={ep.key}
                              textValue={label}
                            >
                              <Label>{label}</Label>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          );
                        })
                      )}
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
                variant="secondary"
                fullWidth
              >
                <Label>{zh.detail.resumeModal.timeLabel}</Label>
                <Input placeholder={zh.detail.resumeModal.timePlaceholder} />
                {title.runtimeMin && (
                  <Description>
                    {zh.detail.resumeModal.runtimeHint(title.runtimeMin)}
                  </Description>
                )}
                {error && <FieldError>{error}</FieldError>}
              </TextField>
            </Modal.Body>

            <Modal.Footer className="justify-between">
              {title.resume && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onPress={async () => {
                    await onSaveResume(null);
                    onOpenChange(false);
                  }}
                >
                  {zh.detail.resumeModal.clearButton}
                </Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onPress={() => onOpenChange(false)}
                >
                  {zh.app.cancel}
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  {zh.detail.resumeModal.saveButton}
                </Button>
              </div>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};
