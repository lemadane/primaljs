/**
 * PrimalJS Declarative Control-Flow Helpers (<If>, <ElseIf>, <Else>, <Switch>, <Case>, <Default>, <For>, <Continue>, <Break>, <Try>, <Catch>, <Async>, <Await>, <Pending>)
 * Real DOM Range Ownership & Fine-Grained Reactive Branch/Loop/Error/Async Switching
 */

import { isSignal, effect } from "./signal.js";
import {
    ComponentContext,
    pushContext,
    popContext,
    getCurrentContext,
    triggerMount,
    destroyContext,
    onDestroy
} from "./lifecycle.js";
import { convertToDOMNode, resolveInnerSubtree } from "./html.js";
import { reportGlobalError } from "./app.js";

/**
 * <ElseIf> Component helper
 */
export function ElseIf(props) {
    const ctx = getCurrentContext();
    const isInsideIf = ctx && (ctx.name === "If" || (ctx.parent && ctx.parent.name === "If"));
    if (!isInsideIf && (!props || !props.__isControlFlowChild)) {
        throw new Error("<ElseIf> must be used within an <If> container.");
    }
    return {
        __isElseIf: true,
        when: props ? props.when : undefined,
        children: props ? props.children : []
    };
}

/**
 * <Else> Component helper
 */
export function Else(props) {
    const ctx = getCurrentContext();
    const isInsideIf = ctx && (ctx.name === "If" || (ctx.parent && ctx.parent.name === "If"));
    const isInsideFor = ctx && (ctx.name === "For" || (ctx.parent && ctx.parent.name === "For"));
    if (!isInsideIf && !isInsideFor && (!props || !props.__isControlFlowChild)) {
        throw new Error("<Else> must be used within an <If> or <For> container.");
    }
    return {
        __isElse: true,
        children: props ? props.children : []
    };
}

/**
 * <Case> Component helper
 */
export function Case(props) {
    const ctx = getCurrentContext();
    const isInsideSwitch = ctx && (ctx.name === "Switch" || (ctx.parent && ctx.parent.name === "Switch"));
    if (!isInsideSwitch && (!props || !props.__isControlFlowChild)) {
        throw new Error("<Case> must be used within a <Switch> container.");
    }

    let modeCount = 0;
    if (props && props.value !== undefined) modeCount++;
    if (props && props.values !== undefined) modeCount++;
    if (props && props.when !== undefined) modeCount++;

    if (modeCount === 0) {
        throw new Error("<Case> must specify exactly one matching mode.");
    }
    if (modeCount > 1) {
        throw new Error("<Case> cannot specify multiple matching modes.");
    }

    if (props && props.values !== undefined && !Array.isArray(props.values)) {
        throw new Error("<Case> 'values' prop must be an Array.");
    }

    return {
        __isCase: true,
        value: props ? props.value : undefined,
        values: props ? props.values : undefined,
        when: props ? props.when : undefined,
        children: props ? props.children : []
    };
}

/**
 * <Default> Component helper
 */
export function Default(props) {
    const ctx = getCurrentContext();
    const isInsideSwitch = ctx && (ctx.name === "Switch" || (ctx.parent && ctx.parent.name === "Switch"));
    if (!isInsideSwitch && (!props || !props.__isControlFlowChild)) {
        throw new Error("<Default> must be used within a <Switch> container.");
    }
    return {
        __isDefault: true,
        children: props ? props.children : []
    };
}

/**
 * <Continue> Component helper
 */
export function Continue(props) {
    const ctx = getCurrentContext();
    const isInsideFor = ctx && (
        ctx.name === "For" ||
        ctx.name.startsWith("ForItem:") ||
        (ctx.parent && (ctx.parent.name === "For" || ctx.parent.name.startsWith("ForItem:")))
    );
    if (!isInsideFor && (!props || !props.__isControlFlowChild)) {
        throw new Error("<Continue> must be used inside a <For> iteration callback.");
    }
    return {
        __isContinue: true,
        when: props ? props.when : undefined
    };
}

/**
 * <Break> Component helper
 */
export function Break(props) {
    const ctx = getCurrentContext();
    const isInsideFor = ctx && (
        ctx.name === "For" ||
        ctx.name.startsWith("ForItem:") ||
        (ctx.parent && (ctx.parent.name === "For" || ctx.parent.name.startsWith("ForItem:")))
    );
    if (!isInsideFor && (!props || !props.__isControlFlowChild)) {
        throw new Error("<Break> must be used inside a <For> iteration callback.");
    }
    return {
        __isBreak: true,
        when: props ? props.when : undefined
    };
}

/**
 * <Pending> Component helper
 */
export function Pending(props) {
    const ctx = getCurrentContext();
    const isInsideOwner = ctx && (
        ctx.name === "Wait" || ctx.name === "Delay" || ctx.name === "Await" || ctx.name === "Async" ||
        (ctx.parent && (ctx.parent.name === "Wait" || ctx.parent.name === "Delay" || ctx.parent.name === "Await" || ctx.parent.name === "Async"))
    );
    if (!isInsideOwner || !props || (!props.__isControlFlowChild && !props.__templateValues && props.children === undefined)) {
        throw new Error("<Pending> must be used within an <Await> or <Async> container.");
    }
    return {
        __isPending: true,
        __isBriefly: true,
        children: props ? props.children : []
    };
}

/**
 * <Briefly> Component helper (Human-first loading fallback)
 */
export function Briefly(props) {
    const ctx = getCurrentContext();
    const isInsideOwner = ctx && (
        ctx.name === "Wait" || ctx.name === "Delay" || ctx.name === "Await" || ctx.name === "Async" ||
        (ctx.parent && (ctx.parent.name === "Wait" || ctx.parent.name === "Delay" || ctx.parent.name === "Await" || ctx.parent.name === "Async"))
    );
    if (!isInsideOwner || !props || (!props.__isControlFlowChild && !props.__templateValues && props.children === undefined)) {
        throw new Error("<Briefly> must be used within a <Wait> or <Delay> container.");
    }
    return {
        __isBriefly: true,
        __isPending: true,
        children: props ? props.children : []
    };
}

/**
 * <Catch> Component helper
 */
export function Catch(props) {
    const ctx = getCurrentContext();
    const isInsideOwner = ctx && (
        ctx.name === "Try" || ctx.name === "Wait" || ctx.name === "Delay" || ctx.name === "Await" || ctx.name === "Async" ||
        (ctx.parent && (ctx.parent.name === "Try" || ctx.parent.name === "Wait" || ctx.parent.name === "Delay" || ctx.parent.name === "Await" || ctx.parent.name === "Async"))
    );
    if (!isInsideOwner || !props || (!props.__isControlFlowChild && !props.__templateValues && props.children === undefined)) {
        throw new Error("<Catch> must be a direct child of a <Try> container.");
    }

    let fn = typeof (props ? props.children : undefined) === "function" ? props.children : undefined;
    let children = props ? props.children : [];

    return {
        __isCatch: true,
        __isFailed: true,
        fn: fn,
        children: children
    };
}

/**
 * <Failed> Component helper (Human-first error fallback)
 */
export function Failed(props) {
    const ctx = getCurrentContext();
    const isInsideOwner = ctx && (
        ctx.name === "Try" || ctx.name === "Wait" || ctx.name === "Delay" || ctx.name === "Await" || ctx.name === "Async" ||
        (ctx.parent && (ctx.parent.name === "Try" || ctx.parent.name === "Wait" || ctx.parent.name === "Delay" || ctx.parent.name === "Await" || ctx.parent.name === "Async"))
    );
    if (!isInsideOwner || !props || (!props.__isControlFlowChild && !props.__templateValues && props.children === undefined)) {
        throw new Error("<Failed> must be a direct child of a <Try>, <Wait>, or <Delay> container.");
    }

    let fn = typeof (props ? props.children : undefined) === "function" ? props.children : undefined;
    let children = props ? props.children : [];

    return {
        __isFailed: true,
        __isCatch: true,
        fn: fn,
        children: children
    };
}

function isFormattingWhitespace(node) {
    if (typeof node === "string") {
        return node.trim() === "";
    }
    return node && node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() === "";
}

