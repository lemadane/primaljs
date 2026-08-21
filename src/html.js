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
    getCurrentContext,
    triggerMount,
    destroyContext
} from "./lifecycle.js";
import { reportGlobalError } from "./app.js";

const templateCache = new WeakMap();

/**
 * Represents an un-rendered tagged template HTML result.
 */
export class TemplateResult {
    /**
     * @param {TemplateStringsArray} strings
     * @param {any[]} values
     */
    constructor(strings, values) {
        /** @type {"TemplateResult"} */
        this.kind = "TemplateResult";
        /** @type {TemplateStringsArray} */
        this.strings = strings;
        /** @type {any[]} */
        this.values = values;
    }
}

/**
 * Tagged template function for constructing PrimalJS HTML template results.
 *
 * @param {TemplateStringsArray} strings
 * @param {...any} values
 * @returns {TemplateResult}
 */
export function html(strings, ...values) {
    return new TemplateResult(strings, values);
}

/**
 * Wraps raw HTML string to bypass automatic XSS escaping.
 * Use with caution for trusted HTML content only.
 *
 * @param {any} content
 * @returns {{ __isUnsafeHtml: true, content: string }}
 */
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
    let mutableStrings = Array.from(strings);

    for (let i = 0; i < mutableStrings.length; i++) {
        rawHtml += mutableStrings[i];
        if (i < mutableStrings.length - 1) {
            const matchAttr = rawHtml.match(/([a-zA-Z0-9_-]+)\s*=\s*(["']?)([^"'>]*)$/);
            if (matchAttr) {
                const attrName = matchAttr[1];
                const quote = matchAttr[2];
                const prefix = matchAttr[3] || "";
                let suffix = "";

                if (quote && mutableStrings[i + 1]) {
                    const suffixMatch = mutableStrings[i + 1].match(new RegExp(`^(.*?)${quote}`));
                    if (suffixMatch) {
                        suffix = suffixMatch[1];
                        mutableStrings[i + 1] = mutableStrings[i + 1].slice(suffix.length + quote.length);
                    }
                }

                const markerAttr = `primal-attr-${i}`;
                const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const replacePattern = new RegExp(`${escapeRegExp(attrName)}\\s*=\\s*${quote ? quote : ''}${escapeRegExp(prefix)}$`);
                rawHtml = rawHtml.replace(replacePattern, `${markerAttr}="${attrName}" `);

                bindingSpecs.push({
                    type: "attribute",
                    valueIndex: i,
                    attrName: attrName,
                    markerAttr: markerAttr,
                    prefix: prefix,
                    suffix: suffix
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
    templateEl.innerHTML = normalizedHtml.trim();

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
                        const spec = bindingSpecs.find(s => s.valueIndex === index);
                        instructions.push({
                            type: targetAttrName.toLowerCase().startsWith("on")
                                ? "event"
                                : "attribute",
                            attrName: targetAttrName,
                            valueIndex: index,
                            prefix: spec ? spec.prefix : "",
                            suffix: spec ? spec.suffix : "",
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
    for (let i = 0; i < path.length; i++) {
        const idx = path[i];
        if (!current || !current.childNodes) return null;
        let validChildren = Array.from(current.childNodes);
        if (i === 0 && current.nodeType === Node.ELEMENT_NODE) {
            validChildren = validChildren.filter(n => n.nodeName !== "SCRIPT" && !(n.nodeType === 3 && !n.nodeValue.trim()));
        } else if (i === 0) {
            validChildren = validChildren.filter(n => n.nodeName !== "SCRIPT");
        }
        current = validChildren[idx];
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
            bindAttribute(targetNode, spec.attrName, val, parentCtx, spec.prefix, spec.suffix);
        } else if (spec.type === "component") {
            instantiateComponentNode(targetNode, spec.componentFn, templateResult.values, parentCtx, cached.capitalTags);
        }
    }

    return fragment.childNodes.length === 1 ? fragment.firstChild : fragment;
}

function findCommentMarker(root, valueIndex) {
    if (!root || typeof document === "undefined") return null;
    const markerTarget = `primal-ph-${valueIndex}`;
    const bindTarget = `primal-bind:${valueIndex}`;
    const filter = typeof NodeFilter !== "undefined" ? NodeFilter.SHOW_COMMENT : 128;
    const iterator = document.createNodeIterator(root, filter, null);
    let currentNode;
    while ((currentNode = iterator.nextNode())) {
        const text = currentNode.nodeValue ? currentNode.nodeValue.trim() : "";
        if (text === markerTarget || text === bindTarget) {
            return currentNode;
        }
    }
    return null;
}

export function activateTemplate(existingDOMNode, templateResult, ctx = getCurrentContext()) {
    if (!existingDOMNode || !templateResult || !(templateResult instanceof TemplateResult)) {
        return;
    }

    let cached = templateCache.get(templateResult.strings);
    if (!cached) {
        cached = compileTemplate(templateResult.strings);
        templateCache.set(templateResult.strings, cached);
    }

    const targetNodes = cached.instructions.map(spec => getNodeByPath(existingDOMNode, spec.path));

    for (let i = 0; i < cached.instructions.length; i++) {
        const spec = cached.instructions[i];
        let targetNode = targetNodes[i];

        if (spec.type === "content") {
            const commentMarker = findCommentMarker(existingDOMNode, spec.valueIndex);
            if (commentMarker) {
                targetNode = commentMarker;
            } else if (!targetNode && spec.path.length > 0) {
                const parentEl = getNodeByPath(existingDOMNode, spec.path.slice(0, -1));
                if (parentEl && parentEl.nodeType === Node.ELEMENT_NODE) {
                    const textNodes = Array.from(parentEl.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
                    if (textNodes.length > 0) {
                        targetNode = textNodes[textNodes.length - 1];
                    }
                }
            }
        }

        if (targetNode && (spec.type === "event" || spec.type === "attribute")) {
            if (targetNode.nodeType === Node.TEXT_NODE) {
                targetNode = targetNode.parentElement;
            }
        }
        if (!targetNode) continue;

        const val = templateResult.values[spec.valueIndex];

        if (spec.type === "content") {
            bindContent(targetNode, val, ctx);
        } else if (spec.type === "event" || (spec.type === "attribute" && spec.attrName.toLowerCase().startsWith("on"))) {
            bindEvent(targetNode, spec.attrName, val, ctx);
        } else if (spec.type === "attribute") {
            bindAttribute(targetNode, spec.attrName, val, ctx, spec.prefix, spec.suffix);
        } else if (spec.type === "component") {
            instantiateComponentNode(targetNode, spec.componentFn, templateResult.values, ctx, cached.capitalTags);
        }
    }
}

function bindContent(targetNode, value, ctx) {
    const parent = targetNode.parentNode;
    if (!parent) return;


    if (targetNode.nodeType === Node.TEXT_NODE && isSignal(value)) {
        const fullText = targetNode.nodeValue || "";
        const match = fullText.match(/^(.*?)(?::\s*|\s+)?(-?\d+(?:\.\d+)?|[a-zA-Z0-9_-]+)?$/);
        const prefix = match && match[1] ? match[1] : fullText.replace(/\d+$/, "").trim();
        const separator = fullText.includes(":") ? ": " : " ";

        const disposer = effect(() => {
            targetNode.nodeValue = prefix ? `${prefix}${separator}${value.value}` : String(value.value ?? "");
        });
        if (ctx) ctx.addEffect(disposer);
        return;
    }

    const replacementNode = createValueNode(value, ctx);
    parent.replaceChild(replacementNode, targetNode);
}

function getKey(item, idx) {
    if (item === null || item === undefined) return idx;
    if (item instanceof TemplateResult) {
        for (let i = 0; i < item.strings.length; i++) {
            if (/key\s*=\s*['"]?$/i.test(item.strings[i]) && i < item.values.length) {
                return item.values[i];
            }
        }
    }
    if (typeof item === "object") {
        if ("key" in item) return item.key;
        if ("id" in item) return item.id;
    }
    return item;
}

function reconcileList(startAnchor, endAnchor, newItems, oldItemMap, parentCtx) {
    const parent = startAnchor.parentNode;
    if (!parent) return;

    const newItemMap = new Map();
    const nextItemNodes = [];

    for (let i = 0; i < newItems.length; i++) {
        const itemVal = newItems[i];
        const key = getKey(itemVal, i);
        let record = oldItemMap.get(key);

        if (record) {
            oldItemMap.delete(key);
            if (itemVal instanceof TemplateResult && record.domNode) {
                activateTemplate(record.domNode, itemVal, record.itemCtx);
            }
        } else {
            const itemCtx = new ComponentContext("ListItem");
            if (parentCtx) {
                itemCtx.parent = parentCtx;
                if (!parentCtx.children.includes(itemCtx)) {
                    parentCtx.children.push(itemCtx);
                }
                itemCtx.templateValues = parentCtx.templateValues;
                itemCtx.capitalTags = parentCtx.capitalTags;
            }

            pushContext(itemCtx);
            let domNode;
            try {
                domNode = convertToDOMNode(itemVal, itemCtx);
                if (domNode && domNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE && domNode.childNodes.length > 0) {
                    const validNodes = Array.from(domNode.childNodes).filter(n => n.nodeType !== Node.TEXT_NODE || n.nodeValue.trim().length > 0);
                    domNode = validNodes.length === 1 ? validNodes[0] : (validNodes.length > 0 ? validNodes : domNode);
                }
                triggerMount(itemCtx);
            } finally {
                popContext();
            }

            record = { key, domNode, itemCtx };
        }

        newItemMap.set(key, record);
        nextItemNodes.push(record.domNode);
    }

    for (const record of oldItemMap.values()) {
        if (record.itemCtx) {
            if (parentCtx && parentCtx.children) {
                const idx = parentCtx.children.indexOf(record.itemCtx);
                if (idx !== -1) parentCtx.children.splice(idx, 1);
            }
            destroyContext(record.itemCtx);
        }
        if (record.domNode) {
            const nodes = Array.isArray(record.domNode) ? record.domNode : [record.domNode];
            for (const n of nodes) {
                if (n && n.parentNode === parent) {
                    parent.removeChild(n);
                }
            }
        }
    }

    oldItemMap.clear();
    for (const [k, v] of newItemMap.entries()) {
        oldItemMap.set(k, v);
    }

    let currentMarker = startAnchor;
    for (const itemNode of nextItemNodes) {
        if (!itemNode) continue;
        const nodes = Array.isArray(itemNode) ? itemNode : [itemNode];
        for (const n of nodes) {
            if (n) {
                if (currentMarker.nextSibling !== n) {
                    parent.insertBefore(n, currentMarker.nextSibling);
                }
                currentMarker = n;
            }
        }
    }
}

function createValueNode(value, ctx) {
    if (isSignal(value)) {
        const textNode = document.createTextNode(value.value ?? "");
        const disposer = effect(() => {
            textNode.nodeValue = value.value ?? "";
        });
        if (ctx) ctx.addEffect(disposer);
        return textNode;
    }
    if (typeof value === "function") {
        const startAnchor = document.createComment("primal:fn:start");
        const endAnchor = document.createComment("primal:fn:end");
        const frag = document.createDocumentFragment();
        frag.appendChild(startAnchor);
        frag.appendChild(endAnchor);

        let activeCtx = null;
        let oldItemMap = new Map();

        const cleanupActiveCtx = () => {
            if (activeCtx) {
                if (ctx && ctx.children) {
                    const idx = ctx.children.indexOf(activeCtx);
                    if (idx !== -1) ctx.children.splice(idx, 1);
                }
                destroyContext(activeCtx);
                activeCtx = null;
            }
            for (const record of oldItemMap.values()) {
                if (record.itemCtx) {
                    if (ctx && ctx.children) {
                        const idx = ctx.children.indexOf(record.itemCtx);
                        if (idx !== -1) ctx.children.splice(idx, 1);
                    }
                    destroyContext(record.itemCtx);
                }
            }
            oldItemMap.clear();
        };

        const disposer = effect(() => {
            const res = value();
            if (res === null || res === undefined) {
                cleanupActiveCtx();
                clearAnchorRange(startAnchor, endAnchor);
                return;
            }

            if (Array.isArray(res)) {
                if (activeCtx) {
                    if (ctx && ctx.children) {
                        const idx = ctx.children.indexOf(activeCtx);
                        if (idx !== -1) ctx.children.splice(idx, 1);
                    }
                    destroyContext(activeCtx);
                    activeCtx = null;
                }
                reconcileList(startAnchor, endAnchor, res, oldItemMap, ctx);
                return;
            }

            cleanupActiveCtx();
            clearAnchorRange(startAnchor, endAnchor);

            activeCtx = new ComponentContext("DynamicFn");
            if (ctx) {
                activeCtx.parent = ctx;
                if (!ctx.children.includes(activeCtx)) {
                    ctx.children.push(activeCtx);
                }
                activeCtx.templateValues = ctx.templateValues;
                activeCtx.capitalTags = ctx.capitalTags;
            }

            pushContext(activeCtx);
            try {
                const domNode = convertToDOMNode(res, activeCtx);
                insertAfterAnchor(startAnchor, domNode);
                triggerMount(activeCtx);
            } finally {
                popContext();
            }
        });

        if (ctx) {
            ctx.addEffect(disposer);
            ctx.addEffect(cleanupActiveCtx);
        }
        return frag;
    }
    if (value instanceof TemplateResult) {
        return renderTemplate(value, ctx);
    }
    if (value instanceof Node) {
        if (value.nodeType === Node.ELEMENT_NODE) {
            const tValues = (ctx && ctx.templateValues) ? ctx.templateValues : [];
            const cTags = (ctx && ctx.capitalTags) ? ctx.capitalTags : new Set();
            const tagUpper = value.nodeName.toUpperCase();
            const cleanTagName = value.getAttribute("primal-comp") || value.nodeName.replace(/-COMPONENT$/i, "");
            if (getComponent(cleanTagName) || getComponent(tagUpper) || value.hasAttribute("primal-comp")) {
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

    const wrappedHandler = (event) => {
        try {
            handler(event);
        } catch (err) {
            reportGlobalError(err, { type: "event_handler", event: eventName, component: ctx ? ctx.name : null });
        }
    };

    targetElement.addEventListener(eventName, wrappedHandler);

    if (ctx) {
        ctx.addDestroyHook(() => {
            targetElement.removeEventListener(eventName, wrappedHandler);
        });
    }
}

function bindAttribute(targetElement, attrName, value, ctx, prefix = "", suffix = "") {
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

    const computeVal = (v) => {
        let raw = v;
        if (typeof v === "function") {
            raw = v();
        } else if (isSignal(v)) {
            raw = v.value;
        }
        if (raw === null || raw === undefined || raw === false) {
            if (!prefix && !suffix) return raw;
            raw = "";
        }
        return (prefix || suffix) ? `${prefix}${raw}${suffix}` : raw;
    };

    if (typeof value === "function" || isSignal(value)) {
        const disposer = effect(() => {
            setElementAttribute(targetElement, attrName, computeVal(value));
        });
        if (ctx) ctx.addEffect(disposer);
    } else {
        setElementAttribute(targetElement, attrName, computeVal(value));
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

const URL_ATTRS = ["href", "src", "action", "formaction", "data", "xlink:href"];

function sanitizeUrl(val) {
    if (typeof val !== "string") return val;
    const clean = val.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
    if (/^(?:javascript|vbscript|data:text\/html):/i.test(clean)) {
        console.warn(`[PrimalJS Security Warning]: Blocked dangerous URL protocol (${clean})`);
        return "about:blank";
    }
    return val;
}

function setElementAttribute(el, attr, val) {
    const attrLower = attr.toLowerCase();
    if (URL_ATTRS.includes(attrLower)) {
        val = sanitizeUrl(val);
    }

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
    if (placeholderEl._primalInstantiated) return;
    placeholderEl._primalInstantiated = true;

    const parent = placeholderEl.parentNode;
    const props = {};

    for (let i = 0; i < placeholderEl.attributes.length; i++) {
        const attr = placeholderEl.attributes[i];
        if (attr.name.startsWith("primal-attr-")) {
            const index = parseInt(attr.name.replace("primal-attr-", ""), 10);
            const targetPropName = attr.value;
            props[targetPropName] = templateValues[index];
        } else if (attr.name !== "primal-comp" && !(typeof attr.value === "string" && attr.value.startsWith("primal-attr-"))) {
            if (!(attr.name in props)) {
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

export function clearAnchorRange(startAnchor, endAnchor) {
    const parent = startAnchor.parentNode;
    if (!parent) return;

    let current = startAnchor.nextSibling;
    while (current && current !== endAnchor) {
        const next = current.nextSibling;
        parent.removeChild(current);
        current = next;
    }
}

export function insertAfterAnchor(startAnchor, domNode) {
    const parent = startAnchor.parentNode;
    if (!parent || !domNode) return;
    parent.insertBefore(domNode, startAnchor.nextSibling);
}

export function convertToDOMNode(val, ctx) {
    return createValueNode(val, ctx);
}
