/**
 * PrimalJS — Minimalists’ ReactJS
 * Core Exports
 */

export { signal, computed, effect, isSignal, batch, untrack } from "./signal.js";
export { register, getComponent, clearRegistry } from "./registry.js";
export { onMount, onDestroy, getCurrentContext, ComponentContext } from "./lifecycle.js";
export { html, unsafeHtml, TemplateResult } from "./html.js";
export { mount, unmount, Load } from "./load.js";
export { ref, isRef } from "./ref.js";
export { Owner } from "./owner.js";
export { createRouter, useRoute, navigate, RouteOutlet, Router, lazy } from "./router.js";
export { head } from "./seo.js";
export { activate, hydrate } from "./activate.js";
export { setupPwa, unregisterServiceWorkers } from "./pwa.js";
export { createApp } from "./app.js";
export { Guard, Boundary } from "./guard.js";
export { Place } from "./place.js";
export { WithinView } from "./within-view.js";
export { Animate } from "./animate.js";
export { Keep, KeepCache, getKeepCache } from "./keep.js";
export { OnIdle, normalizeIdleTimeout } from "./on-idle.js";
export { Focus, getFocusableElementsFromNodes } from "./focus.js";
export { onKey } from "./on-key.js";
export { scrollLock } from "./scroll-lock.js";
export { onOutsideClick } from "./on-outside-click.js";
export { Wait, Delay, Briefly, Failed, TimeoutError, normalizeTimeout, observePromise } from "./async.js";
export { PrimalJSError, setDevMode } from "./diagnostics.js";
