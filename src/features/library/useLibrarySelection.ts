import { useCallback, useEffect, useMemo, useState } from 'react';

const NONE: ReadonlySet<string> = new Set();

/** Ctrl/Cmd+A keeps its usual meaning while typing; the card checkboxes are inputs too, but not text. */
const isTextEntry = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement && !['checkbox', 'radio', 'button'].includes(target.type)));

/** A menu or dialog owns Escape while it is open. */
const overlayIsOpen = () => document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]') !== null;

/**
 * Multi-select state for the library grid. Only titles that are currently shown count as selected, so a
 * batch can never touch something a filter is hiding or another device has deleted.
 * While selecting, Escape leaves the mode and Ctrl/Cmd+A selects everything shown.
 */
export function useLibrarySelection(visibleIds: readonly string[]) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [picked, setPicked] = useState(NONE);

  const selectedIds = useMemo(() => visibleIds.filter((id) => picked.has(id)), [visibleIds, picked]);
  const allSelected = visibleIds.length > 0 && selectedIds.length === visibleIds.length;

  const toggle = useCallback((id: string) => {
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  const selectAll = useCallback(() => setPicked(new Set(visibleIds)), [visibleIds]);
  const clear = useCallback(() => setPicked(NONE), []);
  const start = useCallback(() => setIsSelecting(true), []);
  const stop = useCallback(() => {
    setIsSelecting(false);
    setPicked(NONE);
  }, []);

  useEffect(() => {
    if (!isSelecting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || overlayIsOpen()) return;
      if (event.key === 'Escape') {
        stop();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && !isTextEntry(event.target)) {
        event.preventDefault();
        selectAll();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSelecting, selectAll, stop]);

  return { isSelecting, selectedIds, allSelected, toggle, selectAll, clear, start, stop };
}