function unwrapPlaceholderValue(child, templateValues) {
    if (child && child.nodeType === Node.COMMENT_NODE) {
        const text = child.nodeValue ? child.nodeValue.trim() : "";
        if (text.startsWith("primal-ph-")) {
            const idx = parseInt(text.replace("primal-ph-", ""), 10);
            return templateValues[idx];
        }
    }
    return child;
}

function parseIfBranches(ifProps) {
    const templateValues = ifProps ? ifProps.__templateValues || [] : [];
    const rawChildren = ifProps && ifProps.children !== undefined
        ? (Array.isArray(ifProps.children) ? ifProps.children : [ifProps.children])
        : [];

    const branches = [];
    let currentBranch = {
        type: "If",
        condition: ifProps ? ifProps.when : undefined,
        content: []
    };
    branches.push(currentBranch);

    let hasElse = false;

    for (const child of rawChildren) {
        if (isFormattingWhitespace(child)) {
            continue;
        }

        let descriptor = (child && child._primalDescriptor) ? child._primalDescriptor : child;
        const isElement = child && child.nodeType === Node.ELEMENT_NODE;
        const tagName = isElement ? child.nodeName.toUpperCase() : "";

        if (isElement && (tagName === "ELSEIF" || tagName === "ELSE")) {
            const props = { __isControlFlowChild: true };
            for (let i = 0; i < child.attributes.length; i++) {
                const attr = child.attributes[i];
                if (attr.name.startsWith("primal-attr-")) {
                    const idx = parseInt(attr.name.replace("primal-attr-", ""), 10);
                    const targetPropName = attr.value;
                    props[targetPropName] = templateValues[idx];
                } else {
                    props[attr.name] = attr.value;
                }
            }
            const childNodes = Array.from(child.childNodes || []);
            if (childNodes.length === 1) {
                const singleChild = childNodes[0];
                props.children = singleChild.nodeType === Node.TEXT_NODE
                    ? singleChild.nodeValue
                    : singleChild;
            } else if (childNodes.length > 1) {
                props.children = childNodes.map(node =>
                    node.nodeType === Node.TEXT_NODE ? node.nodeValue : node
                );
            }

            if (tagName === "ELSEIF") {
                descriptor = ElseIf(props);
            } else {
                descriptor = Else(props);
            }
        }

        if (descriptor && descriptor.__isElseIf) {
            if (hasElse) {
                throw new Error("<ElseIf> cannot appear after <Else>.");
            }
            const content = descriptor.children !== undefined
                ? (Array.isArray(descriptor.children) ? descriptor.children : [descriptor.children])
                : [];
            currentBranch = {
                type: "ElseIf",
                condition: descriptor.when,
                content: content
            };
            branches.push(currentBranch);
        } else if (descriptor && descriptor.__isElse) {
            if (hasElse) {
                throw new Error("<If> can only contain a single <Else> branch.");
            }
            hasElse = true;
            const content = descriptor.children !== undefined
                ? (Array.isArray(descriptor.children) ? descriptor.children : [descriptor.children])
                : [];
            currentBranch = {
                type: "Else",
                condition: true,
                content: content
            };
            branches.push(currentBranch);
        } else {
            currentBranch.content.push(child);
        }
    }

    return branches;
}

function parseSwitchBranches(switchProps) {
    const templateValues = switchProps ? switchProps.__templateValues || [] : [];
    const rawChildren = switchProps && switchProps.children !== undefined
        ? (Array.isArray(switchProps.children) ? switchProps.children : [switchProps.children])
        : [];

    const branches = [];
    let hasDefault = false;

    for (const child of rawChildren) {
        if (isFormattingWhitespace(child)) {
            continue;
        }

        let descriptor = (child && child._primalDescriptor) ? child._primalDescriptor : child;
        const isElement = child && child.nodeType === Node.ELEMENT_NODE;
        const tagName = isElement ? child.nodeName.toUpperCase() : "";

        if (isElement && (tagName === "CASE" || tagName === "DEFAULT")) {
            const props = { __isControlFlowChild: true };
            for (let i = 0; i < child.attributes.length; i++) {
                const attr = child.attributes[i];
                if (attr.name.startsWith("primal-attr-")) {
                    const idx = parseInt(attr.name.replace("primal-attr-", ""), 10);
                    const targetPropName = attr.value;
                    props[targetPropName] = templateValues[idx];
                } else {
                    props[attr.name] = attr.value;
                }
            }
            const childNodes = Array.from(child.childNodes || []);
            if (childNodes.length === 1) {
                const singleChild = childNodes[0];
                props.children = singleChild.nodeType === Node.TEXT_NODE
                    ? singleChild.nodeValue
                    : singleChild;
            } else if (childNodes.length > 1) {
                props.children = childNodes.map(node =>
                    node.nodeType === Node.TEXT_NODE ? node.nodeValue : node
                );
            }

            if (tagName === "CASE") {
                descriptor = Case(props);
            } else {
                descriptor = Default(props);
            }
        }

        if (descriptor && descriptor.__isCase) {
            if (hasDefault) {
                throw new Error("<Case> cannot appear after <Default>.");
            }
            const content = descriptor.children !== undefined
                ? (Array.isArray(descriptor.children) ? descriptor.children : [descriptor.children])
                : [];
            branches.push({
                type: "Case",
                value: descriptor.value,
                values: descriptor.values,
                when: descriptor.when,
                content: content
            });
        } else if (descriptor && descriptor.__isDefault) {
            if (hasDefault) {
                throw new Error("<Switch> can only contain a single <Default> branch.");
            }
            hasDefault = true;
            const content = descriptor.children !== undefined
                ? (Array.isArray(descriptor.children) ? descriptor.children : [descriptor.children])
                : [];
            branches.push({
                type: "Default",
                isDefault: true,
                content: content
            });
        }
    }

    return branches;
}

function parseForChildren(forProps) {
    const templateValues = forProps ? forProps.__templateValues || [] : [];
    const rawChildren = forProps && forProps.children !== undefined
        ? (Array.isArray(forProps.children) ? forProps.children : [forProps.children])
        : [];

    let renderItem = null;
    let elseBranch = null;
    let hasElse = false;
    let hasCallback = false;

    for (const child of rawChildren) {
        if (isFormattingWhitespace(child)) {
            continue;
        }

        const effectiveChild = unwrapPlaceholderValue(child, templateValues);
        if (typeof effectiveChild === "function") {
            if (hasElse) {
                throw new Error("<Else> must appear after the iteration callback in <For>.");
            }
            renderItem = effectiveChild;
            hasCallback = true;
            continue;
        }

        let descriptor = (child && child._primalDescriptor) ? child._primalDescriptor : child;
        const isElement = child && child.nodeType === Node.ELEMENT_NODE;
        const tagName = isElement ? child.nodeName.toUpperCase() : "";

        if (isElement && tagName === "ELSE") {
            const props = { __isControlFlowChild: true };
            for (let i = 0; i < child.attributes.length; i++) {
                const attr = child.attributes[i];
                if (attr.name.startsWith("primal-attr-")) {
                    const idx = parseInt(attr.name.replace("primal-attr-", ""), 10);
                    const targetPropName = attr.value;
                    props[targetPropName] = templateValues[idx];
                } else {
                    props[attr.name] = attr.value;
                }
            }
            const childNodes = Array.from(child.childNodes || []);
            if (childNodes.length === 1) {
                const singleChild = childNodes[0];
                props.children = singleChild.nodeType === Node.TEXT_NODE
                    ? singleChild.nodeValue
                    : singleChild;
            } else if (childNodes.length > 1) {
                props.children = childNodes.map(node =>
                    node.nodeType === Node.TEXT_NODE ? node.nodeValue : node
                );
            }
            descriptor = Else(props);
        }

        if (descriptor && descriptor.__isElse) {
            if (hasElse) {
                throw new Error("<For> can only contain a single <Else> branch.");
            }
            hasElse = true;
            elseBranch = descriptor.children !== undefined
                ? (Array.isArray(descriptor.children) ? descriptor.children : [descriptor.children])
                : [];
        }
    }

    if (!hasCallback) {
        throw new Error("<For> requires a child render function item callback.");
    }

    return { renderItem, elseBranch };
}

