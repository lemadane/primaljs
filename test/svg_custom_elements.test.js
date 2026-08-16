import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "./setup.js";
import { signal } from "../src/signal.js";
import { html } from "../src/html.js";
import { mount } from "../src/mount.js";

// Define a test Custom Element
class UserBadge extends HTMLElement {
    constructor() {
        super();
        this._userData = null;
    }
    set userData(val) {
        this._userData = val;
    }
    get userData() {
        return this._userData;
    }
}
if (!customElements.get("user-badge")) {
    customElements.define("user-badge", UserBadge);
}

describe("PrimalJS SVG & Web Components Compatibility", () => {
    it("renders SVG elements in http://www.w3.org/2000/svg namespace and preserves viewBox case", () => {
        const radius = signal(10);
        let circleRef = null;

        function App() {
            return html`
                <svg viewBox="0 0 100 100" width="100" height="100">
                    <circle id="my-circle" cx="50" cy="50" r=${radius} />
                </svg>
            `;
        }

        const appEl = document.getElementById("app");
        const app = mount(App, appEl);

        const svgEl = document.querySelector("svg");
        const circleEl = document.querySelector("#my-circle");

        assert.equal(svgEl.namespaceURI, "http://www.w3.org/2000/svg");
        assert.equal(circleEl.namespaceURI, "http://www.w3.org/2000/svg");
        assert.equal(svgEl.getAttribute("viewBox"), "0 0 100 100");
        assert.equal(circleEl.getAttribute("r"), "10");

        // Reactivity test: SVG element DOM identity preserved
        const circleBefore = circleEl;
        radius.value = 25;

        assert.equal(circleEl.getAttribute("r"), "25");
        assert.equal(circleBefore, document.querySelector("#my-circle"));

        app.dispose();
    });

    it("supports <foreignObject> HTML content namespace transition inside SVG", () => {
        function App() {
            return html`
                <svg viewBox="0 0 200 200">
                    <foreignObject width="100" height="100">
                        <div id="html-inside">HTML inside SVG</div>
                    </foreignObject>
                </svg>
            `;
        }

        const appEl = document.getElementById("app");
        const app = mount(App, appEl);

        const foreignObj = document.querySelector("foreignObject");
        const divEl = document.querySelector("#html-inside");

        assert.equal(foreignObj.namespaceURI, "http://www.w3.org/2000/svg");
        assert.equal(divEl.namespaceURI, "http://www.w3.org/1999/xhtml");
        assert.equal(divEl.textContent, "HTML inside SVG");

        app.dispose();
    });

    it("assigns non-primitive objects directly as properties on Custom Elements", () => {
        const userObj = signal({ id: 42, name: "Lemuel" });
        let eventDetail = null;

        function App() {
            return html`
                <user-badge
                    id="badge"
                    userData=${userObj}
                    ondatechange=${e => { eventDetail = e.detail; }}
                ></user-badge>
            `;
        }

        const appEl = document.getElementById("app");
        const app = mount(App, appEl);

        const badgeEl = document.querySelector("#badge");
        assert.ok(badgeEl);
        assert.deepEqual(badgeEl.userData, { id: 42, name: "Lemuel" });

        // Update userObj signal
        userObj.value = { id: 43, name: "Adane" };
        assert.deepEqual(badgeEl.userData, { id: 43, name: "Adane" });

        // Dispatch Custom Event
        badgeEl.dispatchEvent(new CustomEvent("datechange", { detail: { date: "2026-08-16" } }));
        assert.deepEqual(eventDetail, { date: "2026-08-16" });

        app.dispose();
    });
});
