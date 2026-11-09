import React from 'react';
import { Spinner } from '@heroui/react';

/** HeroUI Button render function that shows a spinner while `isPending`, as in the Button docs. */
export function withPendingSpinner(content: React.ReactNode, idleIcon?: React.ReactNode) {
  return function PendingContent({ isPending }: { isPending: boolean }) {
    return (
      <>
        {isPending ? <Spinner size="sm" color="current" /> : idleIcon}
        {content}
      </>
    );
  };
}