function parseTryChildren(tryProps) {
    const templateValues = tryProps ? tryProps.__templateValues || [] : [];
    const rawChildren = tryProps && tryProps.children !== undefined
        ? (Array.isArray(tryProps.children) ? tryProps.children : [tryProps.children])
        : [];

    const protectedContent = [];
    let catchBranch = null;
    let hasCatch = false;

    for (const child of rawChildren) {
        if (isFormattingWhitespace(child)) {
            continue;
        }

        let descriptor = (child && child._primalDescriptor) ? child._primalDescriptor : child;
        const isElement = child && child.nodeType === Node.ELEMENT_NODE;
        const tagName = isElement ? child.nodeName.toUpperCase() : "";

        if (isElement && tagName === "CATCH") {
            const props = { __isControlFlowChild: true };
            for (let i = 0; i < child.attributes.length; i++) {
                const attr = child.attributes[i];
                if (attr.name.startsWith("primal-attr-")) {
                    const idx = parseInt(attr.name.replace("primal-attr-", ""), 10);
                    const targetPropName = attr.value;
                    props[targetPropName] = templateValues[idx];
                } else {
                    props[attr.name] = attr.value;
                }
            }
            const childNodes = Array.from(child.childNodes || []);

            let catchFn = null;
            if (childNodes.length === 1 && childNodes[0].nodeType === Node.COMMENT_NODE) {
                const text = childNodes[0].nodeValue ? childNodes[0].nodeValue.trim() : "";
                if (text.startsWith("primal-ph-")) {
                    const idx = parseInt(text.replace("primal-ph-", ""), 10);
                    if (typeof templateValues[idx] === "function") {
                        catchFn = templateValues[idx];
                    }
                }
            }

            if (!catchFn) {
                if (childNodes.length === 1) {
                    const singleChild = childNodes[0];
                    props.children = singleChild.nodeType === Node.TEXT_NODE
                        ? singleChild.nodeValue
                        : singleChild;
                } else if (childNodes.length > 1) {
                    props.children = childNodes.map(node =>
                        node.nodeType === Node.TEXT_NODE ? node.nodeValue : node
                    );
                }
            } else {
                props.children = catchFn;
            }

            descriptor = Catch(props);
        }

        if (descriptor && descriptor.__isCatch) {
            if (hasCatch) {
                throw new Error("<Try> can only contain a single <Catch> branch.");
            }
            hasCatch = true;

            let catchFn = descriptor.fn;
            let catchContent = descriptor.children !== undefined
                ? (Array.isArray(descriptor.children) ? descriptor.children : [descriptor.children])
                : [];

            const realContent = catchContent.filter(c => !isFormattingWhitespace(c));
            if (!catchFn && realContent.length === 1 && realContent[0]) {
                const node = unwrapPlaceholderValue(realContent[0], templateValues);
                if (typeof node === "function") {
                    catchFn = node;
                } else if (realContent[0] && realContent[0].nodeType === Node.COMMENT_NODE) {
                    const text = realContent[0].nodeValue ? realContent[0].nodeValue.trim() : "";
                    if (text.startsWith("primal-ph-")) {
                        const idx = parseInt(text.replace("primal-ph-", ""), 10);
                        if (typeof templateValues[idx] === "function") {
                            catchFn = templateValues[idx];
                        }
                    }
                }
            }

            catchBranch = {
                fn: catchFn,
                content: catchContent
            };
        } else {
            if (hasCatch) {
                throw new Error("<Catch> must be the final child in <Try>.");
            }
            protectedContent.push(child);
        }
    }

    if (!hasCatch) {
        throw new Error("<Try> must contain a <Catch> child.");
    }

    return { protectedContent, catchBranch };
}

function parseAwaitChildren(awaitProps) {
    const templateValues = awaitProps ? awaitProps.__templateValues || [] : [];
    const rawChildren = awaitProps && awaitProps.children !== undefined
        ? (Array.isArray(awaitProps.children) ? awaitProps.children : [awaitProps.children])
        : [];

    let renderResult = null;
    let pendingBranch = null;
    let catchBranch = null;
    let hasPending = false;
    let hasCatch = false;

    for (const child of rawChildren) {
        if (isFormattingWhitespace(child)) {
            continue;
        }

        const effectiveChild = unwrapPlaceholderValue(child, templateValues);
        if (typeof effectiveChild === "function") {
            if (hasPending || hasCatch) {
                throw new Error("Result renderer function in <Await> must appear before <Pending> and <Catch>.");
            }
            renderResult = effectiveChild;
            continue;
        }

        let descriptor = (child && child._primalDescriptor) ? child._primalDescriptor : child;
        const isElement = child && child.nodeType === Node.ELEMENT_NODE;
        const tagName = isElement ? child.nodeName.toUpperCase() : "";

        if (isElement && (tagName === "PENDING" || tagName === "BRIEFLY" || tagName === "CATCH" || tagName === "FAILED")) {
            const props = { __isControlFlowChild: true };
            for (let i = 0; i < child.attributes.length; i++) {
                const attr = child.attributes[i];
                if (attr.name.startsWith("primal-attr-")) {
                    const idx = parseInt(attr.name.replace("primal-attr-", ""), 10);
                    const targetPropName = attr.value;
                    props[targetPropName] = templateValues[idx];
                } else {
                    props[attr.name] = attr.value;
                }
            }
            const childNodes = Array.from(child.childNodes || []);

            let catchFn = null;
            if ((tagName === "CATCH" || tagName === "FAILED") && childNodes.length === 1 && childNodes[0].nodeType === Node.COMMENT_NODE) {
                const text = childNodes[0].nodeValue ? childNodes[0].nodeValue.trim() : "";
                if (text.startsWith("primal-ph-")) {
                    const idx = parseInt(text.replace("primal-ph-", ""), 10);
                    if (typeof templateValues[idx] === "function") {
                        catchFn = templateValues[idx];
                    }
                }
            }

            if (!catchFn) {
                if (childNodes.length === 1) {
                    const singleChild = childNodes[0];
                    props.children = singleChild.nodeType === Node.TEXT_NODE
                        ? singleChild.nodeValue
                        : singleChild;
                } else if (childNodes.length > 1) {
                    props.children = childNodes.map(node =>
                        node.nodeType === Node.TEXT_NODE ? node.nodeValue : node
                    );
                }
            } else {
                props.children = catchFn;
            }

            if (tagName === "PENDING" || tagName === "BRIEFLY") {
                descriptor = Briefly(props);
            } else {
                descriptor = Failed(props);
            }
        }

        if (descriptor && (descriptor.__isPending || descriptor.__isBriefly)) {
            if (hasPending) {
                throw new Error("<Await> can only contain a single <Pending> branch.");
            }
            if (hasCatch) {
                throw new Error("<Pending> must appear before <Catch> in <Await>.");
            }
            hasPending = true;
            pendingBranch = descriptor.children !== undefined
                ? (Array.isArray(descriptor.children) ? descriptor.children : [descriptor.children])
                : [];
        } else if (descriptor && (descriptor.__isCatch || descriptor.__isFailed)) {
            if (hasCatch) {
                throw new Error("<Await> can only contain a single <Catch> branch.");
            }
            hasCatch = true;

            let catchFn = descriptor.fn;
            let catchContent = descriptor.children !== undefined
                ? (Array.isArray(descriptor.children) ? descriptor.children : [descriptor.children])
                : [];

            const realContent = catchContent.filter(c => !isFormattingWhitespace(c));
            if (!catchFn && realContent.length === 1 && realContent[0]) {
                const node = unwrapPlaceholderValue(realContent[0], templateValues);
                if (typeof node === "function") {
                    catchFn = node;
                } else if (realContent[0] && realContent[0].nodeType === Node.COMMENT_NODE) {
                    const text = realContent[0].nodeValue ? realContent[0].nodeValue.trim() : "";
                    if (text.startsWith("primal-ph-")) {
                        const idx = parseInt(text.replace("primal-ph-", ""), 10);
                        if (typeof templateValues[idx] === "function") {
                            catchFn = templateValues[idx];
                        }
                    }
                }
            }

            catchBranch = {
                fn: catchFn,
                content: catchContent
            };
        } else {
            if (hasPending || hasCatch) {
                throw new Error("Static children in <Await> must appear before <Pending> and <Catch>.");
            }
            if (renderResult === null) {
                renderResult = child;
            }
        }
    }

    return { renderResult, pendingBranch, catchBranch };
}

