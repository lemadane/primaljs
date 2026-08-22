/**
 * PrimalJS Client-Side SPA Router & Nested Routing Engine
 * Built directly on native browser History API, Signals, and Fine-Grained Layout DOM Preservation.
 */

import { signal, computed, batch } from "./signal.js";
import { html } from "./html.js";
import { Load } from "./load.js";
import { head } from "./seo.js";
import { getCurrentContext, pushContext, popContext } from "./lifecycle.js";
import { reportGlobalError } from "./app.js";
import { register } from "./registry.js";

const currentRouteSignal = signal({
    path: "/",
    params: {},
    query: new URLSearchParams(),
    hash: "",
    component: null,
    meta: null
});

let globalNavigationId = 0;

/**
 * Creates a lazy-loaded component wrapper for code-splitting routes.
 *
 * @param {() => Promise<{ default: Function } | Function>} factory
 * @returns {Function & { __isLazy: boolean, factory: Function, resolve: () => Promise<Function> }}
 */
export function lazy(factory) {
    let cachedComponent = null;
    let pendingPromise = null;

    const LazyWrapper = function LazyWrapper(props) {
        if (cachedComponent) {
            return typeof cachedComponent === "function" ? cachedComponent(props) : cachedComponent;
        }
        const compSignal = signal(null);
        if (!pendingPromise) {
            pendingPromise = Promise.resolve().then(() => factory()).then(mod => {
                cachedComponent = (mod && mod.default) || mod;
                compSignal.value = cachedComponent;
                return mod;
            });
        } else {
            pendingPromise.then(() => {
                compSignal.value = cachedComponent;
            });
        }
        return html`<Load component=${compSignal} />`;
    };

    LazyWrapper.__isLazy = true;
    LazyWrapper.factory = factory;
    LazyWrapper.resolve = async () => {
        if (!cachedComponent) {
            if (!pendingPromise) {
                pendingPromise = Promise.resolve().then(() => factory()).then(mod => {
                    cachedComponent = (mod && mod.default) || mod;
                    return mod;
                });
            }
            await pendingPromise;
        }
        return cachedComponent;
    };

    return LazyWrapper;
}

/**
 * Declarative `<RouteOutlet>` Component for rendering child layout routes.
 *
 * @param {{ depth?: number }} [props]
 * @returns {import("./html.js").TemplateResult}
 */
export function RouteOutlet(props) {
    const ctx = getCurrentContext();
    let depth = props ? props.depth : undefined;
    if (depth === undefined) {
        let count = 0;
        let p = ctx ? ctx.parent : null;
        while (p) {
            if (p.isRouteOutlet) {
                count++;
            }
            p = p.parent;
        }
        depth = count;
    }

    if (ctx) {
        ctx.isRouteOutlet = true;
    }

    const currentRouter = globalRouterInstance;

    let previousComponent = null;
    let previousRouteKey = null;
    let previousWrapper = null;

    const comp = computed(() => {
        if (!currentRouter) {
            previousComponent = null;
            previousRouteKey = null;
            previousWrapper = null;
            return null;
        }
        const layers = currentRouter.activeLayers.value;
        const layer = layers && layers.length > depth ? layers[depth] : null;
        if (!layer || !layer.component) {
            previousComponent = null;
            previousRouteKey = null;
            previousWrapper = null;
            return null;
        }

        const component = layer.component;
        const isLeaf = depth === layers.length - 1;
        const paramsKey = JSON.stringify(layer.params || {});
        const queryKey = isLeaf && currentRouter.activeQuery.value ? currentRouter.activeQuery.value.toString() : "";
        const hashKey = isLeaf ? (currentRouter.activeHash.value || "") : "";
        const routeKey = `${paramsKey}:${queryKey}:${hashKey}`;

        if (component === previousComponent && routeKey === previousRouteKey) {
            return previousWrapper;
        }

        const RouteWrapper = function RouteWrapper(routeProps) {
            return component(routeProps);
        };
        if (component.name) {
            Object.defineProperty(RouteWrapper, "name", { value: component.name });
        }

        previousComponent = component;
        previousRouteKey = routeKey;
        previousWrapper = RouteWrapper;

        return RouteWrapper;
    });

    return html`<Load component=${comp} />`;
}

