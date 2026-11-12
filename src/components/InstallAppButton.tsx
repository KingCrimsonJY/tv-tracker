import React, { useState } from 'react';
import { Button, Modal } from '@heroui/react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useI18n } from '../i18n';

/**
 * Offers to install the PWA where that is possible: the browser's own prompt, or on iOS (which has none)
 * a short guide. Renders nothing once installed or when the browser cannot install.
 * `compact` is the icon-only form for the tablet rail and the phone header.
 */
export const InstallAppButton: React.FC<{ compact?: boolean; size?: 'sm' | 'md'; className?: string }> = ({
  compact,
  size,
  className,
}) => {
  const { t } = useI18n();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  if (isInstalled || !(isInstallable || isIOS)) return null;
  const onPress = () => (isInstallable ? void install() : setGuideOpen(true));

  return (
    <>
      {compact ? (
        <Button
          variant="secondary"
          size={size}
          isIconOnly
          aria-label={t.app.installApp}
          onPress={onPress}
          className={className}
        >
          <Download className="size-4" />
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          onPress={onPress}
          className={`justify-start ${className ?? ''}`}
        >
          <Download className="size-4" />
          <span>{t.app.installApp}</span>
        </Button>
      )}

      <Modal.Backdrop isOpen={guideOpen} onOpenChange={setGuideOpen} isDismissable>
        <Modal.Container size="sm" placement="center" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{t.app.installIosGuideTitle}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p>{t.app.installIosGuideBody}</p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" size="sm" onPress={() => setGuideOpen(false)}>
                {t.app.close}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
};
