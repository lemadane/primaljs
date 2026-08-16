# PrimalJS

**The Super Minimalists’ ReactJS**

> PrimalJS is a lightweight, production-capable SPA framework built directly on native browser JavaScript. Function components, tagged HTML templates, fine-grained Signals, direct DOM reactivity, declarative control flow (`<If>`, `<Switch>`, `<For>`, `<Try>`, `<Render>`, `<Async>`, `<Await>`), client-side Router, nested layouts (`<RouteOutlet>`), SVG namespace support, Web Components compatibility, development diagnostics (`dev: true`), SEO metadata management, DOM activation (`activate()`), and optional PWA support. No Virtual DOM. No compiler. No transpiler. No TypeScript required. No mandatory Node.js server.

**Back to the fundamentals of JavaScript.**  
**JavaScript stays JavaScript.**  
**Serve it from anything.**

---

## Key Features

- **Pure Native JavaScript**: Write ordinary ECMAScript modules (`.js`) without JSX, Babel, SWC, TypeScript, Vite, Webpack, or transpilation.
- **Function Components Only**: Clean, predictable function components. No class components, no hook rules.
- **Native Tagged-Template Literals**: `html`...`` templates parsed directly by native browser `<template>` parser.
- **Fine-Grained Signals & Batching**: Direct real DOM text node and attribute binding updates. `batch(fn)` deduplicates subscriber writes, `untrack(fn)` reads Signals without dependency collection.
- **Root Application Disposal**: `mount()` returns `{ dispose() }`. Completely teardowns components, reactive effects, Signal subscriptions, event listeners, refs (`ref.current = null`), and DOM nodes. Idempotent and clean re-mounting support.
- **Native SVG & Web Components Compatibility**: Automatic SVG namespace creation (`http://www.w3.org/2000/svg`), viewBox casing, and `<foreignObject>` HTML subtrees. Web components pass props directly as DOM properties and custom events to handlers.
- **Declarative Control Flow**: Native `<If>`, `<ElseIf>`, `<Else>`, `<Switch>`, `<Case>`, `<Default>`, `<For>`, `<Continue />`, `<Break />`, `<Try>`, `<Catch>`, `<Render>`, `<Async>`, `<Await>`, and `<Pending>` control-flow components without Virtual DOM or parent component re-renders.
- **Client-Side SPA Router & Nested Layouts**: `createRouter({ routes })` with route hierarchy (`children: [...]`), `<RouteOutlet>` placeholder, layout DOM preservation (navigating child routes keeps parent layout DOM instance untouched), parameter matching (`/users/:id`), route guards (`beforeEnter`), redirects, scroll restoration, hash navigation, and focus management.
- **Development Diagnostics & Global Error Handling**: `createApp({ dev: true, onError })` with `PrimalJSError` providing actionable error messages for structural misuse, duplicate keys, or uncaught exceptions.
- **SEO & Head Metadata Management**: `head()` updates `<title>`, `<meta>`, `<link canonical>`, OpenGraph, and JSON-LD structured data dynamically.
- **Prerender DOM Activation**: `activate(App, "#app")` attaches behavior directly to existing pre-rendered HTML without Virtual DOM tree diffing.
- **Optional Zero-Dependency PWA**: Service worker registration, offline shell caching, and manifest handling.
- **Zero Virtual DOM**: Real DOM nodes created once. Signal updates mutate target DOM nodes directly.
- **Component Runs Once**: Routine state changes do **not** re-execute component functions (`executions === 1`).
- **Zero Production Server Requirements**: Serve static `index.html`, `app.js`, `app.css`, `primal.js` from Nginx, Apache, Caddy, Spring Boot, Go, PHP, Django, ASP.NET, or static CDNs.

---

## Quick Start

### Direct Browser Load (No Build Step Required)

`index.html`:
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>PrimalJS App</title>
</head>
<body>

<div id="app"></div>

<script type="module" src="./app.js"></script>

</body>
</html>
```

`app.js`:
```javascript
import {
    html,
    signal,
    batch,
    mount
} from "./primal.js";

function App() {
    const count = signal(0);
    const text = signal("Hello");

    function updateBoth() {
        batch(() => {
            count.value++;
            text.value = "Updated";
        });
    }

    return html`
        <main>
            <h1>${text} PrimalJS</h1>
            <button onclick=${updateBoth}>
                Count: ${count}
            </button>
        </main>
    `;
}

const app = mount(App, "#app");
// Later: app.dispose();
```

---

## Core API Reference

### Reactivity, Batching & Refs
```javascript
import { signal, computed, effect, batch, untrack, ref } from "./primal.js";

const count = signal(0);
const multiplier = signal(2);

const doubled = computed(() => count.value * multiplier.value);

batch(() => {
    count.value = 5;
    multiplier.value = 3;
});

const isPositive = untrack(() => count.value > 0);

const inputRef = ref();
// In template: <input ref=${inputRef}>
// After mount: inputRef.current.focus()
```

### Declarative Control Flow
```javascript
import { html, signal, If, For, Switch, Try, Render, Async, Await, Pending, Catch } from "./primal.js";

// Conditional
html`<If when=${loggedIn}><Dashboard /><Else><Login /></Else></If>`

// Keyed Loop
html`<For each=${users} key=${u => u.id}>${u => html`<UserCard user=${u} />`}</For>`

// Dynamic Component Switcher
html`<Render component=${activePage} />`

// Async Data Awaiter
html`
    <Await promise=${({ signal }) => fetchUser(id, { signal })}>
        ${user => html`<UserCard user=${user} />`}
        <Pending><p>Loading...</p></Pending>
        <Catch>${(err, retry) => html`<button onclick=${retry}>Retry</button>`}</Catch>
    </Await>
`
```

### Router & Nested Layouts
```javascript
import { createApp, createRouter, RouteOutlet, head } from "./primal.js";

function MainLayout() {
    return html`
        <div id="layout">
            <nav><a href="/dashboard">Dashboard</a></nav>
            <main><RouteOutlet /></main>
        </div>
    `;
}

const router = createRouter({
    routes: [
        {
            path: "/dashboard",
            component: MainLayout,
            children: [
                { path: "", component: DashboardHome },
                { path: "users", component: UsersPage, beforeEnter: (route) => checkAuth(route) }
            ]
        }
    ]
});

const app = createApp({
    router,
    dev: true,
    onError(err, ctx) {
        console.error("Global Error:", err, ctx);
    }
});

app.mount("#app");
```

---

## Architecture Guarantees & Verification

PrimalJS includes mandatory unit tests verifying fundamental architectural guarantees:

1. **DOM Identity Test**: Verifies `headingBefore === headingAfter` when signals update or boundaries trigger.
2. **Component Execution Test**: Verifies component function executes exactly once (`executions === 1`) on mount and never re-executes on state changes, error boundary resets, or async state transitions.
3. **Declarative Control-Flow & Integration Test Suites**:
   - `test/batch_untrack.test.js` (`batch()`, `untrack()`)
   - `test/root_disposal.test.js` (`app.dispose()`, idempotency, re-mounting)
   - `test/svg_custom_elements.test.js` (SVG namespace, `viewBox`, Web Components)
   - `test/router_nested.test.js` (Nested routes, `<RouteOutlet>`, layout preservation, guards)
   - `test/diagnostics_global_error.test.js` (`PrimalJSError`, `createApp({ onError })`)
   - `test/e2e.test.js` (Puppeteer real browser suite)

Run automated test suite:
```bash
npm test
```

---

## License

MIT
