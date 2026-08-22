# PrimalJS

> **The Super Minimalists’ ReactJS — Pure JS, Function Components, Tagged Templates, Signals, Direct Real-DOM Updates, No Typescript, No Babel, No JSX, No Compiler, No Virtual DOM, No Re-Render. Turns out you don't need those BS complications.**

PrimalJS is a lightweight Single Page Application (SPA) framework currently in beta (`v0.4.0-beta`), designed for production-oriented applications built directly on modern browser APIs. Back to the fundamentals of web development — **JavaScript stays JavaScript**.

---

### **Credits & Attribution**
- **Authored & Designed by:** Lemuel Adane
- **Coded & Architecture by:** Google Antigravity
- **Product Tested & QA by:** ChatGPT

---

## Table of Contents

- [Core Principles](#core-principles)
- [Quick Start & Installation](#quick-start--installation)
  - [Option A: Installation via NPM](#option-a-installation-via-npm)
  - [Option B: Direct ES Module Import (Zero Build)](#option-b-direct-es-module-import-zero-build)
- [Reactivity System & State Management](#reactivity-system--state-management)
  - [`signal()` — Reactive State](#signal--reactive-state)
  - [`computed()` — Derived State](#computed--derived-state)
  - [`effect()` — Side Effects & Sync](#effect--side-effects--sync)
  - [`batch()` — Atomic Multi-Field Updates](#batch--atomic-multi-field-updates)
  - [`untrack()` — Silent Signal Reads](#untrack--silent-signal-reads)
  - [`ref()` — Direct DOM References](#ref--direct-dom-references)
- [Reactive Control Flow & Keyed List Reconciliation](#reactive-control-flow--keyed-list-reconciliation)
- [Declarative Lifecycle Components](#declarative-lifecycle-components)
  - [`<Load>` — Dynamic Component Switcher](#load--dynamic-component-switcher)
  - [`<Wait>` — Promise Observation & Unwrap](#wait--promise-observation--unwrap)
  - [`<Delay>` — Reactive Async Task Lifecycle](#delay--reactive-async-task-lifecycle)
  - [`<Boundary>` — Localized Error Boundary](#boundary--localized-error-boundary)
- [Client-Side SPA Router & Layouts](#client-side-spa-router--layouts)
- [SEO & Pre-rendered DOM Activation](#seo--pre-rendered-dom-activation)
  - [`head()` — Dynamic Head Metadata](#head--dynamic-head-metadata)
  - [`activate()` — Zero-Flash Hydration](#activate--zero-flash-hydration)
- [Zero-Dependency PWA Management](#zero-dependency-pwa-management)
- [Architecture & Verification](#architecture--verification)
- [Credits & Attribution](#credits--attribution)
- [License](#license)

---

## Core Principles

- **Pure JavaScript**: Standard ES Modules (`.js`) parsed natively by browser engines.

- **Function Components Only**: Clean, predictable function components. No class components, no complex hook rules.

- **Native Tagged-Template Literals**: `html`...`` templates parsed directly using modern browser `<template>` elements.

- **No JSX Compiler**: Write pure JavaScript template strings without Babel, SWC, or compilation steps.

- **No Transpiler Required**: Zero build steps required to run in production or development.

- **No Virtual DOM**: Real DOM nodes created once. Signal updates mutate target text nodes and attributes directly.

- **No React-Style Reconciliation**: Eliminates expensive tree diffing algorithms entirely.

- **Single Component Execution (`executions === 1`)**: Component functions execute **exactly once** on initial mount. Routine state updates never re-run component functions.

- **Fine-Grained DOM Updates**: Signal writes pinpoint and update exact text nodes and element attributes.

- **Predictable Lifecycle & Cleanup**: Automatic disposal of event listeners, effect subscriptions, and DOM subtrees (`onMount`, `onDestroy`, `{ dispose }`).

- **SEO & Server Agnostic**: Serve static files from Nginx, Apache, Caddy, Go, Rust, Python, PHP, or CDNs.

---

## Quick Start & Installation

### Option A: Installation via NPM

Install PrimalJS in your Node.js or bundled frontend project:

```bash
npm install primaljs
```

Import and mount your application:

```javascript
import { html, signal, computed, mount } from "primaljs";

function Counter() {
    const count = signal(0);
    const doubled = computed(() => count.value * 2);

    return html`
        <main class="card">
            <h1>Count: ${count} (Doubled: ${doubled})</h1>
            <button onclick=${() => count.value++}>Increment</button>
        </main>
    `;
}

mount(Counter, "#app");
```

---

### Option B: Direct ES Module Import (Zero Build)

Run directly in any web browser without Node.js, npm, or build tools:

1. **Copy `dist/primal.standalone.js` into your project**:
   ```bash
   # Generate or copy the standalone zero-dependency ES module bundle:
   npm run build
   cp ./dist/primal.standalone.js ./public/js/primal.standalone.js
   ```

2. **Create your `index.html`**:
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
       <meta charset="UTF-8">
       <meta name="viewport" content="width=device-width, initial-scale=1.0">
       <title>Zero Build Application</title>
   </head>
   <body>
       <div id="app"></div>
       <script type="module" src="./js/app.js"></script>
   </body>
   </html>
   ```

3. **Create your `./js/app.js`**:
   ```javascript
   import { html, signal, mount } from "./js/primal.standalone.js";

   function App() {
       const message = signal("Hello from PrimalJS!");
       return html`<h2>${message}</h2>`;
   }

   mount(App, "#app");
   ```

4. **Serve with any HTTP server**:
   ```bash
   python3 -m http.server 8000
   # or npx serve .
   ```

---

## Reactive Control Flow & Keyed List Reconciliation

Because PrimalJS guarantees single component execution (`executions === 1`), standard JavaScript `if`, `switch`, and `Array.prototype.map` evaluated outside arrow functions run **once on component mount**. To make control flow and list rendering reactive, wrap them inside function expressions:

| Control Flow Pattern | Static (Runs Once on Mount) | Reactive (Updates on Signal Change) |
|---|---|---|
| **Conditional Rendering** | `if (status.value) ...` | `${() => status.value ? html\`<p>Active</p>\` : html\`<p>Inactive</p>\`}` |
| **List Rendering** | `items.map(item => ...)` | `${() => items.value.map(item => html\`<li key=\${item.id}>\${item.name}</li>\`)}` |

### Keyed List DOM Reconciliation & State Preservation
Dynamic lists returned from reactive functions `${() => list.value.map(...)}` perform fine-grained DOM node reconciliation using item `key` attributes (`key=${item.id}`), `item.key`, `item.id`, or item identity. Existing DOM elements are updated in-place, preserving input focus, text selection, scroll position, and component state across array mutations.

---

## Declarative Lifecycle Components

PrimalJS control flow remains pure JavaScript (`if`, `switch`, `.map()`, `ternary`). Specialized framework components are provided exclusively to manage **reactive subtrees and asynchronous lifecycles**:

| Component | Responsibility |
|---|---|
| **`<Load>`** | Dynamic Component Switcher ("Which component should exist?") |
| **`<Wait>`** | Promise Observation & Unwrap ("When is an existing Promise available?") |
| **`<Delay>`** | Reactive Async Task Lifecycle ("Execute and manage a reactive async operation") |
| **`<Boundary>`** | UI Error Boundary ("What happens when a subtree fails?") |

---

### `<Wait>` — Promise Observation & Unwrap

Observes an existing Promise (or Promise-returning function/Signal) and unwraps its resolved value while rendering `<Briefly>` loading fallback UI:

```javascript
import { html, Wait, Briefly, Failed } from "primaljs";

const userPromise = fetch("/api/user/123").then(res => res.json());

function UserProfile() {
    return html`
        <Wait for=${userPromise}>
            ${user => html`
                <div class="user-card">
                    <h2>${user.name}</h2>
                    <p>Role: ${user.role}</p>
                </div>
            `}

            <Briefly>
                <div class="spinner">Loading profile...</div>
            </Briefly>

            <Failed>
                ${(err, retry) => html`
                    <div class="error">
                        <p>Failed: ${err.message}</p>
                        <button onclick=${retry}>Retry</button>
                    </div>
                `}
            </Failed>
        </Wait>
    `;
}
```

---

### `<Delay>` — Reactive Async Task Lifecycle

Owns and manages a reactive asynchronous operation. Automatically passes an `AbortController` signal to the task and aborts pending in-flight requests when Signal dependencies update or when the component unmounts:

```javascript
import { html, signal, Delay, Briefly, Failed } from "primaljs";

const userId = signal(1);

function UserSearch() {
    return html`
        <div>
            <button onclick=${() => userId.value++}>Next User (${userId})</button>

            <Delay task=${({ signal }) => fetch(`/api/users/${userId.value}`, { signal }).then(r => r.json())}>
                ${user => html`
                    <div class="card">
                        <h3>${user.name}</h3>
                    </div>
                `}

                <Briefly>
                    <p>Fetching user ${userId}...</p>
                </Briefly>

                <Failed>
                    ${(err, retry) => html`
                        <p>Error: ${err.message}</p>
                        <button onclick=${retry}>Try Again</button>
                    `}
                </Failed>
            </Delay>
        </div>
    `;
}
```

---

### `<Boundary>` — Localized Error Boundary

Catches unhandled exceptions or rejected promises in its child component subtree, preventing application crashes:

```javascript
import { html, Boundary } from "primaljs";

function App() {
    return html`
        <Boundary fallback=${(err, retry) => html`
            <div class="error-card">
                <p>Failed to load component: ${err.message}</p>
                <button onclick=${retry}>Try Again</button>
            </div>
        `}>
            <WidgetComponent />
        </Boundary>
    `;
}
```

#### Error Propagation Hierarchy
```text
Promise / Task Rejection
         │
         ▼
     rejected?
         │
         ▼
  <Failed> slot exists? ── yes ──> Render <Failed> slot locally
         │
         no
         ▼
  <Boundary> exists? ─── yes ──> Render <Boundary> fallback
         │
         no
         ▼
  createApp({ onError }) / reportGlobalError()
```

---

## Architecture & Verification

PrimalJS enforces strict architectural guarantees across its test suite:

- **Single Component Execution**: Component functions execute **exactly once** (`executions === 1`) on mount. Routine state changes mutate real DOM targets directly.
- **DOM Identity & Focus Preservation**: Target DOM element instances remain untouched when state changes, preserving input focus and text selections.
- **Root Disposal**: `mount()` returns `{ dispose() }` for idempotent teardown of DOM nodes, event listeners, and subscriptions.
- **Application Instance Scope**: PrimalJS assumes one primary root `createApp()` application per browser document for top-level window error event handling scope.

### Running Tests

```bash
# Run complete unit & async test suite (101/101 passing)
npm run test:unit

# Run full E2E Playwright browser suite (Hello, Todo, Render, Showcase SPA)
npm run test:e2e

# Run cross-browser suite targeting Chromium, Firefox, WebKit, Edge, and mobile Chromium
npm run test:e2e:cross
```

### Accurate Browser Verification Matrix

- **Chromium Engine**: Tested & Passed
- **Firefox Engine**: Tested & Passed
- **WebKit / Safari Engine**: Tested & Passed
- **Mobile Chromium Emulation**: Tested & Passed
- **Actual Microsoft Edge**: Not guaranteed by current local runner (requires system installation)

```text
=== MATRIX VERIFICATION RESULTS ===
ℹ tests 101 unit | pass 101 | fail 0 | 0 errors
ℹ tests 4 e2e   | pass 4   | fail 0 | 0 errors
ℹ tests 5 cross | pass 3   | fail 0 | 2 skipped (uninstalled local binaries)
```

---

## License

[MIT License](LICENSE) © Lemuel Adane & PrimalJS Contributors