let globalRouterInstance = null;

/**
 * @typedef {Object} RouteDefinition
 * @property {string} path Route matching pattern (e.g. "/", "/users/:id").
 * @property {Function} [component] Component function for this route.
 * @property {RouteDefinition[]} [children] Nested child routes.
 * @property {Function} [beforeEnter] Guard function called before navigating to this route.
 * @property {Object} [meta] SEO or route metadata.
 */

/**
 * Creates a PrimalJS SPA Router instance.
 *
 * @param {{ routes: RouteDefinition[], mode?: "history" | "hash" }} options
 * @returns {Router}
 */
export function createRouter(options) {
    const router = new Router(options);
    globalRouterInstance = router;
    batch(() => {
        currentRouteSignal.value = {
            path: "/",
            params: {},
            query: new URLSearchParams(),
            hash: "",
            component: null,
            meta: null
        };
    });
    router.init();
    return router;
}

/**
 * Accesses the active route object (path, params, query, hash, component, meta).
 *
 * @returns {{ path: string, params: Record<string, string>, query: URLSearchParams, hash: string, component: Function | null, meta: any }}
 */
export function useRoute() {
    return currentRouteSignal.value;
}

/**
 * Navigates programmatically to a target path or URL string.
 *
 * @param {string} to
 * @param {{ replace?: boolean }} [options]
 */
export function navigate(to, options) {
    if (globalRouterInstance) {
        globalRouterInstance.navigate(to, options);
    }
}

register(RouteOutlet);
register(Load);


function matchSegment(pattern, segment) {
    if (pattern === "*") return { [segment]: segment };
    if (pattern.startsWith(":")) {
        return { [pattern.slice(1)]: decodeURIComponent(segment) };
    }
    if (pattern === segment) {
        return {};
    }
    return null;
}

function matchRouteTree(routes, path) {
    const cleanPath = path.split("?")[0].split("#")[0];
    const pathSegments = cleanPath.split("/").filter(Boolean);

    function walk(routeList, segmentIndex, parentParams = []) {
        for (const route of routeList) {
            let matched = false;
            let currentParams = {};
            let consumedCount = 0;

            if (route.path === "*") {
                matched = true;
                consumedCount = pathSegments.length - segmentIndex;
            } else if (route.path === "" || route.path === "/") {
                if (segmentIndex === pathSegments.length || route.children) {
                    matched = true;
                    consumedCount = 0;
                }
            } else {
                const patternSegments = route.path.split("/").filter(Boolean);
                if (segmentIndex + patternSegments.length <= pathSegments.length) {
                    let isMatch = true;
                    for (let i = 0; i < patternSegments.length; i++) {
                        const segMatch = matchSegment(patternSegments[i], pathSegments[segmentIndex + i]);
                        if (segMatch === null) {
                            isMatch = false;
                            break;
                        }
                        Object.assign(currentParams, segMatch);
                    }
                    if (isMatch) {
                        matched = true;
                        consumedCount = patternSegments.length;
                    }
                }
            }

            if (matched) {
                const mergedParams = Object.assign({}, ...parentParams, currentParams);
                const currentLayer = {
                    route: route,
                    component: route.component,
                    params: mergedParams,
                    meta: route.meta || null
                };

                const nextSegmentIndex = segmentIndex + consumedCount;

                if (route.children && route.children.length > 0) {
                    const childLayers = walk(route.children, nextSegmentIndex, [...parentParams, currentParams]);
                    if (childLayers) {
                        return [currentLayer, ...childLayers];
                    }
                } else if (nextSegmentIndex === pathSegments.length || route.path === "*") {
                    return [currentLayer];
                }
            }
        }
        return null;
    }

    return walk(routes, 0) || [];
}

