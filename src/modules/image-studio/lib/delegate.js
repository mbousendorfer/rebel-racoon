// Image Generator — event delegation on a view root, the way every Archie screen
// wires itself (data-* attributes, one listener per event type). Returns an
// `off()` so the route cleanup can remove everything it added.

export function delegate(root, type, selector, handler, options) {
  const listener = (event) => {
    const match = event.target instanceof Element ? event.target.closest(selector) : null;
    if (match && root.contains(match)) handler(event, match);
  };
  root.addEventListener(type, listener, options);
  return () => root.removeEventListener(type, listener, options);
}

/** Collects off() functions and runs them all once. */
export function disposer() {
  const fns = [];
  return {
    add(fn) {
      if (typeof fn === "function") fns.push(fn);
      return fn;
    },
    run() {
      while (fns.length) {
        try {
          fns.pop()();
        } catch (error) {
          console.warn("[image-generator] cleanup failed", error);
        }
      }
    },
  };
}

export function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}
