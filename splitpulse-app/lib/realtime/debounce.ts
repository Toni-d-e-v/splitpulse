/**
 * Trailing-edge debouncer with a single shared timer per instance.
 */
export function makeDebouncer(defaultMs = 1000) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (fn: () => void, ms: number = defaultMs) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, ms);
  };
}
