import React from 'react';
import { Checkbox } from '@heroui/react';
import { PosterCard, type PosterCardProps } from '../../components/PosterCard';
import { resolveDisplayTitle } from '../../domain/progress';
import { useI18n } from '../../i18n';

interface LibraryCardProps extends PosterCardProps {
  isSelecting: boolean;
  isSelected: boolean;
  onToggle: (titleId: string) => void;
}

/**
 * A library card that can be selected. In selection mode a checkbox covers the whole card, so a tap or
 * Space toggles it, and the link underneath is inert. The card itself stays mounted across the mode switch:
 * entering or leaving selection only adds or removes the checkboxes, which keeps a large library responsive.
 */
export const LibraryCard: React.FC<LibraryCardProps> = React.memo(({ isSelecting, isSelected, onToggle, ...card }) => (
  <div className="relative">
    <PosterCard {...card} isSelected={isSelected} inert={isSelecting} />
    {isSelecting && <CardCheckbox card={card} isSelected={isSelected} onToggle={onToggle} />}
  </div>
));

const CardCheckbox: React.FC<{ card: PosterCardProps; isSelected: boolean; onToggle: (titleId: string) => void }> = ({
  card: { title, defaultLang = 'auto' },
  isSelected,
  onToggle,
}) => {
  const { locale, t } = useI18n();
  const name = resolveDisplayTitle(title.names, title.displayLang, defaultLang, locale).primary;
  return (
    <Checkbox
      isSelected={isSelected}
      onChange={() => onToggle(title.id)}
      aria-label={t.library.batch.selectTitleAria(name)}
      className="absolute inset-0"
    >
      <Checkbox.Content className="size-full items-start justify-end p-2">
        <Checkbox.Control className="size-6">
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
};
