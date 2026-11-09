import { expect, test } from 'vitest';
import { initialResumeSelection } from './ResumeDialog';

const resume = { episodeKey: 's1e3', seconds: 600, updatedAt: 1 };

test('recording time for another episode selects that episode without its stale time', () => {
  expect(initialResumeSelection({ resume }, 's1e5', 's1e1', true)).toEqual({ episodeKey: 's1e5', seconds: null });
});

test('opening from the title menu restores the stored resume point', () => {
  expect(initialResumeSelection({ resume }, null, 's1e1', true)).toEqual({ episodeKey: 's1e3', seconds: 600 });
  expect(
    initialResumeSelection({ resume: { episodeKey: null, seconds: 90, updatedAt: 1 } }, null, null, false),
  ).toEqual({
    episodeKey: null,
    seconds: 90,
  });
});
