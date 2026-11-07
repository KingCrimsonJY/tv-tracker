import React, { useState } from 'react';
import { Modal, SearchField, Button } from '@heroui/react';
import { Check, Plus } from 'lucide-react';
import { MediaImage } from '../../components/MediaImage';
import { DefaultTitleLang, TitleDoc } from '../../domain/types';
import { pickPoster, resolveDisplayTitle } from '../../domain/progress';
import { useI18n } from '../../i18n';

interface AddTitlesDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  titles: Record<string, TitleDoc>;
  existingTitleIds: Set<string>;
  defaultLang: DefaultTitleLang;
  onAdd: (titleId: string) => void;
}

export const AddTitlesDialog: React.FC<AddTitlesDialogProps> = ({
  isOpen,
  onOpenChange,
  titles,
  existingTitleIds,
  defaultLang,
  onAdd,
}) => {
  const [query, setQuery] = useState('');
  const { t, locale } = useI18n();
  const allTitles = Object.values(titles);

  const filtered = allTitles.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (item.names.zh?.toLowerCase().includes(q) ?? false) ||
      (item.names.en?.toLowerCase().includes(q) ?? false) ||
      item.names.original.toLowerCase().includes(q)
    );
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="md" scroll="inside">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t.app.close} />
          <Modal.Header>
            <Modal.Heading>{t.lists.addTitlesToList}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <SearchField value={query} onChange={setQuery} aria-label={t.search.title}>
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder={t.lists.searchLibraryPlaceholder} />
                <SearchField.ClearButton aria-label={t.search.clearSearchAria} />
              </SearchField.Group>
            </SearchField>

            {filtered.length === 0 ? (
              <p className="text-center text-sm text-[var(--muted)] py-8">{t.lists.allTitlesAdded}</p>
            ) : (
              <div className="space-y-2">
                {filtered.map((title) => {
                  const inList = existingTitleIds.has(title.id);
                  const { primary: displayTitle } = resolveDisplayTitle(
                    title.names,
                    title.displayLang,
                    defaultLang,
                    locale
                  );
                  return (
                    <div
                      key={title.id}
                      className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[var(--surface-secondary)]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-14 rounded overflow-hidden bg-[var(--surface)] shrink-0">
                          <MediaImage
                            src={pickPoster(title, locale)}
                            alt={displayTitle}
                            aspect="poster"
                            mediaType={title.mediaType}
                            className="w-full h-full"
                            compact
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{displayTitle}</div>
                          <div className="text-xs text-[var(--muted)]">{title.year ?? ''}</div>
                        </div>
                      </div>
                      <Button
                        aria-label={t.lists.addTitlesToList + ": " + displayTitle}
                        isIconOnly
                        size="sm"
                        variant={inList ? 'tertiary' : 'secondary'}
                        isDisabled={inList}
                        onPress={() => onAdd(title.id)}
                      >
                        {inList ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};
