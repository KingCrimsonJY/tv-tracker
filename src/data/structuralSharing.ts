/** Reuse unchanged JSON subtrees, including arrays and maps returned by a fresh snapshot. */
export function shareJson<T>(previous: T, incoming: T): T {
  if (Object.is(previous, incoming)) return previous;
  if (
    !previous ||
    !incoming ||
    typeof previous !== 'object' ||
    typeof incoming !== 'object' ||
    Array.isArray(previous) !== Array.isArray(incoming)
  )
    return incoming;
  const before = previous as Record<string, unknown>;
  const after = incoming as Record<string, unknown>;
  const keys = Object.keys(after);
  let unchanged = keys.length === Object.keys(before).length;
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const value = shareJson(before[key], after[key]);
    result[key] = value;
    if (!Object.hasOwn(before, key) || value !== before[key]) unchanged = false;
  }
  if (unchanged) return previous;
  return (Array.isArray(incoming) ? keys.map((key) => result[key]) : result) as T;
}