function parseAsyncChildren(asyncProps) {
    const templateValues = asyncProps ? asyncProps.__templateValues || [] : [];
    const rawChildren = asyncProps && asyncProps.children !== undefined
        ? (Array.isArray(asyncProps.children) ? asyncProps.children : [asyncProps.children])
        : [];

    let renderResult = null;
    let pendingBranch = null;
    let catchBranch = null;
    let hasPending = false;
    let hasCatch = false;
    const nonStructuralChildren = [];

    for (const child of rawChildren) {
        if (isFormattingWhitespace(child)) {
            continue;
        }

        const effectiveChild = unwrapPlaceholderValue(child, templateValues);
        if (typeof effectiveChild === "function") {
            if (hasPending || hasCatch) {
                throw new Error("Result renderer function in <Async> must appear before <Pending> and <Catch>.");
            }
            renderResult = effectiveChild;
            continue;
        }

        let descriptor = (child && child._primalDescriptor) ? child._primalDescriptor : child;
        const isElement = child && child.nodeType === Node.ELEMENT_NODE;
        const tagName = isElement ? child.nodeName.toUpperCase() : "";

        if (isElement && (tagName === "PENDING" || tagName === "BRIEFLY" || tagName === "CATCH" || tagName === "FAILED")) {
            const props = { __isControlFlowChild: true };
            for (let i = 0; i < child.attributes.length; i++) {
                const attr = child.attributes[i];
                if (attr.name.startsWith("primal-attr-")) {
                    const idx = parseInt(attr.name.replace("primal-attr-", ""), 10);
                    const targetPropName = attr.value;
                    props[targetPropName] = templateValues[idx];
                } else {
                    props[attr.name] = attr.value;
                }
            }
            const childNodes = Array.from(child.childNodes || []);

            let catchFn = null;
            if ((tagName === "CATCH" || tagName === "FAILED") && childNodes.length === 1 && childNodes[0].nodeType === Node.COMMENT_NODE) {
                const text = childNodes[0].nodeValue ? childNodes[0].nodeValue.trim() : "";
                if (text.startsWith("primal-ph-")) {
                    const idx = parseInt(text.replace("primal-ph-", ""), 10);
                    if (typeof templateValues[idx] === "function") {
                        catchFn = templateValues[idx];
                    }
                }
            }

            if (!catchFn) {
                if (childNodes.length === 1) {
                    const singleChild = childNodes[0];
                    props.children = singleChild.nodeType === Node.TEXT_NODE
                        ? singleChild.nodeValue
                        : singleChild;
                } else if (childNodes.length > 1) {
                    props.children = childNodes.map(node =>
                        node.nodeType === Node.TEXT_NODE ? node.nodeValue : node
                    );
                }
            } else {
                props.children = catchFn;
            }

            if (tagName === "PENDING" || tagName === "BRIEFLY") {
                descriptor = Briefly(props);
            } else {
                descriptor = Failed(props);
            }
        }

        if (descriptor && (descriptor.__isPending || descriptor.__isBriefly)) {
            if (hasPending) {
                throw new Error("<Async> can only contain a single <Pending> branch.");
            }
            if (hasCatch) {
                throw new Error("<Pending> must appear before <Catch> in <Async>.");
            }
            hasPending = true;
            pendingBranch = descriptor.children !== undefined
                ? (Array.isArray(descriptor.children) ? descriptor.children : [descriptor.children])
                : [];
        } else if (descriptor && (descriptor.__isCatch || descriptor.__isFailed)) {
            if (hasCatch) {
                throw new Error("<Async> can only contain a single <Catch> branch.");
            }
            hasCatch = true;

            let catchFn = descriptor.fn;
            let catchContent = descriptor.children !== undefined
                ? (Array.isArray(descriptor.children) ? descriptor.children : [descriptor.children])
                : [];

            const realContent = catchContent.filter(c => !isFormattingWhitespace(c));
            if (!catchFn && realContent.length === 1 && realContent[0]) {
                const node = unwrapPlaceholderValue(realContent[0], templateValues);
                if (typeof node === "function") {
                    catchFn = node;
                } else if (realContent[0] && realContent[0].nodeType === Node.COMMENT_NODE) {
                    const text = realContent[0].nodeValue ? realContent[0].nodeValue.trim() : "";
                    if (text.startsWith("primal-ph-")) {
                        const idx = parseInt(text.replace("primal-ph-", ""), 10);
                        if (typeof templateValues[idx] === "function") {
                            catchFn = templateValues[idx];
                        }
                    }
                }
            }

            catchBranch = {
                fn: catchFn,
                content: catchContent
            };
        } else {
            nonStructuralChildren.push(child);
        }
    }

    return { renderResult, nonStructuralChildren, pendingBranch, catchBranch };
}

function clearAnchorRange(startAnchor, endAnchor) {
    const parent = startAnchor.parentNode;
    if (!parent) return;

    let current = startAnchor.nextSibling;
    while (current && current !== endAnchor) {
        const next = current.nextSibling;
        parent.removeChild(current);
        current = next;
    }
}

function insertAfterAnchor(startAnchor, domNode) {
    const parent = startAnchor.parentNode;
    if (!parent || !domNode) return;
    parent.insertBefore(domNode, startAnchor.nextSibling);
}

function evaluateCondition(cond) {
    let rawVal;
    if (typeof cond === "function") {
        rawVal = cond();
    } else if (isSignal(cond)) {
        rawVal = cond.value;
    } else {
        rawVal = cond;
    }
    return Boolean(rawVal);
}

function evaluateSwitchValue(val) {
    if (typeof val === "function") {
        return val();
    } else if (isSignal(val)) {
        return val.value;
    } else {
        return val;
    }
}

function evaluateCollection(collectionProp) {
    let unwrapped;
    if (typeof collectionProp === "function") {
        unwrapped = collectionProp();
    } else if (isSignal(collectionProp)) {
        unwrapped = collectionProp.value;
    } else {
        unwrapped = collectionProp;
    }

    if (unwrapped === null || unwrapped === undefined) {
        return [];
    }

    if (unwrapped && (unwrapped instanceof Promise || typeof unwrapped.then === "function")) {
        throw new Error("<For> 'each' prop received a Promise. Use <Await> for Promise handling.");
    }

    if (!Array.isArray(unwrapped)) {
        throw new Error("<For> 'each' prop must be an Array or iterable collection.");
    }

    return unwrapped;
}

function renderItemNodes(item, index, renderItem, props, itemCtx) {
    pushContext(itemCtx);
    let rawNodes = [];
    try {
        const itemResult = renderItem(item, index);
        const dom = convertToDOMNode(itemResult, itemCtx);
        if (dom instanceof DocumentFragment) {
            rawNodes = Array.from(dom.childNodes);
        } else if (Array.isArray(dom)) {
            rawNodes = dom;
        } else if (dom) {
            rawNodes = [dom];
        }
    } finally {
        popContext();
    }

    const finalNodes = [];
    let isContinued = false;
    let isBroken = false;

    for (const node of rawNodes) {
        if (isFormattingWhitespace(node)) {
            continue;
        }
        let descriptor = (node && node._primalDescriptor) ? node._primalDescriptor : null;
        if (!descriptor && node && node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.nodeName.toUpperCase();
            if (tagName === "CONTINUE" || tagName === "BREAK") {
                const templateValues = itemCtx && itemCtx.templateValues ? itemCtx.templateValues : [];
                let whenVal = node.getAttribute("when");
                for (let i = 0; i < node.attributes.length; i++) {
                    const attr = node.attributes[i];
                    if (attr.name.startsWith("primal-attr-") && attr.value === "when") {
                        const idx = parseInt(attr.name.replace("primal-attr-", ""), 10);
                        whenVal = templateValues[idx];
                        break;
                    }
                }
                descriptor = {
                    __isContinue: tagName === "CONTINUE",
                    __isBreak: tagName === "BREAK",
                    when: whenVal
                };
            }
        }

        if (descriptor && descriptor.__isContinue) {
            const conditionVal = descriptor.when === undefined ? true : evaluateCondition(descriptor.when);
            if (conditionVal) {
                isContinued = true;
                break;
            }
            continue;
        }

        if (descriptor && descriptor.__isBreak) {
            const conditionVal = descriptor.when === undefined ? true : evaluateCondition(descriptor.when);
            if (conditionVal) {
                isBroken = true;
                break;
            }
            continue;
        }

        finalNodes.push(node);
    }

    return { finalNodes, isContinued, isBroken };
}

