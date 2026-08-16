/**
 * PrimalJS Native Tagged-Template Engine & Direct DOM Binding Parser
 */

import { isSignal, effect } from "./signal.js";
import { getComponent } from "./registry.js";
import { isRef } from "./ref.js";
import {
    ComponentContext,
    pushContext,
    popContext,
    getCurrentContext
} from "./lifecycle.js";

const templateCache = new WeakMap();

export class TemplateResult {
    constructor(strings, values) {
        this.kind = "TemplateResult";
        this.strings = strings;
        this.values = values;
    }
}

export function html(strings, ...values) {
    return new TemplateResult(strings, values);
}

export function unsafeHtml(content) {
    return { __isUnsafeHtml: true, content: String(content ?? "") };
}

/**
 * Pre-processes HTML string to convert self-closing custom components (<Greeting />)
 * into explicit opening and closing tags (<Greeting></Greeting>) for standard HTML parser compatibility.
 */
function normalizeSelfClosingTags(htmlStr) {
    return htmlStr.replace(/<([A-Z][a-zA-Z0-9_-]*)([^>]*?)\/>/g, "<$1$2></$1>");
}

/**
 * Extracts tag names that start with a capital letter (e.g. <Header>, <Greeting>) from raw template HTML.
 */
function findCapitalTagNames(htmlStr) {
    const set = new Set();
    const matches = htmlStr.matchAll(/<([A-Z][a-zA-Z0-9_-]*)/g);
    for (const match of matches) {
        const upper = match[1].toUpperCase();
        if (getComponent(upper)) {
            set.add(upper);
        }
    }
    return set;
}

/**
 * Compiles tagged template literal callsite into a cached DOM structure with node binding paths.
 */
