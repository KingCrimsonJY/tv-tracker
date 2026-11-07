export interface ScrollPosition { x: number; y: number }

export function createScrollPositions() {
  const positions = new Map<string, ScrollPosition>();
  return {
    remember: (key: string, position: ScrollPosition) => { positions.set(key, position); },
    has: (key: string) => positions.has(key),
    target: (key: string, navigation: string): ScrollPosition =>
      navigation === 'POP' ? positions.get(key) ?? { x: 0, y: 0 } : { x: 0, y: 0 },
  };
}
