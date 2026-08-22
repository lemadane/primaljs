# PrimalJS

> **The Super Minimalists’ ReactJS — Pure JS, Function Components, Tagged Templates, Signals, Direct Real-DOM Updates, No Typescript, No Babel, No JSX, No Compiler, No Virtual DOM, No Re-Render.**

PrimalJS is a zero-dependency, lightweight Single Page Application (SPA) and component framework currently in beta (`v0.4.0-beta`). Built directly on modern browser APIs, PrimalJS brings web development back to its fundamentals — **JavaScript stays JavaScript**.

---

### **Credits & Attribution**
- **Authored & Designed by:** Lemuel Adane
- **Coded & Architecture by:** Google Antigravity
- **Product Tested & QA by:** ChatGPT

---

## Table of Contents

- [Core Principles](#core-principles)
- [Quick Start & Installation](#quick-start--installation)
  - [Option A: NPM Package](#option-a-npm-package)
  - [Option B: Zero-Build Standalone ES Module](#option-b-zero-build-standalone-es-module)
- [Mounting & DOM Hydration](#mounting--dom-hydration)
  - [`mount()` — Create & Mount New DOM](#mount--create--mount-new-dom)
  - [`hydrate()` — Activate & Adopt Existing Static DOM](#hydrate--activate--adopt-existing-static-dom)
  - [`unmount()` — Clean Application Teardown](#unmount--clean-application-teardown)
- [Reactivity System & State Management](#reactivity-system--state-management)
  - [`signal()` & `computed()` — Reactive State](#signal--computed--reactive-state)
  - [`effect()`, `batch()`, `untrack()` — Side Effects & Sync](#effect-batch-untrack--side-effects--sync)
  - [`ref()` — Direct DOM Element References](#ref--direct-dom-element-references)
- [Reactive Control Flow & Keyed List Reconciliation](#reactive-control-flow--keyed-list-reconciliation)
- [Declarative Lifecycle Components](#declarative-lifecycle-components)
  - [`<Focus>` — Manage Keyboard Focus & Trapping](#focus--manage-keyboard-focus--trapping)
  - [`<OnIdle>` — Defer Mount Until Idle Time](#onidle--defer-mount-until-idle-time)
  - [`<Keep>` — Preserve Dynamic Components](#keep--preserve-dynamic-components)
  - [`<Animate>` — Animate Before DOM Removal](#animate--animate-before-dom-removal)
  - [`<WithinView>` — Viewport-Aware Lazy Mounting](#withinview--viewport-aware-lazy-mounting)
  - [`<Place>` — Render Subtree Elsewhere (Portal)](#place--render-subtree-elsewhere-portal)
  - [`<Load>` — Dynamic Component Switcher](#load--dynamic-component-switcher)
  - [`<Delay>` & `<Wait>` — Async Task & Promise Lifecycles](#delay--wait--async-task--promise-lifecycles)
  - [`<Guard>` — Localized Error Boundary](#guard--localized-error-boundary)
- [Lifecycle-Aware DOM Helpers](#lifecycle-aware-dom-helpers)
  - [`onKey()` — Keyboard Event Listener](#onkey--keyboard-event-listener)
  - [`scrollLock()` — Reference-Counted Scroll Lock](#scrolllock--reference-counted-scroll-lock)
  - [`onOutsideClick()` — Pointer Outside Detection](#onoutsideclick--pointer-outside-detection)
- [Client-Side Router & SEO](#client-side-router--seo)
  - [SPA Router & Layouts](#spa-router--layouts)
  - [`head()` — Dynamic Head Metadata](#head--dynamic-head-metadata)
- [Zero-Dependency PWA Management](#zero-dependency-pwa-management)
- [Architecture & Verification Matrix](#architecture--verification-matrix)
- [License](#license)

---

## Core Principles

1. **Compiler-Free & Build-Free**: Runs natively in any browser via ES modules without Babel, Webpack, Vite, or JSX compilers.
2. **Virtual-DOM-Free**: Updates real DOM elements directly via compiled instruction paths. Component functions run **ONLY ONCE** (`executions === 1`).
3. **Dependency-Free**: 0 external npm dependencies (`dist/primal.standalone.js` is ~15 KB minified).
4. **Signal-Driven Reactivity**: Fine-grained signals trigger surgical DOM text, attribute, and style updates without component re-renders.
5. **Ownership & Lifecycle-Driven**: Tree-structured `ComponentContext` hierarchy manages subscriptions, event listeners, refs, and cleanup hooks automatically.

---

## Quick Start & Installation

### Option A: NPM Package

```bash
npm install primaljs
```

```javascript
import { html, signal, mount } from "primaljs";

function Counter() {
    const count = signal(0);
    return html`
        <button onclick=${() => count.value++}>
            Count: ${count}
        </button>
    `;
}

mount(Counter, "#app");
```

### Option B: Zero-Build Standalone ES Module

Copy `dist/primal.standalone.js` into your project and import directly in `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Zero-Build PrimalJS App</title>
</head>
<body>
    <div id="app"></div>

    <script type="module">
        import { html, signal, mount } from "./js/primal.standalone.js";

        function App() {
            const name = signal("World");
            return html`<h1>Hello, ${name}!</h1>`;
        }

        mount(App, "#app");
    </script>
</body>
</html>
```

---

## Mounting & DOM Hydration

PrimalJS provides two distinct runtime APIs for initializing applications:

| Function | Strategy | Primary Use Case |
| --- | --- | --- |
| **`mount(Component, target)`** | Create DOM | Pure client-side apps starting with an empty container (`<div id="app"></div>`). |
| **`hydrate(Component, target)`** | Adopt Existing DOM | Pre-rendered static HTML. Adopts existing DOM in-place (`nodeBefore === nodeAfter`) without clearing `innerHTML` or flashing. |
| **`unmount(target)`** | Teardown DOM | Disposes application context, stopping effects and detaching event listeners. |

### `mount()` — Create & Mount New DOM

```javascript
import { mount, html, signal } from "primaljs";

function App() {
    const count = signal(0);
    return html`<button onclick=${() => count.value++}>Count: ${count}</button>`;
}

const app = mount(App, "#app");
```

### `hydrate()` — Activate & Adopt Existing Static DOM

`hydrate()` attaches PrimalJS reactivity, event listeners, refs, and `ComponentContext` ownership directly to compatible DOM already present in the browser:

```javascript
import { hydrate, html, signal } from "primaljs";

// Existing browser HTML: <div id="app"><button id="counter">Count: 0</button></div>
function Counter() {
    const count = signal(0);
    return html`<button id="counter" onclick=${() => count.value++}>Count: ${count}</button>`;
}

// Adopts existing DOM elements in-place, preserving live form input values and focus
const app = hydrate(Counter, "#app");
```

- **DOM Identity Preservation**: Preserves exact DOM node identity (`nodeBefore === nodeAfter`).
- **Form & Focus Retention**: Live typed input values (`input.value`), checkbox states, focus (`document.activeElement`), and scroll positions are retained without resetting.
- **Empty Target Fallback**: If the target has no existing child DOM elements, automatically falls back to `mount()` with a dev mode warning.

### `unmount()` — Clean Application Teardown

```javascript
import { unmount } from "primaljs";

// Disposes all effects, event listeners, and lifecycle hooks
unmount("#app");
```

---

## Reactivity System & State Management

### `signal()` & `computed()` — Reactive State

```javascript
import { signal, computed } from "primaljs";

const count = signal(0);
const double = computed(() => count.value * 2);

console.log(double.value); // 0
count.value = 5;
console.log(double.value); // 10
```

### `effect()`, `batch()`, `untrack()` — Side Effects & Sync

```javascript
import { signal, effect, batch, untrack } from "primaljs";

const firstName = signal("Lemuel");
const lastName = signal("Adane");

// Runs automatically on dependency change; returns disposer
const dispose = effect(() => {
    console.log(`User: ${firstName.value} ${untrack(() => lastName.value)}`);
});

// Atomic multi-signal update (notifies subscribers once)
batch(() => {
    firstName.value = "Google";
    lastName.value = "Antigravity";
});

dispose(); // Unsubscribes effect
```

### `ref()` — Direct DOM Element References

```javascript
import { html, ref, onMount } from "primaljs";

function AutoFocusInput() {
    const inputRef = ref();

    onMount(() => {
        inputRef.current.focus();
    });

    return html`<input ref=${inputRef} type="text" placeholder="Search..." />`;
}
```

---

## Reactive Control Flow & Keyed List Reconciliation

Because component functions execute **ONLY ONCE** (`executions === 1`), standard JavaScript `if` statements and `.map()` loops evaluated outside functions run once on mount. Wrap reactive conditions and lists inside arrow functions `${() => ...}`:

| Pattern | Static (Runs Once on Mount) | Reactive (Updates on Signal Change) |
| --- | --- | --- |
| **Conditional** | `if (show.value) ...` | `${() => show.value ? html\`<p>Active</p\` : html\`<p>Inactive</p\`}` |
| **Keyed List** | `items.map(i => ...)` | `${() => items.value.map(i => html\`<li key=\${i.id}>\${i.name}</li>\`)}` |

### Keyed List DOM Reconciliation
Dynamic lists `${() => list.value.map(...)}` use item keys (`key=${item.id}`) to reconcile real DOM nodes in-place — preserving input focus, selection, and component state during array mutations.

---

## Declarative Lifecycle Components

PrimalJS control flow remains pure JavaScript (`if`, `switch`, `.map()`, `ternary`). Built-in components are dedicated exclusively to managing **reactive subtrees, browser interactions, and asynchronous lifecycles**:

| Component | Responsibility |
| --- | --- |
| **`<Focus>`** | Keyboard Focus Management (Autofocus, Tab trapping, focus restoration, nested stacks) |
| **`<OnIdle>`** | Browser Idle Scheduling (Defer non-critical mounting until browser has idle time) |
| **`<Keep>`** | Subtree Preservation (Preserve inactive component instances & DOM state in cache) |
| **`<Animate>`** | Exit Animation Coordination (Coordinate visual CSS enter/leave before DOM removal) |
| **`<WithinView>`** | Viewport-Aware Lazy Mounting (Mount child subtrees when approaching viewport) |
| **`<Place>`** | Portal / Render Elsewhere (Render child subtree into another DOM target) |
| **`<Load>`** | Dynamic Component Switcher (Swap active component based on signal/route) |
| **`<Delay>`** | Async Task Execution (Execute async task with AbortController & timeout) |
| **`<Wait>`** | Promise Observation & Unwrap (Unwrap existing Promise with timeout & error boundary) |
| **`<Guard>`** | Localized Error Boundary (Catch exceptions and render fallback UI) |

---

<a id="focus--manage-keyboard-focus--trapping"></a>
### `<Focus>` — Manage Keyboard Focus & Trapping

Manages accessibility, keyboard focus trapping, and focus restoration for modals, dialogs, drawers, and menus:

```javascript
import { html, signal, Place, Focus } from "primaljs";

function App() {
    const open = signal(false);

    return html`
        <button onclick=${() => open.value = true}>Open Modal</button>

        ${() => open.value ? html`
            <Place to="#modal-root">
                <Focus initial="#first-input">
                    <div role="dialog" aria-modal="true">
                        <h2>Settings</h2>
                        <input id="first-input" placeholder="Name" />
                        <button onclick=${() => open.value = false}>Close</button>
                    </div>
                </Focus>
            </Place>
        ` : null}
    `;
}
```

- **`autofocus=${true}` (Default)**: Automatically focuses first tabbable element or `initial` target prop on mount.
- **`trap=${true}` (Default)**: Traps `Tab` and `Shift+Tab` cycling inside the owned subtree.
- **`restore=${true}` (Default)**: Restores browser focus to the trigger button (`document.activeElement`) when unmounted.
- **Nested Focus Stack**: Supports nested modals cleanly. Outer focus traps pause while an inner modal is open and resume when closed.

---

<a id="onidle--defer-mount-until-idle-time"></a>
### `<OnIdle>` — Defer Mount Until Idle Time

Delays creation and mounting of non-critical child subtrees until the browser has idle scheduling time (`requestIdleCallback`):

```javascript
import { html, OnIdle } from "primaljs";
import { RecommendationsWidget } from "./widgets.js";

function Page() {
    return html`
        <main>
            <h1>Main Content</h1>

            <OnIdle timeout=${2000} fallback=${html`<div>Loading recommendations...</div>`}>
                <RecommendationsWidget />
            </OnIdle>
        </main>
    `;
}
```

- **0-Execution Guarantee**: Child component function is **NOT** executed before idle scheduling (`created === 0`).
- **Forced Maximum Wait (`timeout`)**: `timeout` specifies maximum wait before forced eligibility without throwing.
- **Unmount Cancellation**: Unmounting parent before idle fires cancels the callback automatically.

---

<a id="keep--preserve-dynamic-components"></a>
### `<Keep>` — Preserve Dynamic Components

Preserves previously mounted component instances and DOM subtrees in an internal LRU cache instead of destroying them:

```javascript
import { html, signal, Keep, Load } from "primaljs";
import { DashboardTab, SettingsTab } from "./tabs.js";

const currentTab = signal(DashboardTab);

function App() {
    return html`
        <Keep max=${5}>
            <Load component=${currentTab} />
        </Keep>
    `;
}
```

- **Preserves Native State**: Retains typed form input values, scroll positions, and local signal state naturally.
- **`DESTROYED` vs `KEPT`**: While kept in background cache, `onDestroy` hooks do **NOT** run, and reactive bindings continue updating detached DOM so it is fresh when restored.

---

<a id="animate--animate-before-dom-removal"></a>
### `<Animate>` — Animate Before DOM Removal

Coordinates visual CSS enter/leave animations with component teardown:

```javascript
import { html, signal, Animate } from "primaljs";

const open = signal(false);

function App() {
    return html`
        <Animate enter="fade-in" leave="fade-out" duration=${200}>
            ${() => open.value ? html`<div class="card">Animated Dialog</div>` : null}
        </Animate>
    `;
}
```

- **Deferred Teardown**: Keeps DOM nodes and `ComponentContext` alive during leave animation. Runs `onDestroy` and removes DOM only after animation finishes.
- **Interruption Recovery**: Toggling state back to `true` mid-leave cancels the exit animation instantly.

---

<a id="withinview--viewport-aware-lazy-mounting"></a>
### `<WithinView>` — Viewport-Aware Lazy Mounting

Delays component instantiation until its position approaches the browser viewport (`IntersectionObserver`):

```javascript
import { html, WithinView } from "primaljs";
import { HeavyChart } from "./chart.js";

function Page() {
    return html`
        <WithinView margin="200px" minHeight="400px" fallback=${html`<p>Loading chart...</p>`}>
            <HeavyChart />
        </WithinView>
    `;
}
```

---

<a id="place--render-subtree-elsewhere-portal"></a>
### `<Place>` — Render Subtree Elsewhere (Portal)

Renders child content into another DOM target (`to="#modal-root"`) while maintaining 100% logical component ownership:

```javascript
import { html, Place } from "primaljs";

function Modal({ children }) {
    return html`
        <Place to="#portal-root">
            <div class="modal-overlay">${children}</div>
        </Place>
    `;
}
```

---

<a id="load--dynamic-component-switcher"></a>
### `<Load>` — Dynamic Component Switcher

Dynamically swaps component functions based on a signal or function:

```javascript
import { html, signal, Load } from "primaljs";
import { UserView, AdminView } from "./views.js";

const role = signal("user");

function ViewSwitcher() {
    return html`<Load component=${() => role.value === "admin" ? AdminView : UserView} />`;
}
```

---

<a id="delay--wait--async-task--promise-lifecycles"></a>
### `<Delay>` & `<Wait>` — Async Task & Promise Lifecycles

Manage asynchronous operations with `AbortController`, timeouts (`timeout=${5000}`), loading slots (`<Briefly>`), and error boundaries (`<Failed>`):

```javascript
import { html, signal, Delay, Briefly, Failed } from "primaljs";

const query = signal("search");

function Search() {
    return html`
        <Delay task=${({ signal }) => fetch(`/api/search?q=${query.value}`, { signal }).then(r => r.json())} timeout=${5000}>
            ${data => html`<ul>${data.items.map(item => html`<li>${item.title}</li>`)}</ul>`}
            <Briefly><p>Searching...</p></Briefly>
            <Failed>${(err, retry) => html`<p>Error: ${err.message}</p><button onclick=${retry}>Retry</button>`}</Failed>
        </Delay>
    `;
}
```

---

<a id="guard--localized-error-boundary"></a>
### `<Guard>` — Localized Error Boundary

Catches runtime exceptions in child subtrees and renders fallback UI:

```javascript
import { html, Guard } from "primaljs";

function App() {
    return html`
        <Guard fallback=${(err, retry) => html`<div><p>${err.message}</p><button onclick=${retry}>Retry</button></div>`}>
            <UnsafeWidget />
        </Guard>
    `;
}
```

---

## Lifecycle-Aware DOM Helpers

PrimalJS provides explicit JavaScript helpers (NOT template tags) that manage browser listeners while automatically binding to `ComponentContext` lifecycle and `<Keep>` caches:

### `onKey()` — Keyboard Event Listener

```javascript
import { onKey } from "primaljs";

function Dialog() {
    // Automatically unbinds on component unmount
    onKey("Escape", () => closeModal());
    onKey(btnRef, "Enter", (e) => submit(), { ctrl: true, ignoreEditable: true });
}
```

### `scrollLock()` — Reference-Counted Scroll Lock

```javascript
import { scrollLock } from "primaljs";

function Modal() {
    // Locks body scroll; restores scroll when all active locks reach 0
    scrollLock();
}
```

### `onOutsideClick()` — Pointer Outside Detection

```javascript
import { onOutsideClick } from "primaljs";

function Dropdown() {
    // Supports array targets [triggerRef, menuRef] across <Place> portals
    onOutsideClick([triggerRef, menuRef], () => closeMenu());
}
```

---

## Client-Side Router & SEO

### SPA Router & Layouts

```javascript
import { createRouter, RouteOutlet, html, mount } from "primaljs";
import { HomePage, AboutPage, UserPage } from "./pages.js";

const router = createRouter([
    { path: "/", component: HomePage },
    { path: "/about", component: AboutPage },
    { path: "/users/:id", component: UserPage }
]);

function App() {
    return html`
        <nav><a href="/">Home</a> | <a href="/about">About</a></nav>
        <main><RouteOutlet router=${router} /></main>
    `;
}

mount(App, "#app");
```

### `head()` — Dynamic Head Metadata

```javascript
import { head } from "primaljs";

function Page() {
    head({
        title: "User Profile — PrimalJS",
        meta: [{ name: "description", content: "User profile details" }]
    });
    return html`<h1>Profile</h1>`;
}
```

---

## Zero-Dependency PWA Management

Register service workers and manage offline caches:

```javascript
import { setupPwa } from "primaljs";

setupPwa({
    scriptUrl: "/sw.js",
    scope: "/",
    onUpdate: (reload) => {
        if (confirm("New version available. Reload?")) reload();
    }
});
```

---

## Architecture & Verification Matrix

PrimalJS enforces strict architectural guarantees across its test suite:

- **Single Component Execution**: Component functions execute **exactly once** (`executions === 1`) on mount. Routine state changes mutate real DOM targets directly.
- **DOM Identity & Focus Preservation**: Target DOM element instances remain untouched when state changes (`nodeBefore === nodeAfter`), preserving input focus, form state, and text selections.
- **Root Disposal**: `mount()` and `hydrate()` return `{ dispose() }` for idempotent teardown of DOM nodes, event listeners, and subscriptions.

### Test Suite Execution

```bash
# Run full unit test suite (171 / 171 passing)
npm test

# Run Playwright E2E browser suite (18 / 18 passing)
npm run test:e2e

# Run cross-browser suite targeting Chromium, Firefox, and mobile Chromium
npm run test:e2e:cross
```

### Browser Verification Results

```text
=== PRIMALJS TEST VERIFICATION MATRIX ===
ℹ Unit Tests:        171 / 171 PASSING (100%) across 31 test suites
ℹ E2E Browser Tests: 18 / 18 PASSING (100%) in real Playwright browser instances
ℹ Cross-Browser:     PASSING on Chromium, Firefox, and Android Mobile Web
```

---

## License

[MIT License](LICENSE) © Lemuel Adane & PrimalJS Contributors
