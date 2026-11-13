import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ApiError, fetchTitleDetailsApi } from '../../data/api';
import { makeSampleSeasons } from '../../domain/testFixtures';
import { loadTitleEpisodes } from './useTitleEpisodes';

vi.mock('../../data/api', async (original) => ({
  ...(await original<typeof import('../../data/api')>()),
  fetchTitleDetailsApi: vi.fn(),
}));
const request = vi.mocked(fetchTitleDetailsApi);
const seasons = makeSampleSeasons();

beforeEach(() => {
  vi.useFakeTimers();
  request.mockReset();
});
afterEach(() => vi.useRealTimers());

test('episode details are asked for again after a request fails for a passing reason', async () => {
  request
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockRejectedValueOnce(new ApiError(503, 'HTTP 503'))
    .mockResolvedValue({ seasons });
  const loading = loadTitleEpisodes('tmdb_tv_1', [1000, 1000]);
  await vi.advanceTimersByTimeAsync(2000);
  await expect(loading).resolves.toEqual(seasons);
  expect(request).toHaveBeenCalledTimes(3);
});

test('an answer that will not change is not asked for again, and retries are bounded', async () => {
  request.mockRejectedValue(new ApiError(404, 'TITLE_NOT_FOUND', 'TITLE_NOT_FOUND'));
  await expect(loadTitleEpisodes('gone', [1000])).rejects.toMatchObject({ status: 404 });
  expect(request).toHaveBeenCalledTimes(1);

  request.mockReset().mockRejectedValue(new TypeError('Failed to fetch'));
  const loading = loadTitleEpisodes('tmdb_tv_1', [1000, 1000]);
  const outcome = expect(loading).rejects.toBeInstanceOf(TypeError);
  await vi.advanceTimersByTimeAsync(5000);
  await outcome;
  expect(request).toHaveBeenCalledTimes(3);
});
