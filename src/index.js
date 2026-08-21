/**
 * PrimalJS — Minimalists’ ReactJS
 * Core Exports
 */

export { signal, computed, effect, isSignal, batch, untrack } from "./signal.js";
export { register, getComponent, clearRegistry } from "./registry.js";
export { onMount, onDestroy, getCurrentContext } from "./lifecycle.js";
export { html, unsafeHtml, TemplateResult } from "./html.js";
export { mount, unmount, Load } from "./mount.js";
export { ref, isRef } from "./ref.js";
export { Owner } from "./owner.js";
export { createRouter, useRoute, navigate, RouteOutlet, Router, lazy } from "./router.js";
export { head } from "./seo.js";
export { activate } from "./activate.js";
export { setupPwa, unregisterServiceWorkers } from "./pwa.js";
export { createApp } from "./app.js";
export { Boundary } from "./boundary.js";
export { PrimalJSError, setDevMode } from "./diagnostics.js";