/**
 * Declarative <If> Component
 */
export function If(props) {
    const ctx = getCurrentContext();
    const branches = parseIfBranches(props);

    const startAnchor = document.createComment("primal:if:start");
    const endAnchor = document.createComment("primal:if:end");

    const fragment = document.createDocumentFragment();
    fragment.appendChild(startAnchor);
    fragment.appendChild(endAnchor);

    let activeBranchIndex = -1;
    let activeBranchCtx = null;

    const disposer = effect(() => {
        let selectedIndex = -1;

        for (let i = 0; i < branches.length; i++) {
            if (evaluateCondition(branches[i].condition)) {
                selectedIndex = i;
                break;
            }
        }

        if (selectedIndex === activeBranchIndex) {
            return;
        }

        if (activeBranchCtx) {
            destroyContext(activeBranchCtx);
            activeBranchCtx = null;
        }

        clearAnchorRange(startAnchor, endAnchor);
        activeBranchIndex = selectedIndex;

        if (selectedIndex !== -1) {
            const targetBranch = branches[selectedIndex];
            activeBranchCtx = new ComponentContext(`IfBranch:${targetBranch.type}`);
            activeBranchCtx.templateValues = props.__templateValues || [];
            activeBranchCtx.capitalTags = props.__capitalTags || new Set();
            if (ctx && ctx.tryBoundary) activeBranchCtx.tryBoundary = ctx.tryBoundary;

            if (ctx && !ctx.children.includes(activeBranchCtx)) {
                ctx.children.push(activeBranchCtx);
            }

            pushContext(activeBranchCtx);
            let branchDOM;
            try {
                const nodes = targetBranch.content.map(c => {
                    const cloned = c instanceof Node ? c.cloneNode(true) : c;
                    if (cloned && cloned.nodeType === Node.ELEMENT_NODE && cloned.innerHTML && cloned.innerHTML.includes("primal-ph-")) {
                        resolveInnerSubtree(cloned, activeBranchCtx.templateValues, activeBranchCtx, activeBranchCtx.capitalTags);
                    }
                    return convertToDOMNode(cloned, activeBranchCtx);
                });
                branchDOM = document.createDocumentFragment();
                for (const node of nodes) {
                    if (node) branchDOM.appendChild(node);
                }
            } finally {
                popContext();
            }

            insertAfterAnchor(startAnchor, branchDOM);
            triggerMount(activeBranchCtx);
        }
    });

    if (ctx) {
        ctx.addEffect(disposer);
        ctx.addDestroyHook(() => {
            if (activeBranchCtx) {
                destroyContext(activeBranchCtx);
                activeBranchCtx = null;
            }
            clearAnchorRange(startAnchor, endAnchor);
        });
    }

    return fragment;
}

/**
 * Declarative <Switch> Component
 */
export function Switch(props) {
    const ctx = getCurrentContext();
    const branches = parseSwitchBranches(props);

    const startAnchor = document.createComment("primal:switch:start");
    const endAnchor = document.createComment("primal:switch:end");

    const fragment = document.createDocumentFragment();
    fragment.appendChild(startAnchor);
    fragment.appendChild(endAnchor);

    let activeBranchIndex = -1;
    let activeBranchCtx = null;

    const disposer = effect(() => {
        const targetVal = evaluateSwitchValue(props ? props.value : undefined);
        let selectedIndex = -1;

        for (let i = 0; i < branches.length; i++) {
            const branch = branches[i];

            if (branch.isDefault) {
                if (selectedIndex === -1) {
                    selectedIndex = i;
                }
                continue;
            }

            if (branch.value !== undefined) {
                const caseVal = evaluateSwitchValue(branch.value);
                if (Object.is(targetVal, caseVal)) {
                    selectedIndex = i;
                    break;
                }
            } else if (branch.values !== undefined) {
                const isMatch = branch.values.some(v => Object.is(targetVal, evaluateSwitchValue(v)));
                if (isMatch) {
                    selectedIndex = i;
                    break;
                }
            } else if (branch.when !== undefined) {
                const isMatch = typeof branch.when === "function" ? Boolean(branch.when(targetVal)) : evaluateCondition(branch.when);
                if (isMatch) {
                    selectedIndex = i;
                    break;
                }
            }
        }

        if (selectedIndex === activeBranchIndex) {
            return;
        }

        if (activeBranchCtx) {
            destroyContext(activeBranchCtx);
            activeBranchCtx = null;
        }

        clearAnchorRange(startAnchor, endAnchor);
        activeBranchIndex = selectedIndex;

        if (selectedIndex !== -1) {
            const targetBranch = branches[selectedIndex];
            activeBranchCtx = new ComponentContext(`SwitchBranch:${targetBranch.type}`);
            activeBranchCtx.templateValues = props.__templateValues || [];
            activeBranchCtx.capitalTags = props.__capitalTags || new Set();
            if (ctx && ctx.tryBoundary) activeBranchCtx.tryBoundary = ctx.tryBoundary;

            if (ctx && !ctx.children.includes(activeBranchCtx)) {
                ctx.children.push(activeBranchCtx);
            }

            pushContext(activeBranchCtx);
            let branchDOM;
            try {
                const nodes = targetBranch.content.map(c => {
                    const cloned = c instanceof Node ? c.cloneNode(true) : c;
                    if (cloned && cloned.nodeType === Node.ELEMENT_NODE && cloned.innerHTML && cloned.innerHTML.includes("primal-ph-")) {
                        resolveInnerSubtree(cloned, activeBranchCtx.templateValues, activeBranchCtx, activeBranchCtx.capitalTags);
                    }
                    return convertToDOMNode(cloned, activeBranchCtx);
                });
                branchDOM = document.createDocumentFragment();
                for (const node of nodes) {
                    if (node) branchDOM.appendChild(node);
                }
            } finally {
                popContext();
            }

            insertAfterAnchor(startAnchor, branchDOM);
            triggerMount(activeBranchCtx);
        }
    });

    if (ctx) {
        ctx.addEffect(disposer);
        ctx.addDestroyHook(() => {
            if (activeBranchCtx) {
                destroyContext(activeBranchCtx);
                activeBranchCtx = null;
            }
            clearAnchorRange(startAnchor, endAnchor);
        });
    }

    return fragment;
}

/**
 * Declarative <For> Component
 */
