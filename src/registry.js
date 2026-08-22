/**
 * PrimalJS Component Registry
 */

import { Load } from "./load.js";
import { Guard, Boundary } from "./guard.js";
import { Place } from "./place.js";
import { WithinView } from "./within-view.js";
import { Animate } from "./animate.js";
import { Wait, Delay, Briefly, Failed } from "./async.js";
import { Keep } from "./keep.js";
import { OnIdle } from "./on-idle.js";
import { Focus } from "./focus.js";

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
    register(Load, Guard, Boundary, Place, WithinView, Animate, Wait, Delay, Briefly, Failed, Keep, OnIdle, Focus);
}

registerDefaultComponents();
