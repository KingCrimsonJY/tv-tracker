// Serialize reads and repeat if an event arrives while a read is in flight.
// A newer write response is not evidence that all earlier changes were received.
export function createReconciler(read: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let dirty = false;
  const request = (): Promise<void> => {
    dirty = true;
    if (!running) {
      running = (async () => {
        while (dirty) {
          dirty = false;
          await read();
        }
      })().finally(() => { running = null; if (dirty) void request(); });
    }
    return running;
  };
  return request;
}