function compileTemplate(strings) {
    let rawHtml = "";
    const bindingSpecs = [];

    for (let i = 0; i < strings.length; i++) {
        rawHtml += strings[i];
        if (i < strings.length - 1) {
            const matchAttr = rawHtml.match(/([a-zA-Z0-9_-]+)\s*=\s*['"]?$/);
            if (matchAttr) {
                const attrName = matchAttr[1];
                const markerAttr = `primal-attr-${i}`;
                rawHtml = rawHtml.replace(
                    new RegExp(`${attrName}\\s*=\\s*['"]?$`),
                    `${markerAttr}="${attrName}"`
                );
                bindingSpecs.push({
                    type: "attribute",
                    valueIndex: i,
                    attrName: attrName,
                    markerAttr: markerAttr
                });
            } else {
                const markerComment = `<!--primal-ph-${i}-->`;
                rawHtml += markerComment;
                bindingSpecs.push({
                    type: "content",
                    valueIndex: i,
                    markerComment: `primal-ph-${i}`
                });
            }
        }
    }

    const capitalTags = findCapitalTagNames(rawHtml);
    const normalizedHtml = normalizeSelfClosingTags(rawHtml);
    const templateEl = document.createElement("template");
    templateEl.innerHTML = normalizedHtml;

    const instructions = [];
    const walk = (node, path) => {
        if (!node) return;

        if (node.nodeType === Node.COMMENT_NODE) {
            const commentText = node.nodeValue ? node.nodeValue.trim() : "";
            if (commentText.startsWith("primal-ph-")) {
                const index = parseInt(commentText.replace("primal-ph-", ""), 10);
                instructions.push({
                    type: "content",
                    valueIndex: index,
                    path: [...path]
                });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const isCapitalComponent = capitalTags.has(node.nodeName.toUpperCase());
            const componentFn = isCapitalComponent ? getComponent(node.nodeName) : null;

            if (componentFn) {
                node.setAttribute("primal-comp", node.nodeName.toUpperCase());
                instructions.push({
                    type: "component",
                    componentFn: componentFn,
                    nodeName: node.nodeName,
                    path: [...path]
                });
            } else {
                const attrsToRemove = [];
                for (let j = 0; j < node.attributes.length; j++) {
                    const attr = node.attributes[j];
                    if (attr.name.startsWith("primal-attr-")) {
                        const index = parseInt(attr.name.replace("primal-attr-", ""), 10);
                        const targetAttrName = attr.value;
                        instructions.push({
                            type: targetAttrName.toLowerCase().startsWith("on")
                                ? "event"
                                : "attribute",
                            attrName: targetAttrName,
                            valueIndex: index,
                            path: [...path]
                        });
                        attrsToRemove.push(attr.name);
                    }
                }
                for (const attrName of attrsToRemove) {
                    node.removeAttribute(attrName);
                }

                let child = node.firstChild;
                let childIdx = 0;
                while (child) {
                    walk(child, [...path, childIdx]);
                    child = child.nextSibling;
                    childIdx++;
                }
            }
        }
    };

    let child = templateEl.content.firstChild;
    let childIdx = 0;
    while (child) {
        walk(child, [childIdx]);
        child = child.nextSibling;
        childIdx++;
    }

    return {
        fragment: templateEl.content.cloneNode(true),
        instructions: instructions,
        capitalTags: capitalTags
    };
}

function getNodeByPath(root, path) {
    let current = root;
    for (const idx of path) {
        if (!current || !current.childNodes) return null;
        current = current.childNodes[idx];
    }
    return current;
}

export function renderTemplate(templateResult, parentCtx = getCurrentContext()) {
    if (!templateResult || !(templateResult instanceof TemplateResult)) {
        return convertToDOMNode(templateResult, parentCtx);
    }

    let cached = templateCache.get(templateResult.strings);
    if (!cached) {
        cached = compileTemplate(templateResult.strings);
        templateCache.set(templateResult.strings, cached);
    }

    const fragment = cached.fragment.cloneNode(true);

    const targetNodes = cached.instructions.map(spec => getNodeByPath(fragment, spec.path));

    for (let i = 0; i < cached.instructions.length; i++) {
        const spec = cached.instructions[i];
        const targetNode = targetNodes[i];
        if (!targetNode || !targetNode.parentNode || !fragment.contains(targetNode)) continue;

        const val = templateResult.values[spec.valueIndex];

        if (spec.type === "content") {
            bindContent(targetNode, val, parentCtx);
        } else if (spec.type === "event") {
            bindEvent(targetNode, spec.attrName, val, parentCtx);
        } else if (spec.type === "attribute") {
            bindAttribute(targetNode, spec.attrName, val, parentCtx);
        } else if (spec.type === "component") {
            instantiateComponentNode(targetNode, spec.componentFn, templateResult.values, parentCtx, cached.capitalTags);
        }
    }

    return fragment.childNodes.length === 1 ? fragment.firstChild : fragment;
}

function bindContent(targetCommentNode, value, ctx) {
    const parent = targetCommentNode.parentNode;
    if (!parent) return;

    const replacementNode = createValueNode(value, ctx);
    parent.replaceChild(replacementNode, targetCommentNode);
}

function createValueNode(value, ctx) {
    if (value && (value.__isElse || value.__isElseIf || value.__isCase || value.__isDefault || value.__isContinue || value.__isBreak || value.__isCatch || value.__isPending)) {
        return value;
    }
    if (isSignal(value)) {
        const textNode = document.createTextNode(value.value ?? "");
        const disposer = effect(() => {
            textNode.nodeValue = value.value ?? "";
        });
        if (ctx) ctx.addEffect(disposer);
        return textNode;
    }
    if (typeof value === "function") {
        const textNode = document.createTextNode("");
        const disposer = effect(() => {
            const res = value();
            textNode.nodeValue = res ?? "";
        });
        if (ctx) ctx.addEffect(disposer);
        return textNode;
    }
    if (value instanceof TemplateResult) {
        return renderTemplate(value, ctx);
    }
    if (value instanceof Node) {
        if (value.nodeType === Node.ELEMENT_NODE) {
            const tValues = (ctx && ctx.templateValues) ? ctx.templateValues : [];
            const cTags = (ctx && ctx.capitalTags) ? ctx.capitalTags : new Set();
            const tagUpper = value.nodeName.toUpperCase();

            if (cTags.has(tagUpper) || value.hasAttribute("primal-comp")) {
                const cleanName = value.getAttribute("primal-comp") || value.nodeName.replace(/-COMPONENT$/i, "");
                const subComp = getComponent(cleanName);
                if (subComp) {
                    const placeholder = value.cloneNode(true);
                    placeholder.removeAttribute("primal-comp");
                    const dummy = document.createElement("div");
                    dummy.appendChild(placeholder);
                    instantiateComponentNode(placeholder, subComp, tValues, ctx, cTags);
                    const frag = document.createDocumentFragment();
                    while (dummy.firstChild) {
                        frag.appendChild(dummy.firstChild);
                    }
                    return frag;
                }
            }
            const subComps = Array.from(value.querySelectorAll("*")).filter(el => {
                const cleanName = el.getAttribute("primal-comp") || el.nodeName.replace(/-COMPONENT$/i, "");
                if (!getComponent(cleanName)) return false;
                let parent = el.parentElement;
                while (parent && parent !== value) {
                    const parentClean = parent.getAttribute("primal-comp") || parent.nodeName.replace(/-COMPONENT$/i, "");
                    if (getComponent(parentClean)) {
                        return false;
                    }
                    parent = parent.parentElement;
                }
                return true;
            });
            for (const el of subComps) {
                const compName = el.getAttribute("primal-comp") || el.nodeName.replace(/-COMPONENT$/i, "");
                const subComp = getComponent(compName);
                if (subComp) {
                    instantiateComponentNode(el, subComp, tValues, ctx, cTags);
                }
            }
        }
        return value;
    }
    if (Array.isArray(value)) {
        const frag = document.createDocumentFragment();
        for (const item of value) {
            frag.appendChild(createValueNode(item, ctx));
        }
        return frag;
    }
    if (value && value.__isUnsafeHtml) {
        const temp = document.createElement("div");
        temp.innerHTML = value.content;
        const frag = document.createDocumentFragment();
        while (temp.firstChild) {
            frag.appendChild(temp.firstChild);
        }
        return frag;
    }
    return document.createTextNode(value ?? "");
}

function bindEvent(targetElement, attrName, handler, ctx) {
    if (typeof handler !== "function") return;
    const eventName = attrName.startsWith("on") ? attrName.slice(2).toLowerCase() : attrName.toLowerCase();
    const tryBoundary = ctx ? ctx.tryBoundary : null;

    const wrappedHandler = (event) => {
        try {
            handler(event);
        } catch (err) {
            if (tryBoundary && typeof tryBoundary.handleError === "function" && !tryBoundary.isDestroyed) {
                tryBoundary.handleError(err);
            } else {
                console.error(`Error in event handler for ${eventName}:`, err);
            }
        }
    };

    targetElement.addEventListener(eventName, wrappedHandler);

    if (ctx) {
        ctx.addDestroyHook(() => {
            targetElement.removeEventListener(eventName, wrappedHandler);
        });
    }
}

function bindAttribute(targetElement, attrName, value, ctx) {
    if (attrName.startsWith("on") && (typeof value === "function" || isSignal(value))) {
        bindEvent(targetElement, attrName, value, ctx);
        return;
    }
    if (attrName === "ref") {
        if (isRef(value)) {
            value.current = targetElement;
            if (ctx) {
                ctx.addDestroyHook(() => {
                    if (value.current === targetElement) {
                        value.current = null;
                    }
                });
            }
        } else if (typeof value === "function") {
            value(targetElement);
            if (ctx) {
                ctx.addDestroyHook(() => {
                    value(null);
                });
            }
        }
        return;
    }

    if (attrName === "style" && typeof value === "object" && value !== null && !isSignal(value)) {
        bindStyleObject(targetElement, value, ctx);
        return;
    }

    if (isSignal(value)) {
        const disposer = effect(() => {
            setElementAttribute(targetElement, attrName, value.value);
        });
        if (ctx) ctx.addEffect(disposer);
    } else {
        setElementAttribute(targetElement, attrName, value);
    }
}

function bindStyleObject(el, styleObj, ctx) {
    for (const [prop, val] of Object.entries(styleObj)) {
        if (isSignal(val)) {
            const disposer = effect(() => {
                el.style[prop] = val.value ?? "";
            });
            if (ctx) ctx.addEffect(disposer);
        } else {
            el.style[prop] = val ?? "";
        }
    }
}

function setElementAttribute(el, attr, val) {
    const isSvg = el.namespaceURI === "http://www.w3.org/2000/svg";

    if (isSvg) {
        if (val === null || val === undefined || val === false) {
            el.removeAttribute(attr);
        } else {
            el.setAttribute(attr, String(val));
        }
        return;
    }

    const isCustomElement = el.tagName && el.tagName.includes("-");
    const isObjectVal = val !== null && typeof val === "object" && !Array.isArray(val);

    if (isCustomElement || isObjectVal || typeof val === "function") {
        if (attr in el || isObjectVal) {
            try {
                el[attr] = val;
                return;
            } catch (_) {}
        }
    }

    const isBoolAttr = ["disabled", "checked", "required", "readonly", "multiple", "selected", "hidden", "autofocus"].includes(attr.toLowerCase());

    if (attr in el && attr !== "list" && attr !== "type" && attr !== "form") {
        try {
            el[attr] = val ?? (isBoolAttr ? false : "");
        } catch (_) {}
    }

    if (val === null || val === undefined || val === false) {
        el.removeAttribute(attr);
    } else if (isBoolAttr || val === true) {
        el.setAttribute(attr, "");
    } else {
        el.setAttribute(attr, String(val));
    }
}

/**
 * Instantiates a component placeholder node (<Greeting ...>...</Greeting>)
 */
function instantiateComponentNode(placeholderEl, componentFn, templateValues, parentCtx, capitalTags = new Set()) {
    if (!placeholderEl || !placeholderEl.parentNode || !placeholderEl.attributes) return;

    const parent = placeholderEl.parentNode;
    const props = {};

    for (let i = 0; i < placeholderEl.attributes.length; i++) {
        const attr = placeholderEl.attributes[i];
        if (attr.name.startsWith("primal-attr-")) {
            const index = parseInt(attr.name.replace("primal-attr-", ""), 10);
            const targetPropName = attr.value;
            props[targetPropName] = templateValues[index];
        } else {
            if (attr.name !== "primal-comp") {
                props[attr.name] = attr.value;
            }
        }
    }

    const compCtx = new ComponentContext(componentFn.name || "Component");
    if (parentCtx) {
        compCtx.parent = parentCtx;
        if (!parentCtx.children.includes(compCtx)) {
            parentCtx.children.push(compCtx);
        }
    }
    compCtx.templateValues = templateValues;
    compCtx.capitalTags = capitalTags;
    if (parentCtx && parentCtx.tryBoundary) {
        compCtx.tryBoundary = parentCtx.tryBoundary;
    }

    pushContext(compCtx);
    let compResult;
    try {
        const childNodes = Array.from(placeholderEl.childNodes);
        const resolvedChildren = childNodes.map(child => {
            if (child && child.nodeType === Node.COMMENT_NODE) {
                const text = child.nodeValue ? child.nodeValue.trim() : "";
                if (text.startsWith("primal-ph-")) {
                    const idx = parseInt(text.replace("primal-ph-", ""), 10);
                    return templateValues[idx];
                }
            }
            return child.nodeType === Node.TEXT_NODE ? child.nodeValue : child;
        });

        if (resolvedChildren.length === 1) {
            props.children = resolvedChildren[0];
        } else if (resolvedChildren.length > 1) {
            props.children = resolvedChildren;
        }

        props.__capitalTags = capitalTags;
        props.__templateValues = templateValues;

        compResult = componentFn(props);
    } finally {
        popContext();
    }

    if (compResult && (compResult.__isElse || compResult.__isElseIf || compResult.__isCase || compResult.__isDefault || compResult.__isContinue || compResult.__isBreak || compResult.__isCatch || compResult.__isPending)) {
        if (parent) {
            const descriptorComment = document.createComment(`primal:${componentFn.name.toLowerCase()}`);
            descriptorComment._primalDescriptor = compResult;
            parent.replaceChild(descriptorComment, placeholderEl);
        }
        return;
    }

    const compDOM = convertToDOMNode(compResult, compCtx);
    parent.replaceChild(compDOM, placeholderEl);
}

/**
 * Resolves inner placeholders (comments, attributes) inside a component placeholder's subtree.
 */
export function resolveInnerSubtree(rootNode, templateValues, ctx, capitalTags = new Set()) {
    if (!rootNode || rootNode.nodeType !== Node.ELEMENT_NODE) return;

    const rootClean = rootNode.nodeName.replace(/-COMPONENT$/i, "").toUpperCase();
    if (capitalTags.has(rootClean) || getComponent(rootClean) || rootNode.hasAttribute("primal-comp")) {
        return;
    }

    const childrenToProcess = Array.from(rootNode.childNodes || []);
    for (const node of childrenToProcess) {
        if (!node.parentNode) continue;

        if (node.nodeType === Node.COMMENT_NODE) {
            const text = node.nodeValue ? node.nodeValue.trim() : "";
            if (text.startsWith("primal-ph-")) {
                const idx = parseInt(text.replace("primal-ph-", ""), 10);
                const val = templateValues[idx];
                bindContent(node, val, ctx);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const cleanName = node.nodeName.replace(/-COMPONENT$/i, "").toUpperCase();
            if (capitalTags.has(cleanName) || getComponent(cleanName) || node.hasAttribute("primal-comp")) {
                continue;
            }
            for (let i = node.attributes.length - 1; i >= 0; i--) {
                const attr = node.attributes[i];
                if (attr.name.startsWith("primal-attr-")) {
                    const idx = parseInt(attr.name.replace("primal-attr-", ""), 10);
                    const targetAttrName = attr.value;
                    const val = templateValues[idx];
                    if (targetAttrName.toLowerCase().startsWith("on")) {
                        bindEvent(node, targetAttrName, val, ctx);
                    } else {
                        bindAttribute(node, targetAttrName, val, ctx);
                    }
                    node.removeAttribute(attr.name);
                }
            }
            if (node.childNodes && node.childNodes.length > 0) {
                resolveInnerSubtree(node, templateValues, ctx, capitalTags);
            }
        }
    }
}

export function convertToDOMNode(val, ctx) {
    return createValueNode(val, ctx);
}