export class Router {
    constructor(options = {}) {
        this.routes = options.routes || [];
        this.mode = options.mode || "history";
        this.onError = options.onError || null;
        this.activeLayers = signal([]);
        this.activeParams = signal({});
        this.activeQuery = signal(new URLSearchParams());
        this.activeHash = signal("");
        this.activeMeta = signal(null);
        this.redirectDepth = 0;

        this.handlePopState = this.handlePopState.bind(this);
        this.handleHashChange = this.handleHashChange.bind(this);
        this.link = this.link.bind(this);

        if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
            try {
                window.history.scrollRestoration = "manual";
            } catch (_) {}
        }
    }

    getHashRoute() {
        if (typeof window === "undefined") return { path: "/", search: "", hash: "" };
        let hashStr = window.location.hash || "#/";
        if (hashStr.startsWith("#")) hashStr = hashStr.slice(1);
        if (!hashStr.startsWith("/")) hashStr = "/" + hashStr;

        const qIdx = hashStr.indexOf("?");
        const hIdx = hashStr.indexOf("#");

        let path = hashStr;
        let search = "";
        let innerHash = "";

        if (qIdx !== -1 && (hIdx === -1 || qIdx < hIdx)) {
            path = hashStr.substring(0, qIdx);
            const rest = hashStr.substring(qIdx);
            const restHIdx = rest.indexOf("#");
            if (restHIdx !== -1) {
                search = rest.substring(0, restHIdx);
                innerHash = rest.substring(restHIdx);
            } else {
                search = rest;
            }
        } else if (hIdx !== -1) {
            path = hashStr.substring(0, hIdx);
            innerHash = hashStr.substring(hIdx);
        }

        return { path, search, hash: innerHash };
    }

    init() {
        if (typeof window !== "undefined") {
            if (this.mode === "hash") {
                window.addEventListener("hashchange", this.handleHashChange);
                const { path, search, hash } = this.getHashRoute();
                this.resolveRoute(path, search, hash);
            } else {
                window.addEventListener("popstate", this.handlePopState);
                this.resolveRoute(window.location.pathname, window.location.search, window.location.hash);
            }
        }
    }

    destroy() {
        if (typeof window !== "undefined") {
            if (this.mode === "hash") {
                window.removeEventListener("hashchange", this.handleHashChange);
            } else {
                window.removeEventListener("popstate", this.handlePopState);
            }
        }
        if (globalRouterInstance === this) {
            globalRouterInstance = null;
        }
    }

    async resolveRoute(path, search = "", hash = "", navigationToken = ++globalNavigationId) {
        try {
            if (this.redirectDepth > 10) {
                this.redirectDepth = 0;
                throw new Error("PrimalJS Router: Maximum redirect depth (10) exceeded.");
            }

            const query = new URLSearchParams(search);
            const matchedLayers = matchRouteTree(this.routes, path);

            if (matchedLayers.length === 0) {
                batch(() => {
                    this.activeLayers.value = [];
                    this.activeParams.value = {};
                    this.activeQuery.value = query;
                    this.activeHash.value = hash;
                    currentRouteSignal.value = {
                        path,
                        params: {},
                        query,
                        hash,
                        component: null,
                        meta: null
                    };
                });
                head(null);
                return;
            }

            const leafLayer = matchedLayers[matchedLayers.length - 1];

            if (leafLayer.route.redirect) {
                this.redirectDepth++;
                let redirectTarget = typeof leafLayer.route.redirect === "function"
                    ? leafLayer.route.redirect({ path, params: leafLayer.params, query })
                    : leafLayer.route.redirect;
                if (redirectTarget) {
                    this.navigate(redirectTarget, { replace: true });
                    return;
                }
            }
            this.redirectDepth = 0;

            for (const layer of matchedLayers) {
                if (typeof layer.route.beforeEnter === "function") {
                    const routeInfo = { path, params: layer.params, query, hash };
                    const result = await layer.route.beforeEnter(routeInfo);

                    if (navigationToken !== globalNavigationId) {
                        return;
                    }

                    if (result === false) {
                        if (typeof window !== "undefined") {
                            window.history.replaceState({}, "", currentRouteSignal.value.path);
                        }
                        return;
                    }
                    if (typeof result === "string") {
                        this.navigate(result, { replace: true });
                        return;
                    }
                }
            }

            // Resolve explicit lazy route components / load options without executing normal component functions
            for (const layer of matchedLayers) {
                if (layer.component && layer.component.__isLazy) {
                    try {
                        const resolved = await layer.component.resolve();
                        if (navigationToken !== globalNavigationId) return;
                        layer.component = resolved;
                    } catch (compErr) {
                        if (navigationToken !== globalNavigationId) return;
                        throw compErr;
                    }
                } else if (typeof layer.route.load === "function") {
                    try {
                        const res = layer.route.load();
                        const mod = res && typeof res.then === "function" ? await res : res;
                        if (navigationToken !== globalNavigationId) return;
                        layer.component = (mod && mod.default) || mod;
                    } catch (compErr) {
                        if (navigationToken !== globalNavigationId) return;
                        throw compErr;
                    }
                }
            }

            const leafMeta = leafLayer.meta || (matchedLayers[0] && matchedLayers[0].meta) || null;

            batch(() => {
                this.activeLayers.value = matchedLayers;
                this.activeParams.value = leafLayer.params;
                this.activeQuery.value = query;
                this.activeHash.value = hash;
                this.activeMeta.value = leafMeta;

                currentRouteSignal.value = {
                    path,
                    params: leafLayer.params,
                    query,
                    hash,
                    component: leafLayer.component,
                    meta: leafMeta
                };
            });

            head(leafMeta);
        } catch (err) {
            if (navigationToken !== globalNavigationId) {
                return;
            }
            if (typeof this.onError === "function") {
                this.onError(err);
            } else {
                reportGlobalError(err, { type: "router", path });
            }
        }
    }

    handlePopState() {
        this.resolveRoute(window.location.pathname, window.location.search, window.location.hash);
    }

    handleHashChange() {
        const { path, search, hash } = this.getHashRoute();
        this.resolveRoute(path, search, hash);
    }

    navigate(to, options = {}) {
        if (typeof window === "undefined") return;

        if (this.mode === "hash") {
            let targetHash = to.startsWith("#") ? to : "#" + (to.startsWith("/") ? to : "/" + to);
            if (options.replace) {
                const base = window.location.pathname + window.location.search;
                window.location.replace(base + targetHash);
            } else {
                window.location.hash = targetHash;
            }
            const { path, search, hash } = this.getHashRoute();
            this.resolveRoute(path, search, hash);
        } else {
            const targetUrl = new URL(to, window.location.origin);
            const nextPath = targetUrl.pathname;
            const nextSearch = targetUrl.search;
            const nextHash = targetUrl.hash;

            if (options.replace) {
                window.history.replaceState({}, "", targetUrl.href);
            } else {
                window.history.pushState({}, "", targetUrl.href);
            }

            this.resolveRoute(nextPath, nextSearch, nextHash);
        }
    }

    link(props) {
        let rawHref = props.href || "#";
        let href = rawHref;
        if (this.mode === "hash" && rawHref !== "#" && !rawHref.startsWith("#")) {
            href = "#" + (rawHref.startsWith("/") ? rawHref : "/" + rawHref);
        }
        const replace = props.replace || false;
        const children = props.children || [];

        const handleClick = (e) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) {
                return;
            }
            e.preventDefault();
            this.navigate(rawHref, { replace });
        };

        return html`<a href=${href} onclick=${handleClick}>${children}</a>`;
    }

    RouterView(props = {}) {
        const depth = props.depth || 0;
        return html`<RouteOutlet depth=${depth} />`;
    }
}

