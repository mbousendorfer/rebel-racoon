// Image Generator — the subscribe/notify primitive (module-local twin of Archie's
// store-utils: the module never imports Archie internals).

export function createNotifier() {
  const listeners = new Set();
  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    notify(detail) {
      for (const fn of [...listeners]) {
        try {
          fn(detail);
        } catch (error) {
          console.warn("[image-generator] subscriber failed", error);
        }
      }
    },
  };
}
