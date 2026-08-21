/**
 * PrimalJS Component Registry
 */

import { Load } from "./mount.js";
import { Boundary } from "./boundary.js";

const registry = new Map();

/**
 * Registers one or more named function components for dynamic template tag lookup.
 *
 * @param {...Function} components
 */
export function register(...components) {
    for (const comp of components) {
        if (typeof comp !== "function") {
            throw new Error(`Cannot register non-function component: ${comp}`);
        }
        const name = comp.name;
        if (!name) {
            throw new Error("Cannot register anonymous component without a name.");
        }
        registry.set(name, comp);
        registry.set(name.toLowerCase(), comp);
    }
}

/**
 * Retrieves a registered component by tag name (case-insensitive).
 *
 * @param {string} name
 * @returns {Function | null}
 */
export function getComponent(name) {
    if (!name) return null;
    return registry.get(name) || registry.get(name.toLowerCase()) || null;
}

/**
 * Clears custom components from the registry while preserving default framework components.
 */
export function clearRegistry() {
    const savedRouteOutlet = registry.get("RouteOutlet");
    registry.clear();
    registerDefaultComponents();
    if (savedRouteOutlet) {
        register(savedRouteOutlet);
    }
}


function registerDefaultComponents() {
    register(Load, Boundary);
}

registerDefaultComponents();
