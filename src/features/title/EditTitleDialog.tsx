import React, { useState } from 'react';
import { Button, Input, Label, Modal, TextArea, TextField } from '@heroui/react';
import type { UpdateTitleDetailsInput } from '../../data/actions/types';
import type { TitleDoc, UiLocale } from '../../domain/types';
import { useI18n } from '../../i18n';

export interface TitleEditDraft {
  zhName: string;
  originalName: string;
  posterPath: string;
  overview: string;
  overviewLang: 'zh' | 'en';
}

/** Edit the overview in the UI language when it exists, otherwise the language that has text. */
export function createTitleEditDraft(title: TitleDoc, locale: UiLocale): TitleEditDraft {
  const preferred = locale === 'en' ? 'en' : 'zh';
  const other = preferred === 'en' ? 'zh' : 'en';
  const overviewLang = title.overview[preferred] || !title.overview[other] ? preferred : other;
  return {
    zhName: title.names.zh ?? '',
    originalName: title.names.original ?? '',
    posterPath: title.posterPath ?? '',
    overview: title.overview[overviewLang] ?? '',
    overviewLang,
  };
}

/** Only fields the user changed are written, so saving an untouched form never rewrites metadata. */
export function buildTitleEditPatch(initial: TitleEditDraft, draft: TitleEditDraft): UpdateTitleDetailsInput {
  const patch: UpdateTitleDetailsInput = {};
  if (draft.zhName.trim() !== initial.zhName.trim()) patch.name = draft.zhName;
  if (draft.originalName.trim() !== initial.originalName.trim()) patch.originalName = draft.originalName;
  if (draft.posterPath.trim() !== initial.posterPath.trim()) patch.posterPath = draft.posterPath.trim() || null;
  if (draft.overview.trim() !== initial.overview.trim()) {
    patch.overview = draft.overview;
    patch.overviewLang = draft.overviewLang;
  }
  return patch;
}

interface EditTitleDialogProps {
  title: TitleDoc;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (patch: UpdateTitleDetailsInput) => void;
}

export const EditTitleDialog: React.FC<EditTitleDialogProps> = ({ title, isOpen, onOpenChange, onSave }) => {
  const { t, locale } = useI18n();
  const [openedWith, setOpenedWith] = useState<TitleEditDraft | null>(null);
  const [draft, setDraft] = useState<TitleEditDraft | null>(null);

  // Capture the form when the dialog opens. Background refreshes and other devices update `title`
  // while the dialog is open; they must not overwrite what the user is typing.
  if (isOpen && !openedWith) {
    const initial = createTitleEditDraft(title, locale);
    setOpenedWith(initial);
    setDraft(initial);
  } else if (!isOpen && openedWith) {
    setOpenedWith(null);
  }

  const update = (field: keyof Omit<TitleEditDraft, 'overviewLang'>) => (value: string) =>
    setDraft((current) => (current ? { ...current, [field]: value } : current));

  const save = () => {
    if (openedWith && draft) {
      const patch = buildTitleEditPatch(openedWith, draft);
      if (Object.keys(patch).length > 0) onSave(patch);
    }
    onOpenChange(false);
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="md" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t.app.close} />
          <Modal.Header>
            <Modal.Heading>{t.detail.editModal.title}</Modal.Heading>
          </Modal.Header>
          {draft && (
            <Modal.Body className="space-y-4">
              <TextField value={draft.zhName} onChange={update('zhName')}>
                <Label>{t.detail.editModal.zhNameLabel}</Label>
                <Input />
              </TextField>
              <TextField value={draft.originalName} onChange={update('originalName')}>
                <Label>{t.detail.editModal.originalNameLabel}</Label>
                <Input />
              </TextField>
              <TextField value={draft.posterPath} onChange={update('posterPath')}>
                <Label>{t.detail.editModal.posterPathLabel}</Label>
                <Input type="url" />
              </TextField>
              <TextField value={draft.overview} onChange={update('overview')}>
                <Label>
                  {draft.overviewLang === 'en'
                    ? t.detail.editModal.overviewLabelEn
                    : t.detail.editModal.overviewLabelZh}
                </Label>
                <TextArea rows={3} />
              </TextField>
            </Modal.Body>
          )}
          <Modal.Footer className="gap-2">
            <Button variant="tertiary" onPress={() => onOpenChange(false)}>
              {t.app.cancel}
            </Button>
            <Button variant="primary" onPress={save}>
              {t.app.save}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};
