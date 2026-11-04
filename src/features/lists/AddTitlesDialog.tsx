import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Modal, SearchField, toast } from '@heroui/react';
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
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{zh.lists.addTitlesToList}</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-3">
            <SearchField
              value={searchQuery}
              onChange={setSearchQuery}
              aria-label={zh.lists.searchLibraryPlaceholder}
              variant="secondary"
              fullWidth
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  placeholder={zh.lists.searchLibraryPlaceholder}
                />
                <SearchField.ClearButton
                  aria-label={zh.search.clearSearchAria}
                />
              </SearchField.Group>
            </SearchField>

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
                        onPress={() => {
                          toast.promise(onAddTitle(t.id), {
                            loading: zh.search.addingToListToast,
                            success: zh.search.addedToListToast(primary),
                            error: zh.search.addToListFailedToast,
                          });
                        }}
                        className="shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{zh.lists.addActionShort}</span>
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="secondary"
              size="sm"
              onPress={() => onOpenChange(false)}
            >
              {zh.app.close}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};
