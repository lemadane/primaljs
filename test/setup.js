import { JSDOM } from "jsdom";
import { beforeEach } from "node:test";

const dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"app\"></div></body></html>", {
    url: "http://localhost/"
});

dom.window.scrollTo = () => {};

globalThis.window = dom.window;
globalThis.document = dom.window.document;

Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
    writable: true
});

globalThis.Node = dom.window.Node;
globalThis.NodeFilter = dom.window.NodeFilter;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Comment = dom.window.Comment;
globalThis.Text = dom.window.Text;
globalThis.DocumentFragment = dom.window.DocumentFragment;
globalThis.customElements = dom.window.customElements;
globalThis.Event = dom.window.Event;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.AbortController = globalThis.AbortController || dom.window.AbortController;
globalThis.AbortSignal = globalThis.AbortSignal || dom.window.AbortSignal;

beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    if (globalThis.window && globalThis.window.history) {
        try {
            globalThis.window.history.replaceState({}, "", "http://localhost/");
        } catch (_) {}
    }
});
