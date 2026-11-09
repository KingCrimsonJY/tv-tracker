import React from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { buttonVariants, type ButtonVariants } from '@heroui/react';

type ButtonLinkProps = Omit<LinkProps, 'className'> &
  Pick<ButtonVariants, 'variant' | 'size' | 'isIconOnly' | 'fullWidth'> & {
    /** Layout-only classes; appearance comes from the HeroUI button variants. */
    className?: string;
  };

/**
 * Navigation styled as a HeroUI button. HeroUI recommends `buttonVariants` on a real link instead of a
 * Button that navigates on press, so it is announced as a link and supports open-in-new-tab.
 */
export const ButtonLink: React.FC<ButtonLinkProps> = ({
  variant = 'secondary',
  size,
  isIconOnly,
  fullWidth,
  className,
  ...linkProps
}) => <Link {...linkProps} className={buttonVariants({ variant, size, isIconOnly, fullWidth, className })} />;
