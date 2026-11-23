/**
 * `firstInput` resolves the first time the visitor does anything (scrolls,
 * touches, moves a pointer, presses a key), or after nine seconds, whichever
 * comes first. On the server it is already resolved.
 *
 * Everything that is only needed once the visitor starts to travel waits on
 * this: hydrating the chapters below the hero, smooth scrolling, the scroll
 * timelines. Until then the page that the server sent is simply left alone,
 * which keeps the first seconds free for the hero.
 */
export const firstInput: Promise<void> =
  typeof window === "undefined"
    ? Promise.resolve()
    : new Promise((resolve) => {
        const events = ["scroll", "wheel", "touchstart", "pointerdown", "pointermove", "keydown"];
        let timer = 0;
        const go = () => {
          events.forEach((e) => window.removeEventListener(e, go));
          window.clearTimeout(timer);
          resolve();
        };
        if (window.scrollY > 0) return resolve();
        events.forEach((e) => window.addEventListener(e, go, { passive: true }));
        timer = window.setTimeout(go, 9000);
      });
