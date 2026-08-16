import "./setup.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { html, signal, register, clearRegistry, mount, unmount } from "../primal.js";

describe("PrimalJS Component Composition & Props & Children", () => {
    beforeEach(() => {
        clearRegistry();
    });

    it("registers and renders function components with props and children", () => {
        function Greeting(props) {
            return html`
                <h2>Hello ${props.children}</h2>
            `;
        }

        register(Greeting);

        function App() {
            return html`
                <main>
                    <Greeting>${"Lemuel"}</Greeting>
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(appEl.querySelector("h2").textContent.trim(), "Hello Lemuel");
        unmount(appEl);
    });

    it("supports stateful counter component with onclick event handler", () => {
        let countSignal;

        function Counter() {
            countSignal = signal(0);
            function increment() {
                countSignal.value++;
            }

            return html`
                <button id="counter-btn" onclick=${increment}>
                    Count: ${countSignal}
                </button>
            `;
        }

        const appEl = document.getElementById("app");
        mount(Counter, appEl);

        const button = document.querySelector("#counter-btn");
        assert.equal(button.textContent.trim(), "Count: 0");

        // Simulate click
        button.click();
        assert.equal(button.textContent.trim(), "Count: 1");

        button.click();
        assert.equal(button.textContent.trim(), "Count: 2");

        unmount(appEl);
    });

    it("supports nested component tree layout composition", () => {
        function Header() {
            return html`<header>Header Content</header>`;
        }

        function Footer() {
            return html`<footer>Footer Content</footer>`;
        }

        function Layout(props) {
            return html`
                <div class="layout">
                    ${props.children}
                </div>
            `;
        }

        function Greeting(props) {
            return html`<h1>Hello ${props.name}</h1>`;
        }

        register(Header, Footer, Layout, Greeting);

        function App() {
            return html`
                <Layout>
                    <Header />
                    <Greeting name=${"Lemuel"} />
                    <Footer />
                </Layout>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.ok(appEl.querySelector("header"));
        assert.ok(appEl.querySelector("footer"));
        assert.equal(appEl.querySelector("h1").textContent.trim(), "Hello Lemuel");

        unmount(appEl);
    });
});
