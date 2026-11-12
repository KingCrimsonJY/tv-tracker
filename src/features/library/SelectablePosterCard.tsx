import React from 'react';
import { Checkbox } from '@heroui/react';
import { PosterCardBody, type PosterCardProps } from '../../components/PosterCard';
import { resolveDisplayTitle } from '../../domain/progress';
import { useI18n } from '../../i18n';

interface SelectablePosterCardProps extends PosterCardProps {
  isSelected: boolean;
  onToggle: (titleId: string) => void;
}

/** The library card in selection mode: the whole card is one checkbox, so Space or a tap toggles it. */
export const SelectablePosterCard: React.FC<SelectablePosterCardProps> = React.memo(
  ({ isSelected, onToggle, ...card }) => {
    const { locale, t } = useI18n();
    const { title, defaultLang = 'auto' } = card;
    const name = resolveDisplayTitle(title.names, title.displayLang, defaultLang, locale).primary;
    return (
      <Checkbox
        isSelected={isSelected}
        onChange={() => onToggle(title.id)}
        aria-label={t.library.batch.selectTitleAria(name)}
        className="w-full"
      >
        <Checkbox.Content className="group flex w-full flex-col items-stretch gap-0 text-left">
          <PosterCardBody {...card} isSelected={isSelected} />
          <Checkbox.Control className="absolute right-2 top-2 size-6">
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox.Content>
      </Checkbox>
    );
  },
);