export function For(props) {
    const ctx = getCurrentContext();
    const { renderItem, elseBranch } = parseForChildren(props);

    const startAnchor = document.createComment("primal:for:start");
    const endAnchor = document.createComment("primal:for:end");

    const fragment = document.createDocumentFragment();
    fragment.appendChild(startAnchor);
    fragment.appendChild(endAnchor);

    const itemCache = new Map();
    let activeElseCtx = null;

    const disposer = effect(() => {
        const collection = evaluateCollection(props ? props.each : undefined);

        if (collection.length === 0) {
            for (const itemRecord of itemCache.values()) {
                destroyContext(itemRecord.ctx);
            }
            itemCache.clear();
            clearAnchorRange(startAnchor, endAnchor);

            if (elseBranch && elseBranch.length > 0) {
                if (!activeElseCtx) {
                    activeElseCtx = new ComponentContext("ForElse");
                    activeElseCtx.templateValues = props.__templateValues || [];
                    activeElseCtx.capitalTags = props.__capitalTags || new Set();
                    if (ctx && ctx.tryBoundary) activeElseCtx.tryBoundary = ctx.tryBoundary;

                    if (ctx && !ctx.children.includes(activeElseCtx)) {
                        ctx.children.push(activeElseCtx);
                    }
                    pushContext(activeElseCtx);
                    let elseDOM;
                    try {
                        const nodes = elseBranch.map(c => {
                            const cloned = c instanceof Node ? c.cloneNode(true) : c;
                            return convertToDOMNode(cloned, activeElseCtx);
                        });
                        elseDOM = document.createDocumentFragment();
                        for (const node of nodes) {
                            if (node) elseDOM.appendChild(node);
                        }
                    } finally {
                        popContext();
                    }
                    insertAfterAnchor(startAnchor, elseDOM);
                    triggerMount(activeElseCtx);
                }
            }
            return;
        }

        if (activeElseCtx) {
            destroyContext(activeElseCtx);
            activeElseCtx = null;
            clearAnchorRange(startAnchor, endAnchor);
        }

        const newKeysSeen = new Set();
        const newRecords = [];

        for (let i = 0; i < collection.length; i++) {
            const rawItem = collection[i];

            let key;
            if (typeof props.key === "function") {
                key = props.key(rawItem, i);
            } else if (typeof props.key === "string" && rawItem && typeof rawItem === "object") {
                key = rawItem[props.key];
            } else if (rawItem && typeof rawItem === "object" && "id" in rawItem) {
                key = rawItem.id;
            } else if (rawItem && typeof rawItem === "object" && "key" in rawItem) {
                key = rawItem.key;
            } else {
                key = i;
            }

            if (newKeysSeen.has(key)) {
                throw new Error(`<For> detected duplicate key '${key}'.`);
            }
            newKeysSeen.add(key);

            let record = itemCache.get(key);
            if (record) {
                record.index = i;
                newRecords.push(record);
            } else {
                const itemCtx = new ComponentContext(`ForItem:${key}`);
                itemCtx.templateValues = props.__templateValues || [];
                itemCtx.capitalTags = props.__capitalTags || new Set();
                if (ctx && ctx.tryBoundary) itemCtx.tryBoundary = ctx.tryBoundary;

                if (ctx && !ctx.children.includes(itemCtx)) {
                    ctx.children.push(itemCtx);
                }

                const { finalNodes, isContinued, isBroken } = renderItemNodes(rawItem, i, renderItem, props, itemCtx);

                if (isContinued) {
                    destroyContext(itemCtx);
                    continue;
                }

                record = {
                    key: key,
                    index: i,
                    ctx: itemCtx,
                    nodes: finalNodes,
                    isNew: true
                };
                newRecords.push(record);

                if (isBroken) {
                    break;
                }
            }
        }

        for (const [key, record] of itemCache.entries()) {
            if (!newKeysSeen.has(key)) {
                destroyContext(record.ctx);
                itemCache.delete(key);
            }
        }

        clearAnchorRange(startAnchor, endAnchor);

        const newMap = new Map();
        const parent = startAnchor.parentNode;
        let referenceNode = endAnchor;

        for (let idx = newRecords.length - 1; idx >= 0; idx--) {
            const rec = newRecords[idx];
            newMap.set(rec.key, rec);

            const frag = document.createDocumentFragment();
            for (const node of rec.nodes) {
                frag.appendChild(node);
            }

            if (parent) {
                parent.insertBefore(frag, referenceNode);
                if (rec.nodes.length > 0) {
                    referenceNode = rec.nodes[0];
                }
            }

            if (rec.isNew) {
                rec.isNew = false;
                triggerMount(rec.ctx);
            }
        }

        itemCache.clear();
        for (const [k, v] of newMap.entries()) {
            itemCache.set(k, v);
        }
    });

    if (ctx) {
        ctx.addEffect(disposer);
        ctx.addDestroyHook(() => {
            for (const itemRecord of itemCache.values()) {
                destroyContext(itemRecord.ctx);
            }
            itemCache.clear();

            if (activeElseCtx) {
                destroyContext(activeElseCtx);
                activeElseCtx = null;
            }
            clearAnchorRange(startAnchor, endAnchor);
        });
    }

    return fragment;
}

/**
 * Declarative <Try> Component
 */
export function Try(props) {
    const ctx = getCurrentContext();
    const { protectedContent, catchBranch } = parseTryChildren(props);

    const startAnchor = document.createComment("primal:try:start");
    const endAnchor = document.createComment("primal:try:end");

    const fragment = document.createDocumentFragment();
    fragment.appendChild(startAnchor);
    fragment.appendChild(endAnchor);

    let activeProtectedCtx = null;
    let activeCatchCtx = null;
    let isErrorState = false;

    const clearActiveState = () => {
        if (activeProtectedCtx) {
            destroyContext(activeProtectedCtx);
            activeProtectedCtx = null;
        }
        if (activeCatchCtx) {
            destroyContext(activeCatchCtx);
            activeCatchCtx = null;
        }
        clearAnchorRange(startAnchor, endAnchor);
    };

    const tryBoundary = {
        isDestroyed: false,
        handleError: (err) => {
            if (tryBoundary.isDestroyed || isErrorState) {
                return;
            }
            isErrorState = true;
            clearActiveState();

            mountCatch(err);
        }
    };

    const mountCatch = (errorObj) => {
        activeCatchCtx = new ComponentContext("TryCatch");
        activeCatchCtx.templateValues = props.__templateValues || [];
        activeCatchCtx.capitalTags = props.__capitalTags || new Set();

        const parentTryBoundary = ctx ? ctx.tryBoundary : null;
        if (parentTryBoundary) {
            activeCatchCtx.tryBoundary = parentTryBoundary;
        }

        if (ctx && !ctx.children.includes(activeCatchCtx)) {
            ctx.children.push(activeCatchCtx);
        }

        const resetFn = () => {
            if (tryBoundary.isDestroyed) return;
            isErrorState = false;
            clearActiveState();
            mountProtected();
        };

        pushContext(activeCatchCtx);
        let catchDOM;
        try {
            if (typeof catchBranch.fn === "function") {
                const res = catchBranch.fn(errorObj, resetFn);
                const nodes = Array.isArray(res) ? res : [res];
                catchDOM = document.createDocumentFragment();
                for (const c of nodes) {
                    const domNode = convertToDOMNode(c, activeCatchCtx);
                    if (domNode) catchDOM.appendChild(domNode);
                }
            } else if (catchBranch && catchBranch.content) {
                const nodes = catchBranch.content.map(c => {
                    const cloned = c instanceof Node ? c.cloneNode(true) : c;
                    return convertToDOMNode(cloned, activeCatchCtx);
                });
                catchDOM = document.createDocumentFragment();
                for (const node of nodes) {
                    if (node) catchDOM.appendChild(node);
                }
            }
        } catch (err) {
            if (parentTryBoundary && typeof parentTryBoundary.handleError === "function") {
                parentTryBoundary.handleError(err);
            } else {
                reportGlobalError(err, { type: "try_catch", component: ctx ? ctx.name : null });
                throw err;
            }
            return;
        } finally {
            popContext();
        }

        if (catchDOM) {
            insertAfterAnchor(startAnchor, catchDOM);
            triggerMount(activeCatchCtx);
        }
    };

    const mountProtected = () => {
        activeProtectedCtx = new ComponentContext("TryProtected");
        activeProtectedCtx.templateValues = props.__templateValues || [];
        activeProtectedCtx.capitalTags = props.__capitalTags || new Set();
        activeProtectedCtx.tryBoundary = tryBoundary;

        if (ctx && !ctx.children.includes(activeProtectedCtx)) {
            ctx.children.push(activeProtectedCtx);
        }

        pushContext(activeProtectedCtx);
        let protectedDOM;
        try {
            const nodes = protectedContent.map(c => {
                const cloned = c instanceof Node ? c.cloneNode(true) : c;
                return convertToDOMNode(cloned, activeProtectedCtx);
            });
            protectedDOM = document.createDocumentFragment();
            for (const node of nodes) {
                if (node) protectedDOM.appendChild(node);
            }
        } catch (err) {
            tryBoundary.handleError(err);
            return;
        } finally {
            popContext();
        }

        if (protectedDOM) {
            insertAfterAnchor(startAnchor, protectedDOM);
            triggerMount(activeProtectedCtx);
        }
    };

    mountProtected();

    if (ctx) {
        ctx.addDestroyHook(() => {
            tryBoundary.isDestroyed = true;
            clearActiveState();
        });
    }

    return fragment;
}

