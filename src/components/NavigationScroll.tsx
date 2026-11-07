import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { createScrollPositions } from './scrollPositions';

const RestoringScrollContext = createContext(false);
export const useRestoringScroll = () => useContext(RestoringScrollContext);

// BrowserRouter has no data-router ScrollRestoration. Keep positions by history entry,
// not pathname, so separate visits to the same page do not overwrite each other.
export function NavigationScroll({ children }: { children: ReactNode }) {
  const { key } = useLocation();
  const navigation = useNavigationType();
  const positions = useRef(createScrollPositions()).current;
  const restoring = navigation === 'POP' && positions.has(key);

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useLayoutEffect(() => {
    const target = positions.target(key, navigation);
    window.scrollTo(target.x, target.y);
    const remember = () => positions.remember(key, { x: window.scrollX, y: window.scrollY });
    // Listen while the old page is mounted; measuring during cleanup can capture
    // a position already clamped by the incoming page's shorter content.
    window.addEventListener('scroll', remember, { passive: true });
    return () => window.removeEventListener('scroll', remember);
  }, [key, navigation, positions]);

  return <RestoringScrollContext.Provider value={restoring}>{children}</RestoringScrollContext.Provider>;
}
