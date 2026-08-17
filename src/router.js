/**
 * PrimalJS Client-Side SPA Router & Nested Routing Engine
 * Built directly on native browser History API, Signals, and Fine-Grained Layout DOM Preservation.
 */

import { signal, computed } from "./signal.js";
import { html } from "./html.js";
import { Render } from "./render.js";
import { head } from "./seo.js";
import { getCurrentContext, pushContext, popContext } from "./lifecycle.js";
import { reportGlobalError } from "./app.js";

const currentRouteSignal = signal({
    path: "/",
    params: {},
    query: new URLSearchParams(),
    hash: "",
    component: null,
    meta: null
});

let globalNavigationId = 0;

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
        this.onError = options.onError || null;
        this.activeLayers = signal([]);
        this.activeParams = signal({});
        this.activeQuery = signal(new URLSearchParams());
        this.activeHash = signal("");
        this.activeMeta = signal(null);
        this.redirectDepth = 0;

        this.handlePopState = this.handlePopState.bind(this);
        this.link = this.link.bind(this);

        if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
            try {
                window.history.scrollRestoration = "manual";
            } catch (_) {}
        }
    }

    init() {
        if (typeof window !== "undefined") {
            window.addEventListener("popstate", this.handlePopState);
            this.resolveRoute(window.location.pathname, window.location.search, window.location.hash);
        }
    }

    destroy() {
        if (typeof window !== "undefined") {
            window.removeEventListener("popstate", this.handlePopState);
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

            // Resolve dynamic component functions / ES module loaders
            for (const layer of matchedLayers) {
                if (typeof layer.component === "function") {
                    if (layer.component.kind === undefined && !layer.component.__isComponent) {
                        try {
                            const res = layer.component();
                            if (res && typeof res.then === "function") {
                                const mod = await res;
                                if (navigationToken !== globalNavigationId) {
                                    return;
                                }
                                layer.component = (mod && mod.default) ? mod.default : mod;
                            }
                        } catch (compErr) {
                            if (navigationToken !== globalNavigationId) return;
                            throw compErr;
                        }
                    }
                }
            }

            const leafMeta = leafLayer.meta || (matchedLayers[0] && matchedLayers[0].meta) || null;

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

            head(leafMeta);

            if (typeof window !== "undefined") {
                if (hash) {
                    const targetId = hash.slice(1);
                    setTimeout(() => {
                        const targetEl = document.getElementById(targetId) || document.querySelector(`[name="${targetId}"]`);
                        if (targetEl && typeof targetEl.scrollIntoView === "function") {
                            try { targetEl.scrollIntoView(); } catch (_) {}
                        }
                    }, 0);
                } else {
                    try { window.scrollTo(0, 0); } catch (_) {}
                }

                if (leafLayer.route.focus) {
                    setTimeout(() => {
                        const focusEl = document.querySelector(leafLayer.route.focus);
                        if (focusEl && typeof focusEl.focus === "function") {
                            try { focusEl.focus(); } catch (_) {}
                        }
                    }, 0);
                }
            }
        } catch (err) {
            if (navigationToken !== globalNavigationId) return;
            if (typeof this.onError === "function") {
                this.onError(err, { path, search, hash });
            } else {
                reportGlobalError(err, { type: "router", path, search, hash });
            }
        }
    }

    navigate(to, options = {}) {
        if (typeof window === "undefined") return;

        const navToken = ++globalNavigationId;
        const [pathAndSearch, hash] = to.split("#");
        const [path, search] = pathAndSearch.split("?");
        const searchStr = search ? `?${search}` : "";
        const hashStr = hash ? `#${hash}` : "";

        if (options.replace) {
            window.history.replaceState({}, "", `${path}${searchStr}${hashStr}`);
        } else {
            window.history.pushState({}, "", `${path}${searchStr}${hashStr}`);
        }

        this.resolveRoute(path, searchStr, hashStr, navToken);
    }

    handlePopState() {
        if (typeof window !== "undefined") {
            const navToken = ++globalNavigationId;
            this.resolveRoute(window.location.pathname, window.location.search, window.location.hash, navToken);
        }
    }

    link(event) {
        if (!event || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }
        const target = event.currentTarget || event.target;
        if (target && target.href) {
            const url = new URL(target.href, window.location.origin);
            if (url.origin === window.location.origin) {
                event.preventDefault();
                this.navigate(`${url.pathname}${url.search}${url.hash}`);
            }
        }
    }

    RouterView() {
        const activeLayers = this.activeLayers;
        const comp = computed(() => {
            const layers = activeLayers.value;
            return layers && layers.length > 0 ? layers[0].component : null;
        });

        const ctx = getCurrentContext();
        if (ctx) {
            ctx.outletDepth = 0;
        }

        return html`<Render component=${comp} />`;
    }
}

/**
 * Declarative <RouteOutlet> Component for Nested Route Subtrees
 */
export function RouteOutlet(props) {
    const ctx = getCurrentContext();
    let currentDepth = 1;
    if (ctx) {
        let p = ctx;
        while (p) {
            if (p.outletDepth !== undefined) {
                currentDepth = p.outletDepth + 1;
                break;
            }
            p = p.parent;
        }
        ctx.outletDepth = currentDepth;
    }

    const currentRouter = globalRouterInstance;
    const comp = computed(() => {
        if (!currentRouter) return null;
        const layers = currentRouter.activeLayers.value;
        return layers && layers.length > currentDepth ? layers[currentDepth].component : null;
    });

    return html`<Render component=${comp} />`;
}

let globalRouterInstance = null;

export function createRouter(options) {
    const router = new Router(options);
    globalRouterInstance = router;
    router.init();
    return router;
}

export function useRoute() {
    return currentRouteSignal.value;
}

export function navigate(to, options) {
    if (globalRouterInstance) {
        globalRouterInstance.navigate(to, options);
    }
}
