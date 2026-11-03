import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Modal } from '@heroui/react';
import { MediaImage } from '../../components/MediaImage';
import { resolveDisplayTitle } from '../../domain/progress';
import type { ListEntryDoc, TitleDoc } from '../../domain/types';
import { zh } from '../../i18n/zh';

interface AddTitlesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  titles: Record<string, TitleDoc>;
  rawEntries: ListEntryDoc[];
  defaultLang: 'zh' | 'original' | 'en';
  onAddTitle: (titleId: string) => Promise<void>;
}

export const AddTitlesDialog: React.FC<AddTitlesDialogProps> = ({
  isOpen,
  onOpenChange,
  titles,
  rawEntries,
  defaultLang,
  onAddTitle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const availableTitlesToAdd = useMemo(() => {
    const existingIds = new Set(rawEntries.map((e) => e.titleId));
    const q = searchQuery.trim().toLowerCase();
    return Object.values(titles).filter((t) => {
      if (existingIds.has(t.id)) return false;
      if (!q) return true;
      const zhName = t.names.zh?.toLowerCase() || '';
      const origName = t.names.original.toLowerCase();
      return zhName.includes(q) || origName.includes(q);
    });
  }, [titles, rawEntries, searchQuery]);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <Modal.Container size="md" placement="center" scroll="inside">
        <Modal.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none">
          <Modal.Header>
            <Modal.Heading className="text-base font-semibold">
              {zh.lists.addTitlesToList}
            </Modal.Heading>
          </Modal.Header>

          <div className="mt-4 space-y-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={zh.lists.searchLibraryPlaceholder}
              className="w-full h-10 px-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]"
            />

            <div className="max-h-80 overflow-y-auto space-y-2">
              {availableTitlesToAdd.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--muted)]">
                  {zh.lists.allTitlesAdded}
                </p>
              ) : (
                availableTitlesToAdd.map((t) => {
                  const { primary } = resolveDisplayTitle(
                    t.names,
                    t.displayLang,
                    defaultLang
                  );
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 shrink-0 rounded overflow-hidden">
                          <MediaImage
                            src={t.posterPath}
                            alt={primary}
                            aspect="poster"
                            mediaType={t.mediaType}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--foreground)] truncate">
                            {primary}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {t.year ? `${t.year} · ` : ''}
                            {zh.mediaType[t.mediaType]}
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        onPress={() => onAddTitle(t.id)}
                        className="gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{zh.lists.addActionShort}</span>
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onPress={() => onOpenChange(false)}
            >
              {zh.app.close}
            </Button>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};