/**
 * Declarative <Wait> Component (Single Promise Unwrapping)
 */
export function Wait(props) {
    const ctx = getCurrentContext();
    const { renderResult, pendingBranch, catchBranch } = parseAwaitChildren(props);

    const startAnchor = document.createComment("primal:wait:start");
    const endAnchor = document.createComment("primal:wait:end");

    const fragment = document.createDocumentFragment();
    fragment.appendChild(startAnchor);
    fragment.appendChild(endAnchor);

    let activeSubtreeCtx = null;
    let operationId = 0;
    let activeController = null;

    const clearActiveSubtree = () => {
        if (activeSubtreeCtx) {
            destroyContext(activeSubtreeCtx);
            activeSubtreeCtx = null;
        }
        clearAnchorRange(startAnchor, endAnchor);
    };

    const mountPending = () => {
        if (!pendingBranch || pendingBranch.length === 0) return;
        clearActiveSubtree();

        activeSubtreeCtx = new ComponentContext("AwaitPending");
        activeSubtreeCtx.templateValues = props.__templateValues || [];
        activeSubtreeCtx.capitalTags = props.__capitalTags || new Set();
        if (ctx && ctx.tryBoundary) activeSubtreeCtx.tryBoundary = ctx.tryBoundary;

        if (ctx && !ctx.children.includes(activeSubtreeCtx)) {
            ctx.children.push(activeSubtreeCtx);
        }

        pushContext(activeSubtreeCtx);
        let pendingDOM;
        try {
            const nodes = pendingBranch.map(c => {
                const cloned = c instanceof Node ? c.cloneNode(true) : c;
                return convertToDOMNode(cloned, activeSubtreeCtx);
            });
            pendingDOM = document.createDocumentFragment();
            for (const node of nodes) {
                if (node) pendingDOM.appendChild(node);
            }
        } finally {
            popContext();
        }

        if (pendingDOM) {
            insertAfterAnchor(startAnchor, pendingDOM);
            triggerMount(activeSubtreeCtx);
        }
    };

    const mountResolved = (resolvedValue, currentOp) => {
        if (currentOp !== operationId) return;
        clearActiveSubtree();

        activeSubtreeCtx = new ComponentContext("AwaitResolved");
        activeSubtreeCtx.templateValues = props.__templateValues || [];
        activeSubtreeCtx.capitalTags = props.__capitalTags || new Set();
        if (ctx && ctx.tryBoundary) activeSubtreeCtx.tryBoundary = ctx.tryBoundary;

        if (ctx && !ctx.children.includes(activeSubtreeCtx)) {
            ctx.children.push(activeSubtreeCtx);
        }

        pushContext(activeSubtreeCtx);
        let resolvedDOM;
        try {
            if (typeof renderResult === "function") {
                const resultVal = renderResult(resolvedValue);
                const nodes = Array.isArray(resultVal) ? resultVal : [resultVal];
                resolvedDOM = document.createDocumentFragment();
                for (const c of nodes) {
                    const domNode = convertToDOMNode(c, activeSubtreeCtx);
                    if (domNode) resolvedDOM.appendChild(domNode);
                }
            } else if (renderResult !== null && renderResult !== undefined) {
                const cloned = renderResult instanceof Node ? renderResult.cloneNode(true) : renderResult;
                resolvedDOM = convertToDOMNode(cloned, activeSubtreeCtx);
            }
        } catch (err) {
            const tryBoundary = activeSubtreeCtx.tryBoundary || (ctx ? ctx.tryBoundary : null);
            if (tryBoundary && typeof tryBoundary.handleError === "function") {
                tryBoundary.handleError(err);
            } else {
                throw err;
            }
            return;
        } finally {
            popContext();
        }

        if (resolvedDOM) {
            insertAfterAnchor(startAnchor, resolvedDOM);
            triggerMount(activeSubtreeCtx);
        }
    };

    const mountRejected = (rejectionReason, currentOp) => {
        if (currentOp !== operationId) return;
        clearActiveSubtree();

        activeSubtreeCtx = new ComponentContext("AwaitCatch");
        activeSubtreeCtx.templateValues = props.__templateValues || [];
        activeSubtreeCtx.capitalTags = props.__capitalTags || new Set();
        if (ctx && ctx.tryBoundary) activeSubtreeCtx.tryBoundary = ctx.tryBoundary;

        if (ctx && !ctx.children.includes(activeSubtreeCtx)) {
            ctx.children.push(activeSubtreeCtx);
        }

        const retryFn = () => {
            executePromiseFactory();
        };

        pushContext(activeSubtreeCtx);
        let catchDOM;
        try {
            if (catchBranch && typeof catchBranch.fn === "function") {
                const res = catchBranch.fn(rejectionReason, retryFn);
                const nodes = Array.isArray(res) ? res : [res];
                catchDOM = document.createDocumentFragment();
                for (const c of nodes) {
                    const domNode = convertToDOMNode(c, activeSubtreeCtx);
                    if (domNode) catchDOM.appendChild(domNode);
                }
            } else if (catchBranch && catchBranch.content) {
                const nodes = catchBranch.content.map(c => {
                    const cloned = c instanceof Node ? c.cloneNode(true) : c;
                    return convertToDOMNode(cloned, activeSubtreeCtx);
                });
                catchDOM = document.createDocumentFragment();
                for (const node of nodes) {
                    if (node) catchDOM.appendChild(node);
                }
            }
        } finally {
            popContext();
        }

        if (catchDOM) {
            insertAfterAnchor(startAnchor, catchDOM);
            triggerMount(activeSubtreeCtx);
        }
    };

    const executePromiseFactory = () => {
        operationId++;
        const currentOp = operationId;
        if (activeController) {
            try { activeController.abort(); } catch (_) {}
            activeController = null;
        }
        activeController = typeof AbortController !== "undefined" ? new AbortController() : null;

        const targetProp = (props && props.for !== undefined) ? props.for : (props ? props.promise : undefined);
        let promiseVal;
        if (typeof targetProp === "function") {
            promiseVal = targetProp({ signal: activeController ? activeController.signal : undefined });
        } else if (isSignal(targetProp)) {
            promiseVal = targetProp.value;
        } else {
            promiseVal = targetProp;
        }

        if (promiseVal && typeof promiseVal.then === "function") {
            mountPending();
            promiseVal.then(
                resolvedVal => mountResolved(resolvedVal, currentOp),
                rejectedErr => mountRejected(rejectedErr, currentOp)
            );
        } else {
            mountResolved(promiseVal, currentOp);
        }
    };

    const targetProp = (props && props.for !== undefined) ? props.for : (props ? props.promise : undefined);
    if (isSignal(targetProp) || typeof targetProp === "function") {
        const disposer = effect(() => {
            executePromiseFactory();
        });
        if (ctx) ctx.addEffect(disposer);
    } else {
        executePromiseFactory();
    }

    if (ctx) {
        ctx.addDestroyHook(() => {
            operationId++;
            if (activeController) {
                activeController.abort();
                activeController = null;
            }
            clearActiveSubtree();
        });
    }

    return fragment;
}

/**
 * Declarative <Delay> Component (Reactive Async Tasks & Component Loading)
 */
