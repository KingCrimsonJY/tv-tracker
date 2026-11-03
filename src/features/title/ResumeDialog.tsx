import React, { useEffect, useState } from 'react';
import { Button, Modal } from '@heroui/react';
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
        <Modal.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none">
          <Modal.Header>
            <Modal.Heading className="text-base font-semibold">
              {zh.detail.resumeModal.title}
            </Modal.Heading>
          </Modal.Header>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {(title.mediaType === 'tv' || regularSeasons.length > 0) && (
              <div>
                <label
                  htmlFor="resume-ep-select"
                  className="block text-xs text-[var(--muted)] mb-1.5"
                >
                  {zh.detail.resumeModal.episodeLabel}
                </label>
                <select
                  id="resume-ep-select"
                  value={episodeKey}
                  onChange={(e) => setEpisodeKey(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]"
                >
                  {regularSeasons.flatMap((s) =>
                    s.episodes.map((ep) => (
                      <option key={ep.key} value={ep.key}>
                        {zh.detail.resumeModal.episodeSelectOption(
                          s.seasonNumber,
                          ep.number,
                          ep.name ||
                            zh.detail.seasons.episodeDefaultName(ep.number)
                        )}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor="resume-time-input"
                className="block text-xs text-[var(--muted)] mb-1.5"
              >
                {zh.detail.resumeModal.timeLabel}
              </label>
              <input
                id="resume-time-input"
                type="text"
                value={timeInput}
                onChange={(e) => {
                  setTimeInput(e.target.value);
                  setError(null);
                }}
                placeholder={zh.detail.resumeModal.timePlaceholder}
                className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] tabular-nums"
              />
              {title.runtimeMin && (
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {zh.detail.resumeModal.runtimeHint(title.runtimeMin)}
                </p>
              )}
              {error && (
                <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
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
            </div>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};
