// Serialize reads and repeat if an event arrives while a read is in flight.
// A newer write response is not evidence that all earlier changes were received.
//
// A read that reports failure (resolves to `false`) is repeated after a growing delay until one succeeds.
// The reason for reading, a missed event or a gap in versions, does not go away with the failure, and
// nothing else is certain to ask again: the event stream may stay healthy and silent for hours.
export function createReconciler(
  read: () => Promise<boolean | void>,
  retryDelayMs: (failures: number) => number = (failures) => Math.min(30_000, 1000 * 2 ** (failures - 1)),
): () => Promise<void> {
  let running: Promise<void> | null = null;
  let dirty = false;
  let failures = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const request = (): Promise<void> => {
    dirty = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (!running) {
      running = (async () => {
        while (dirty) {
          dirty = false;
          if ((await read()) !== false) {
            failures = 0;
          } else if (!dirty) {
            failures += 1;
            retryTimer = setTimeout(() => {
              retryTimer = null;
              void request();
            }, retryDelayMs(failures));
          }
        }
      })().finally(() => {
        running = null;
        if (dirty) void request();
      });
    }
    return running;
  };
  return request;
}