export function Delay(props) {
    const ctx = getCurrentContext();
    const { renderResult, nonStructuralChildren, pendingBranch, catchBranch } = parseAsyncChildren(props);

    const startAnchor = document.createComment("primal:delay:start");
    const endAnchor = document.createComment("primal:delay:end");

    const fragment = document.createDocumentFragment();
    fragment.appendChild(startAnchor);
    fragment.appendChild(endAnchor);

    let activeSubtreeCtx = null;
    let operationId = 0;
    let activeController = null;

    const clearActiveSubtree = () => {
        if (activeSubtreeCtx) {
            destroyContext(activeSubtreeCtx);
            activeSubtreeCtx = null;
        }
        clearAnchorRange(startAnchor, endAnchor);
    };

    const mountPending = () => {
        if (!pendingBranch || pendingBranch.length === 0) return;
        clearActiveSubtree();

        activeSubtreeCtx = new ComponentContext("AsyncPending");
        activeSubtreeCtx.templateValues = props.__templateValues || [];
        activeSubtreeCtx.capitalTags = props.__capitalTags || new Set();
        if (ctx && ctx.tryBoundary) activeSubtreeCtx.tryBoundary = ctx.tryBoundary;

        if (ctx && !ctx.children.includes(activeSubtreeCtx)) {
            ctx.children.push(activeSubtreeCtx);
        }

        pushContext(activeSubtreeCtx);
        let pendingDOM;
        try {
            const nodes = pendingBranch.map(c => {
                const cloned = c instanceof Node ? c.cloneNode(true) : c;
                return convertToDOMNode(cloned, activeSubtreeCtx);
            });
            pendingDOM = document.createDocumentFragment();
            for (const node of nodes) {
                if (node) pendingDOM.appendChild(node);
            }
        } finally {
            popContext();
        }

        if (pendingDOM) {
            insertAfterAnchor(startAnchor, pendingDOM);
            triggerMount(activeSubtreeCtx);
        }
    };

    const mountComponent = (ComponentExport, currentOp) => {
        if (currentOp !== operationId) return;
        clearActiveSubtree();

        activeSubtreeCtx = new ComponentContext("AsyncComponent");
        activeSubtreeCtx.templateValues = props.__templateValues || [];
        activeSubtreeCtx.capitalTags = props.__capitalTags || new Set();
        if (ctx && ctx.tryBoundary) activeSubtreeCtx.tryBoundary = ctx.tryBoundary;

        if (ctx && !ctx.children.includes(activeSubtreeCtx)) {
            ctx.children.push(activeSubtreeCtx);
        }

        pushContext(activeSubtreeCtx);
        let compDOM;
        try {
            if (typeof renderResult === "function") {
                const res = renderResult(ComponentExport);
                const nodes = Array.isArray(res) ? res : [res];
                compDOM = document.createDocumentFragment();
                for (const c of nodes) {
                    const domNode = convertToDOMNode(c, activeSubtreeCtx);
                    if (domNode) compDOM.appendChild(domNode);
                }
            } else if (typeof ComponentExport === "function" || (ComponentExport && (ComponentExport.default || typeof ComponentExport === "object"))) {
                const CompFn = typeof ComponentExport === "function"
                    ? ComponentExport
                    : (ComponentExport && ComponentExport.default
                        ? ComponentExport.default
                        : (ComponentExport && typeof ComponentExport === "object"
                            ? Object.values(ComponentExport).find(v => typeof v === "function")
                            : null));
                if (CompFn) {
                    const passProps = { ...props };
                    delete passProps.component;
                    delete passProps.task;
                    delete passProps.children;
                    if (nonStructuralChildren.length > 0) {
                        passProps.children = nonStructuralChildren.length === 1
                            ? nonStructuralChildren[0]
                            : nonStructuralChildren;
                    }
                    const res = CompFn(passProps);
                    compDOM = convertToDOMNode(res, activeSubtreeCtx);
                } else {
                    compDOM = convertToDOMNode(ComponentExport, activeSubtreeCtx);
                }
            } else {
                compDOM = convertToDOMNode(ComponentExport, activeSubtreeCtx);
            }
        } catch (err) {
            const tryBoundary = activeSubtreeCtx.tryBoundary || (ctx ? ctx.tryBoundary : null);
            if (tryBoundary && typeof tryBoundary.handleError === "function") {
                tryBoundary.handleError(err);
            } else {
                throw err;
            }
            return;
        } finally {
            popContext();
        }

        if (compDOM) {
            insertAfterAnchor(startAnchor, compDOM);
            triggerMount(activeSubtreeCtx);
        }
    };

    const mountRejected = (rejectionReason, currentOp) => {
        if (currentOp !== operationId) return;
        clearActiveSubtree();

        activeSubtreeCtx = new ComponentContext("AsyncCatch");
        activeSubtreeCtx.templateValues = props.__templateValues || [];
        activeSubtreeCtx.capitalTags = props.__capitalTags || new Set();
        if (ctx && ctx.tryBoundary) activeSubtreeCtx.tryBoundary = ctx.tryBoundary;

        if (ctx && !ctx.children.includes(activeSubtreeCtx)) {
            ctx.children.push(activeSubtreeCtx);
        }

        const retryFn = () => {
            loadAsyncComponent();
        };

        pushContext(activeSubtreeCtx);
        let catchDOM;
        try {
            if (catchBranch && typeof catchBranch.fn === "function") {
                const res = catchBranch.fn(rejectionReason, retryFn);
                const nodes = Array.isArray(res) ? res : [res];
                catchDOM = document.createDocumentFragment();
                for (const c of nodes) {
                    const domNode = convertToDOMNode(c, activeSubtreeCtx);
                    if (domNode) catchDOM.appendChild(domNode);
                }
            } else if (catchBranch && catchBranch.content) {
                const nodes = catchBranch.content.map(c => {
                    const cloned = c instanceof Node ? c.cloneNode(true) : c;
                    return convertToDOMNode(cloned, activeSubtreeCtx);
                });
                catchDOM = document.createDocumentFragment();
                for (const node of nodes) {
                    if (node) catchDOM.appendChild(node);
                }
            }
        } finally {
            popContext();
        }

        if (catchDOM) {
            insertAfterAnchor(startAnchor, catchDOM);
            triggerMount(activeSubtreeCtx);
        }
    };

    const loadAsyncComponent = () => {
        operationId++;
        const currentOp = operationId;
        if (activeController) {
            try { activeController.abort(); } catch (_) {}
            activeController = null;
        }
        activeController = typeof AbortController !== "undefined" ? new AbortController() : null;

        const targetProp = (props && props.task !== undefined) ? props.task : (props ? props.component : undefined);
        let compTarget;
        if (typeof targetProp === "function") {
            compTarget = targetProp({ signal: activeController ? activeController.signal : undefined });
        } else if (isSignal(targetProp)) {
            compTarget = targetProp.value;
        } else {
            compTarget = targetProp;
        }

        if (compTarget && typeof compTarget.then === "function") {
            mountPending();
            compTarget.then(
                mod => mountComponent(mod, currentOp),
                err => mountRejected(err, currentOp)
            );
        } else if (typeof compTarget === "function" && compTarget.prototype === undefined) {
            mountPending();
            try {
                const promise = compTarget({ signal: activeController ? activeController.signal : undefined });
                if (promise && typeof promise.then === "function") {
                    promise.then(
                        mod => mountComponent(mod, currentOp),
                        err => mountRejected(err, currentOp)
                    );
                } else {
                    mountComponent(promise, currentOp);
                }
            } catch (err) {
                mountRejected(err, currentOp);
            }
        } else {
            mountComponent(compTarget, currentOp);
        }
    };

    const targetProp = (props && props.task !== undefined) ? props.task : (props ? props.component : undefined);
    if (isSignal(targetProp) || typeof targetProp === "function") {
        const disposer = effect(() => {
            loadAsyncComponent();
        });
        if (ctx) ctx.addEffect(disposer);
    } else {
        loadAsyncComponent();
    }

    if (ctx) {
        ctx.addDestroyHook(() => {
            operationId++;
            if (activeController) {
                try { activeController.abort(); } catch (_) {}
                activeController = null;
            }
            clearActiveSubtree();
        });
    }

    return fragment;
}

// Backward-compatibility aliases
export function Async(props) {
    return Delay(props);
}

export function Await(props) {
    return Wait(props);
}

