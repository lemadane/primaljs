/**
 * PrimalJS Component Registry
 */

import { If, ElseIf, Else, Switch, Case, Default, For, Continue, Break, Try, Catch, Async, Await, Pending } from "./control_flow.js";
import { Render } from "./render.js";

const registry = new Map();

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

export function getComponent(name) {
    if (!name) return null;
    return registry.get(name) || registry.get(name.toLowerCase()) || null;
}

export function clearRegistry() {
    registry.clear();
    registerDefaultComponents();
}

function registerDefaultComponents() {
    register(If, ElseIf, Else, Switch, Case, Default, For, Continue, Break, Try, Catch, Async, Await, Pending, Render);
}

registerDefaultComponents();
