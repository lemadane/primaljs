import "./setup.js";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    html,
    signal,
    mount,
    ref,
    clearRegistry,
    register,
    onKey,
    scrollLock,
    onOutsideClick,
    Focus,
    Place,
    Keep,
    Load
} from "../src/index.js";
import { _resetScrollLockStateForTest } from "../src/scroll-lock.js";

describe("PrimalJS Lifecycle-Aware DOM Helpers Suite: onKey, scrollLock, onOutsideClick", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        clearRegistry();
        if (_resetScrollLockStateForTest) {
            _resetScrollLockStateForTest();
        }
    });

    describe("1. onKey() Helper", () => {
        it("fires handler on matching key, ignores unrelated keys & passes native KeyboardEvent", () => {
            let escapeFired = 0;
            let receivedEvent = null;

            const stop = onKey("Escape", (e) => {
                escapeFired++;
                receivedEvent = e;
            });

            // Dispatch 'Enter' -> should NOT fire
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
            assert.equal(escapeFired, 0);

            // Dispatch 'Escape' -> SHOULD fire
            const escEvent = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
            document.dispatchEvent(escEvent);
            assert.equal(escapeFired, 1);
            assert.equal(receivedEvent, escEvent);

            // Manual unsubscribe
            stop();
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
            assert.equal(escapeFired, 1, "Unsubscribed listener must NOT fire");
        });

        it("supports keyup event option and scoped element target", () => {
            let keyupFired = 0;
            const targetEl = document.createElement("input");
            container.appendChild(targetEl);

            const stop = onKey(targetEl, "Enter", () => {
                keyupFired++;
            }, { event: "keyup" });

            targetEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
            assert.equal(keyupFired, 0);

            targetEl.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
            assert.equal(keyupFired, 1);

            stop();
        });

        it("supports ref target and modifier options (ctrl, shift, alt, meta)", async () => {
            const inputRef = ref();
            let ctrlKFired = 0;

            function SearchBox() {
                onKey(inputRef, "k", () => {
                    ctrlKFired++;
                }, { ctrl: true });

                return html`<input ref=${inputRef} id="search" type="text" />`;
            }
            register(SearchBox);

            mount(SearchBox, container);
            await new Promise(r => setTimeout(r, 10));

            const inputEl = container.querySelector("#search");
            assert.ok(inputEl);

            // Dispatch 'k' without ctrl -> should NOT fire
            inputEl.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: false, bubbles: true }));
            assert.equal(ctrlKFired, 0);

            // Dispatch 'k' with ctrl -> SHOULD fire
            inputEl.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
            assert.equal(ctrlKFired, 1);
        });

        it("supports ignoreEditable option", () => {
            let escFired = 0;
            const inputEl = document.createElement("input");
            container.appendChild(inputEl);

            const stop = onKey("Escape", () => {
                escFired++;
            }, { ignoreEditable: true });

            // Dispatch Escape from inputEl -> ignored
            inputEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
            assert.equal(escFired, 0);

            // Dispatch Escape from document.body -> fires
            document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
            assert.equal(escFired, 1);

            stop();
        });

        it("automatically unbinds on owner context disposal", () => {
            let escFired = 0;
            const open = signal(true);

            function Modal() {
                onKey("Escape", () => { escFired++; });
                return html`<div>Modal</div>`;
            }
            register(Modal);

            function App() {
                return html`
                    <div>
                        ${() => open.value ? html`<Modal />` : null}
                    </div>
                `;
            }

            mount(App, container);

            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
            assert.equal(escFired, 1);

            // Unmount Modal
            open.value = false;

            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
            assert.equal(escFired, 1, "Listener must be removed automatically on owner disposal");
        });
    });

    describe("2. scrollLock() Helper", () => {
        it("locks body overflow and restores previous inline styles on unlock", () => {
            document.body.style.overflow = "auto";
            document.body.style.paddingRight = "10px";

            const unlock = scrollLock();
            assert.equal(document.body.style.overflow, "hidden");

            unlock();
            assert.equal(document.body.style.overflow, "auto", "Must restore original overflow style");
            assert.equal(document.body.style.paddingRight, "10px", "Must restore original paddingRight style");
        });

        it("supports reference counting for concurrent locks and idempotent unlock", () => {
            document.body.style.overflow = "";

            const unlock1 = scrollLock();
            const unlock2 = scrollLock();
            assert.equal(document.body.style.overflow, "hidden");

            // First unlock -> body remains locked because lockCount is still 1
            unlock1();
            assert.equal(document.body.style.overflow, "hidden");

            // Idempotent call to unlock1 -> must NOT decrement count again
            unlock1();
            assert.equal(document.body.style.overflow, "hidden");

            // Second unlock -> restores page scrolling
            unlock2();
            assert.equal(document.body.style.overflow, "");
        });

        it("automatically unlocks on owner context disposal", () => {
            document.body.style.overflow = "";
            const open = signal(true);

            function Modal() {
                scrollLock();
                return html`<div>Modal</div>`;
            }
            register(Modal);

            function App() {
                return html`
                    <div>
                        ${() => open.value ? html`<Modal />` : null}
                    </div>
                `;
            }

            mount(App, container);
            assert.equal(document.body.style.overflow, "hidden");

            // Unmount Modal
            open.value = false;
            assert.equal(document.body.style.overflow, "", "Scroll lock must be released automatically on owner disposal");
        });
    });

    describe("3. onOutsideClick() Helper", () => {
        it("triggers handler on outside click and ignores inside clicks", () => {
            let outsideFired = 0;
            const cardEl = document.createElement("div");
            const innerBtn = document.createElement("button");
            const outsideBtn = document.createElement("button");

            cardEl.appendChild(innerBtn);
            container.appendChild(cardEl);
            container.appendChild(outsideBtn);

            const stop = onOutsideClick(cardEl, () => {
                outsideFired++;
            });

            // Click inside cardEl -> should NOT fire
            innerBtn.dispatchEvent(new Event("pointerdown", { bubbles: true }));
            assert.equal(outsideFired, 0);

            // Click outside cardEl -> SHOULD fire
            outsideBtn.dispatchEvent(new Event("pointerdown", { bubbles: true }));
            assert.equal(outsideFired, 1);

            stop();
        });

        it("supports multiple targets array [triggerRef, menuRef] across <Place> portal", () => {
            let outsideFired = 0;

            const modalRoot = document.createElement("div");
            modalRoot.id = "portal-menu-root";
            document.body.appendChild(modalRoot);

            const triggerRef = ref();
            const menuRef = ref();

            function Dropdown() {
                onOutsideClick([triggerRef, menuRef], () => {
                    outsideFired++;
                });

                return html`
                    <div>
                        <button ref=${triggerRef} id="trigger-btn">Trigger</button>
                        <Place to="#portal-menu-root">
                            <div ref=${menuRef} id="menu-card">
                                <button id="menu-item">Item 1</button>
                            </div>
                        </Place>
                    </div>
                `;
            }
            register(Dropdown);

            mount(Dropdown, container);

            const triggerBtn = container.querySelector("#trigger-btn");
            const menuItem = modalRoot.querySelector("#menu-item");
            const outsideBtn = document.createElement("button");
            document.body.appendChild(outsideBtn);

            // Click trigger button -> inside
            triggerBtn.dispatchEvent(new Event("pointerdown", { bubbles: true }));
            assert.equal(outsideFired, 0);

            // Click menu item inside portal -> inside
            menuItem.dispatchEvent(new Event("pointerdown", { bubbles: true }));
            assert.equal(outsideFired, 0);

            // Click outside button -> OUTSIDE!
            outsideBtn.dispatchEvent(new Event("pointerdown", { bubbles: true }));
            assert.equal(outsideFired, 1);

            modalRoot.remove();
            outsideBtn.remove();
        });

        it("automatically unbinds on owner context disposal", () => {
            let outsideFired = 0;
            const cardRef = ref();
            const open = signal(true);

            function Popover() {
                onOutsideClick(cardRef, () => { outsideFired++; });
                return html`<div ref=${cardRef} id="pop">Popover</div>`;
            }
            register(Popover);

            function App() {
                return html`
                    <div>
                        ${() => open.value ? html`<Popover />` : null}
                    </div>
                `;
            }

            mount(App, container);

            const outsideBtn = document.createElement("button");
            document.body.appendChild(outsideBtn);

            outsideBtn.dispatchEvent(new Event("pointerdown", { bubbles: true }));
            assert.equal(outsideFired, 1);

            // Unmount Popover
            open.value = false;

            outsideBtn.dispatchEvent(new Event("pointerdown", { bubbles: true }));
            assert.equal(outsideFired, 1, "onOutsideClick listener must be removed on owner disposal");

            outsideBtn.remove();
        });
    });

    describe("4. Combined Modal Composition Stress Test", () => {
        it("100-cycle open/close dialog composition with Focus, scrollLock, onKey, and onOutsideClick", async () => {
            const triggerBtn = document.createElement("button");
            triggerBtn.id = "open-dialog-btn";
            document.body.appendChild(triggerBtn);

            const modalRoot = document.createElement("div");
            modalRoot.id = "stress-modal-root";
            document.body.appendChild(modalRoot);

            function FullModal(props) {
                const dialogRef = ref();

                scrollLock();
                onKey("Escape", props.onClose);
                onOutsideClick([dialogRef], props.onClose);

                return html`
                    <Place to="#stress-modal-root">
                        <Focus>
                            <div ref=${dialogRef} id="stress-dialog" role="dialog">
                                <button id="modal-btn" onclick=${props.onClose}>Cancel</button>
                            </div>
                        </Focus>
                    </Place>
                `;
            }
            register(FullModal);

            const open = signal(false);

            function App() {
                return html`
                    <div>
                        ${() => open.value ? html`<FullModal onClose=${() => open.value = false} />` : null}
                    </div>
                `;
            }

            const app = mount(App, container);

            for (let i = 0; i < 100; i++) {
                triggerBtn.focus();
                open.value = true;
                await new Promise(r => setTimeout(r, 1));
                assert.equal(document.body.style.overflow, "hidden");

                open.value = false;
                await new Promise(r => setTimeout(r, 1));
                assert.equal(document.body.style.overflow, "");
            }

            app.dispose();
            triggerBtn.remove();
            modalRoot.remove();
        });
    });
});
