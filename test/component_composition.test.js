import "./setup.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { html, signal, computed, register, clearRegistry, mount, unmount } from "../primal.js";

describe("PrimalJS Component Composition & Inter-Component Usage", () => {
    beforeEach(() => {
        clearRegistry();
    });

    it("renders subcomponents nested inside parent components using custom tags", () => {
        function Badge(props) {
            return html`<span class="badge-${props.type}">${props.children}</span>`;
        }

        function UserTile(props) {
            return html`
                <div class="tile">
                    <h3>${props.name}</h3>
                    <Badge type=${props.role}>${props.role}</Badge>
                </div>
            `;
        }

        register(Badge, UserTile);

        function App() {
            return html`
                <main>
                    <UserTile name="Lemuel" role="admin" />
                </main>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(appEl.querySelector("h3").textContent.trim(), "Lemuel");
        assert.equal(appEl.querySelector(".badge-admin").textContent.trim(), "admin");

        unmount(appEl);
    });

    it("passes event callback functions and props from parent to child component", () => {
        let clicked = false;

        function CustomButton(props) {
            return html`
                <button class="custom-btn" onclick=${props.onCustomClick}>
                    ${props.label}
                </button>
            `;
        }

        function ParentContainer() {
            return html`
                <div>
                    <CustomButton
                        label="Action"
                        onCustomClick=${() => { clicked = true; }}
                    />
                </div>
            `;
        }

        register(CustomButton, ParentContainer);

        const appEl = document.getElementById("app");
        mount(ParentContainer, appEl);

        const btn = appEl.querySelector(".custom-btn");
        assert.equal(btn.textContent.trim(), "Action");
        assert.equal(clicked, false);

        btn.click();
        assert.equal(clicked, true);

        unmount(appEl);
    });

    it("passes reactive signals as props into child components", () => {
        const countSignal = signal(5);

        function DisplayBadge(props) {
            return html`<span class="count-val">Count: ${props.value}</span>`;
        }

        register(DisplayBadge);

        function Parent() {
            return html`
                <div>
                    <DisplayBadge value=${countSignal} />
                </div>
            `;
        }

        const appEl = document.getElementById("app");
        mount(Parent, appEl);

        assert.equal(appEl.querySelector(".count-val").textContent.trim(), "Count: 5");

        countSignal.value = 10;
        assert.equal(appEl.querySelector(".count-val").textContent.trim(), "Count: 10");

        unmount(appEl);
    });

    it("supports slotted children (props.children) in wrapper components", () => {
        function CardWrapper(props) {
            return html`
                <div class="wrapper">
                    <h2>${props.title}</h2>
                    <div class="body">${props.children}</div>
                </div>
            `;
        }

        function InnerContent() {
            return html`<p class="inner-p">Slotted Content</p>`;
        }

        register(CardWrapper, InnerContent);

        function App() {
            return html`
                <CardWrapper title="Card Header">
                    <InnerContent />
                </CardWrapper>
            `;
        }

        const appEl = document.getElementById("app");
        mount(App, appEl);

        assert.equal(appEl.querySelector("h2").textContent.trim(), "Card Header");
        assert.equal(appEl.querySelector(".inner-p").textContent.trim(), "Slotted Content");

        unmount(appEl);
    });
});
