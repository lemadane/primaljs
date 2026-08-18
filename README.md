# PrimalJS

> **The Minimalists’ ReactJS — Pure JS, Function Components, Tagged Templates, Signals, Direct Real-DOM Updates, No Virtual DOM, No Compiler.**

PrimalJS is a lightweight Single Page Application (SPA) framework currently in beta, designed for production-oriented applications built directly on modern browser APIs. Back to the fundamentals of web development — **JavaScript stays JavaScript**.

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
- [Declarative Control Flow Tags](#declarative-control-flow-tags)
  - [`<If>`, `<ElseIf>`, `<Else>` — Conditionals](#if-elseif-else--conditionals)
  - [`<Switch>`, `<Case>`, `<Default>` — Branch Matching](#switch-case-default--branch-matching)
  - [`<For>`, `<Continue />`, `<Break />`, `<Else>` — Keyed Loops](#for-continue-break-else--keyed-loops)
  - [`<Delay>`, `<Wait>`, `<Briefly>`, `<Failed>` — Expressive Async Controls](#delay-wait-briefly-failed--expressive-async-controls)
  - [`<Mount>` — Dynamic Component Switcher](#mount--dynamic-component-switcher)
  - [`<Try>`, `<Catch>` — UI Error Boundaries](#try-catch--ui-error-boundaries)
- [Client-Side SPA Router & Layouts](#client-side-spa-router--layouts)
- [SEO & Pre-rendered DOM Activation](#seo--pre-rendered-dom-activation)
  - [`head()` — Dynamic Head Metadata](#head--dynamic-head-metadata)
  - [`activate()` — Zero-Flash Hydration](#activate--zero-flash-hydration)
- [Zero-Dependency PWA Management](#zero-dependency-pwa-management)
- [Architecture & Verification](#architecture--verification)
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

1. **Copy `primal.js` into your project**:
   ```bash
   cp /path/to/primaljs/primal.js ./public/js/primal.js
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
   import { html, signal, mount } from "./primal.js";

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

## Reactivity System & State Management

### `signal()` — Reactive State

`signal()` creates a fine-grained reactive state container. Reading `.value` registers dependency tracking inside effects and templates; writing `.value` notifies subscribers.

```javascript
import { signal, html } from "primaljs";

const quantity = signal(1);

function CartControls() {
    return html`
        <div class="cart-controls">
            <button onclick=${() => quantity.value--}>-</button>
            <span>Quantity: ${quantity}</span>
            <button onclick=${() => quantity.value++}>+</button>
        </div>
    `;
}
```

### `computed()` — Derived State

`computed()` creates a read-only Signal derived from other Signals. It automatically re-evaluates only when its referenced dependencies change.

```javascript
import { signal, computed, html } from "primaljs";

const itemPrice = signal(49.99);
const quantity = signal(2);
const taxRate = signal(0.08);

const orderTotal = computed(() => {
    const subtotal = itemPrice.value * quantity.value;
    const total = subtotal * (1 + taxRate.value);
    return total.toFixed(2);
});

function OrderSummary() {
    return html`<p>Total: <strong>$${orderTotal}</strong></p>`;
}
```

### `effect()` — Side Effects & Sync

`effect()` executes a side-effect function automatically whenever referenced Signals update.

```javascript
import { signal, effect } from "primaljs";

const theme = signal(localStorage.getItem("theme") || "dark");

effect(() => {
    localStorage.setItem("theme", theme.value);
    document.body.className = `theme-${theme.value}`;
});
```

### `batch()` — Atomic Multi-Field Updates

`batch()` suppresses subscriber notifications during multiple Signal writes, executing a single batch update pass at the end.

```javascript
import { signal, batch } from "primaljs";

const firstName = signal("Lemuel");
const lastName = signal("Adane");

function resetForm() {
    batch(() => {
        firstName.value = "";
        lastName.value = "";
    });
}
```

### `untrack()` — Silent Signal Reads

`untrack()` reads a Signal value inside a computed or effect without creating a reactive dependency subscription.

```javascript
import { signal, computed, untrack } from "primaljs";

const query = signal("");
const category = signal("all");

const searchResults = computed(() => {
    const q = query.value.toLowerCase();
    // Reads category silently without subscribing to category changes
    const cat = untrack(() => category.value);
    return items.filter(i => i.cat === cat && i.name.includes(q));
});
```

### `ref()` — Direct DOM References

`ref()` creates an element reference object (`ref.current`) bound to the underlying native DOM node after component mounting.

```javascript
import { html, ref, onMount } from "primaljs";

function SearchInput() {
    const inputRef = ref();

    onMount(() => {
        if (inputRef.current) inputRef.current.focus();
    });

    return html`<input ref=${inputRef} type="text" placeholder="Search..." />`;
}
```

---

## Declarative Control Flow Tags

### `<If>`, `<ElseIf>`, `<Else>` — Conditionals

Swaps real DOM node ranges directly when condition expressions change, without re-executing enclosing parent component functions.

```javascript
import { html, signal, If, ElseIf, Else } from "primaljs";

const userRole = signal("admin");

html`
    <If when=${() => userRole.value === "admin"}>
        <AdminDashboard />
        <ElseIf when=${() => userRole.value === "editor"}>
            <EditorDashboard />
        </ElseIf>
        <Else>
            <GuestView />
        </Else>
    </If>
`
```

### `<Switch>`, `<Case>`, `<Default>` — Branch Matching

Matches single values, arrays of values, or predicate functions with strict first-match-wins ordering (no fallthrough, no `break` tags required).

```javascript
import { html, signal, Switch, Case, Default } from "primaljs";

const status = signal("in_progress");

html`
    <Switch value=${status}>
        <Case value="completed">
            <span class="badge success">Completed</span>
        </Case>
        <Case value=${["in_progress", "pending"]}>
            <span class="badge warning">Processing...</span>
        </Case>
        <Case value=${v => typeof v === "number" && v > 100}>
            <span class="badge info">High Priority</span>
        </Case>
        <Default>
            <span class="badge secondary">Unknown Status</span>
        </Default>
    </Switch>
`
```

### `<For>`, `<Continue />`, `<Break />`, `<Else>` — Keyed Loops

Fine-grained keyed DOM reconciliation. Re-orders, appends, or removes target DOM item nodes directly when array data mutates.

```javascript
import { html, signal, For, Continue, Break, Else } from "primaljs";

const users = signal([
    { id: 1, name: "Lemuel", active: true, sysAdmin: false },
    { id: 2, name: "Sarah", active: true, sysAdmin: true },
    { id: 3, name: "Marcus", active: false, sysAdmin: false }
]);

html`
    <For each=${users} key=${u => u.id}>
        ${(user, index) => html`
            <Continue when=${() => !user.active} />
            <Break when=${() => user.sysAdmin} />
            <div class="user-card">
                <span>#${index() + 1}: ${user.name}</span>
            </div>
        `}
        <Else>
            <p>No active users found.</p>
        </Else>
    </For>
`
```

### `<Delay>`, `<Wait>`, `<Briefly>`, `<Failed>` — Expressive Async Controls

Human-first plain-English control flow for handling async operations, promises, and dynamic component loading.

```javascript
import { html, signal, Delay, Wait, Briefly, Failed } from "primaljs";

const userId = signal(1);

const fetchUserData = (id, { signal }) => {
    return fetch(`/api/users/${id}`, { signal }).then(res => res.json());
};

html`
    <!-- <Delay> automatically re-triggers when Signals inside task change -->
    <Delay task=${({ signal }) => fetchUserData(userId.value, { signal })}>
        ${user => html`
            <div class="profile-card">
                <h3>${user.name}</h3>
                <p>Email: ${user.email}</p>
            </div>
        `}
        <Briefly>
            <div class="loading">Fetching user data...</div>
        </Briefly>
        <Failed>
            ${(err, retry) => html`
                <div class="error">
                    <p>Failed: ${err.message}</p>
                    <button onclick=${retry}>Retry Request</button>
                </div>
            `}
        </Failed>
    </Delay>
`
```

#### Unwrapping Single Promises (`<Wait>`):

```javascript
const analyticsPromise = fetch("/api/analytics").then(res => res.json());

html`
    <Wait for=${analyticsPromise}>
        ${data => html`<h3>Total Visits: ${data.visits}</h3>`}
        <Briefly><p>Loading analytics...</p></Briefly>
        <Failed>${err => html`<p>Error: ${err.message}</p>`}</Failed>
    </Wait>
`
```

> **Backward Compatibility**: `Async`, `Await`, `Pending`, and `Catch` remain exported as fully functional aliases.

### `<Mount>` — Dynamic Component Switcher

> **Distinction (`mount()` vs `<Mount>`)**:
> - `mount(Component, target, options)` is the **imperative application entry function** used to attach a root component to a target DOM container (e.g., `mount(App, "#app")`).
> - `<Mount component=${activeTab} />` is the **declarative component tag** used inside templates to dynamically switch active components in an owned real-DOM range without rerunning the parent component (`executions === 1`).

Mounts dynamic component references in an owned DOM range without re-executing the enclosing parent component function (`executions === 1`).

```javascript
import { html, signal, Mount } from "primaljs";

function OverviewTab(props) { return html`<div>Overview: ${props.user.name}</div>`; }
function SettingsTab(props) { return html`<div>Settings: ${props.user.name}</div>`; }

const activeTab = signal(OverviewTab);
const user = signal({ name: "Lemuel" });

html`
    <div class="tabs">
        <button onclick=${() => activeTab.value = OverviewTab}>Overview</button>
        <button onclick=${() => activeTab.value = SettingsTab}>Settings</button>

        <Mount component=${activeTab} user=${user} />
    </div>
`
```

### `<Try>`, `<Catch>` — UI Error Boundaries

Protects applications from full crashes by trapping render exceptions, lifecycle failures, and computed Signal errors inside protective boundaries.

```javascript
import { html, signal, Try, Catch } from "primaljs";

const shouldFail = signal(false);

function Widget() {
    if (shouldFail.value) throw new Error("Widget rendering crashed!");
    return html`<div>Widget Content Loaded</div>`;
}

html`
    <Try>
        <Widget />
        <Catch>
            ${(err, reset) => html`
                <div class="error-box">
                    <p>${err.message}</p>
                    <button onclick=${() => { shouldFail.value = false; reset(); }}>
                        Reset Boundary
                    </button>
                </div>
            `}
        </Catch>
    </Try>
`
```

---

## Client-Side SPA Router & Layouts

A feature-complete client-side router with nested layouts, route guards (`beforeEnter`), dynamic parameter extraction (`useRoute`), and dynamic SEO head management.

```javascript
import {
    createApp,
    createRouter,
    RouteOutlet,
    useRoute,
    navigate,
    head,
    html
} from "primaljs";

function AppLayout() {
    return html`
        <div class="app-layout">
            <nav>
                <button onclick=${() => navigate("/")}>Home</button>
                <button onclick=${() => navigate("/users/101")}>User 101</button>
            </nav>
            <main>
                <RouteOutlet />
            </main>
        </div>
    `;
}

function UserDetail() {
    const route = useRoute();

    head({
        title: `User Profile #${route.params.id} | My App`,
        description: `Profile page for User ${route.params.id}`
    });

    return html`<h2>User Profile ID: ${route.params.id}</h2>`;
}

const router = createRouter({
    routes: [
        {
            path: "/",
            component: AppLayout,
            children: [
                { path: "", component: () => html`<h2>Home Page</h2>` },
                { path: "users/:id", component: UserDetail }
            ]
        }
    ]
});

const app = createApp({ router });
app.mount("#app");
```

---

## SEO & Pre-rendered DOM Activation

PrimalJS is designed to support SEO-friendly pre-rendering and server-rendered DOM activation.

### `head()` — Dynamic Head Metadata

Dynamically manages document `<title>`, meta tags, OpenGraph cards, canonical links, and JSON-LD structured data on route transitions.

```javascript
import { head } from "primaljs";

// Primary flat options API:
head({
    title: "Product Detail | My Store",
    description: "High quality software components.",
    image: "https://example.com/og.png",
    robots: "index, follow",
    canonical: "https://example.com/product",
    jsonLd: { "@context": "https://schema.org", "@type": "Product", name: "Widget" }
});

// Advanced custom meta/link tags array API:
head({
    title: "Product Detail | My Store",
    meta: [
        { name: "keywords", content: "framework, javascript, reactive" },
        { property: "og:type", content: "website" }
    ],
    link: [
        { rel: "alternate", href: "https://example.com/fr/product" }
    ]
});
```

### `activate()` — Zero-Flash Hydration

Attaches Signals, reactive effects, and event listeners directly to pre-rendered HTML DOM nodes **without clearing `innerHTML`** or causing layout flashes.

```javascript
import { activate } from "primaljs";

// Attaches behavior to existing server-rendered DOM
activate(App, "#app");
```

---

## Zero-Dependency PWA Management

PrimalJS includes built-in Service Worker registration and cache management without external dependencies:

```javascript
import { setupPwa, unregisterServiceWorkers } from "primaljs";

// Register Service Worker
setupPwa({
    swPath: "./sw.js",
    updateStrategy: "prompt",
    onUpdateAvailable() {
        if (confirm("New update available. Reload?")) {
            window.location.reload();
        }
    }
});

// Disable Service Worker & clear caches
unregisterServiceWorkers("./sw.js");
```

---

## Security & XSS Prevention

PrimalJS is built with strict security defaults to protect applications against Cross-Site Scripting (XSS) and protocol injection vulnerabilities:

### 1. Safe-by-Default HTML Escaping
All dynamic string values interpolated inside tagged template literals (`html\`<div>${userInput}</div>\``) are converted into DOM Text Nodes using `document.createTextNode()`. Raw HTML strings, `<script>` tags, or malicious attributes like `<img src=x onerror=alert(1)>` are rendered harmlessly as plain text.

### 2. Explicit Raw HTML (`unsafeHtml`)
To render unescaped HTML content (such as rich text editor output), developers must explicitly use `unsafeHtml(trustedHtml)`:

```javascript
import { html, unsafeHtml } from "primaljs";

// WARNING: Always sanitize untrusted HTML (e.g., using DOMPurify) before passing to unsafeHtml()
const userBio = DOMPurify.sanitize(rawHtmlInput);

function UserProfile() {
    return html`<div class="bio">${unsafeHtml(userBio)}</div>`;
}
```

### 3. Automatic URL Protocol Sanitization
PrimalJS automatically inspects URL attributes (`href`, `src`, `action`, `formaction`, `data`) bound via template expressions. Dangerous URL protocol schemes (`javascript:`, `vbscript:`, `data:text/html`) are neutralized automatically to `"about:blank"` to block script execution attacks.

---

## Architecture & Verification

PrimalJS enforces strict architectural guarantees across its test suite:

- **Single Component Execution**: Component functions execute **exactly once** (`executions === 1`) on mount. Routine state changes mutate real DOM targets directly.
- **DOM Identity Preservation**: Target DOM element instances remain untouched when state changes.
- **Root Disposal**: `mount()` returns `{ dispose() }` for idempotent teardown of DOM nodes, event listeners, and subscriptions.
- **Application Instance Scope**: PrimalJS assumes one primary root `createApp()` application per browser document for top-level window error event handling scope.

### Running Tests

```bash
# Run unit & integration test suite (134/134 passing)
npm run test:unit

# Run cross-browser suite targeting Chromium, Firefox, WebKit, Edge, and mobile Chromium
npm run test:e2e:cross

# Run full test suite
npm run test:e2e
```

### Full Matrix Verification Status

GitHub Actions CI installs Playwright binaries (`npx playwright install --with-deps chromium firefox webkit`) to verify active browser engines. In local environments lacking specific system binaries (such as Edge on Linux), uninstalled browser targets are gracefully skipped while active installed engines pass.

```text
=== MATRIX REPEATED PASS 1 ===
ℹ tests 143 unit | pass 143 | fail 0 | 0 errors
ℹ tests 9 e2e     | pass 9   | fail 0 | 0 errors
ℹ tests 5 cross   | pass 3   | fail 0 | 2 skipped (uninstalled local binaries)

=== MATRIX REPEATED PASS 2 ===
ℹ tests 143 unit | pass 143 | fail 0 | 0 errors
ℹ tests 9 e2e     | pass 9   | fail 0 | 0 errors
ℹ tests 5 cross   | pass 3   | fail 0 | 2 skipped (uninstalled local binaries)

=== MATRIX REPEATED PASS 3 ===
ℹ tests 143 unit | pass 143 | fail 0 | 0 errors
ℹ tests 9 e2e     | pass 9   | fail 0 | 0 errors
ℹ tests 5 cross   | pass 3   | fail 0 | 2 skipped (uninstalled local binaries)
```

---

## License

[MIT License](LICENSE) © PrimalJS Team
