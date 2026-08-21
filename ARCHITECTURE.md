# PrimalJS Architecture & Technical Design

**Tagline:** PrimalJS — Minimalists’ ReactJS  
**Core Philosophy:** Back to the fundamentals of JavaScript.

---

## 1. Core Principles & Philosophy

PrimalJS is a lightweight, modern JavaScript single-page application framework built around browser-native standards. It delivers a React-like function component developer experience while completely eliminating framework overhead:

- **No Virtual DOM**: Real DOM nodes created once and updated directly.
- **No Compiler / Transpiler**: Pure native ECMAScript modules and tagged-template literals.
- **No Runtime AST**: Operates directly via native browser template parsing (`<template>`) and tagged-template literal arrays.
- **Fine-Grained Reactivity**: Signals bind directly to specific DOM text nodes or attributes.
- **No Component Rerendering**: Component functions run **once** during instantiation. State updates mutate target DOM nodes directly (`executions === 1`).
- **Backend Independent**: Zero Node.js production server dependency. Can be served as static files from any web server (Nginx, Caddy, Spring Boot, Go, PHP, Django, static CDN).

---

## 2. Shared Ownership & Resource Disposal Tree (`Owner`)

All PrimalJS components, dynamic component switcher regions, router views, and async operations participate in a unified `Owner` hierarchy:

```text
Application Root Owner (MountedApp)
   ├── Component Owner
   │     ├── Signals / Computed / Effects
   │     ├── Event Listeners & Ref Bindings (ref.current = null on disposal)
   │     └── Child Owners (<Load>, <RouteOutlet>)
   └── Router Owner
```

- **Root Disposal (`app.dispose()`)**: `mount(Component, target)` returns `{ dispose() }`. Recursively disposes all child contexts, reactive effects, event listeners, refs (`ref.current = null`), and DOM anchors. Idempotent and supports clean re-mounting.
- **Deterministic Teardown**: Subtree replacements cleanly dismantle superseded DOM nodes and subscriptions without orphaned references or memory leaks.

---

## 3. Reactivity & Advanced Controls

```text
Signal / Computed Write
        ↓
    batch(fn)?
   ├── Depth > 0: Accumulate subscribers in deduplicated batch queue
   └── Depth === 0: Flush all subscribers immediately
        ↓
Micro-Mutation on target Text / Attribute / Property
```

- **Signals (`signal(val)`)**: Fine-grained reactive values.
- **Computed (`computed(fn)`)**: Auto-tracked derived values.
- **Effects (`effect(fn)`)**: Auto-tracked reactive side-effects with optional cleanup returns.
- **`batch(fn)`**: Groups multiple Signal writes into a single subscriber notification pass upon completion of the outermost batch. Handles nesting and `try/finally` error recovery.
- **`untrack(fn)`**: Evaluates `fn()` without registering accessed Signals as reactive dependencies. Returns `fn()`'s result cleanly.

---

## 4. Native SVG & Web Components Compatibility

- **SVG Support**: SVG elements inside `<svg>` are instantiated in the `http://www.w3.org/2000/svg` namespace. `<foreignObject>` subtrees seamlessly transition back to standard HTML namespace `http://www.w3.org/1999/xhtml`. SVG attribute casing (e.g. `viewBox`, `preserveAspectRatio`) is strictly preserved with fine-grained reactive updates.
- **Web Components / Custom Elements**: Elements with hyphens (e.g. `<my-date-picker>`) work natively without PrimalJS component registration. Non-primitive prop values (objects, arrays, functions) are assigned directly as DOM properties (`el.options = obj`). Event listeners (`ondatechange=${handler}`) pass the native `CustomEvent` directly.

---

## 5. Dynamic Component Switcher

PrimalJS uses standard JavaScript control logic (`ternary`, `if/else`, `.map()`, `try/catch`) and provides dynamic component rendering via native tagged templates without Virtual DOM:

- **Component Switcher (`<Load>`)**: Declarative dynamic component switching in native tagged templates (`<Load component=${page} />`). Note: `<Load>` is the declarative template component tag, distinct from the imperative application mounting function `mount(Component, target)`.

---

## 6. Client-Side SPA Router & Layout Preservation

- **Native History API**: Built directly on `history.pushState()`, `history.replaceState()`, and `popstate` events.
- **Nested Routes & Layouts**: Route hierarchy support (`children: [...]`) and declarative `<RouteOutlet>` placeholder.
- **Layout DOM Preservation**: Navigating child routes (e.g. `/dashboard/users` -> `/dashboard/settings`) keeps parent layout DOM instances and component state 100% untouched. Only the `<RouteOutlet>` owned region is updated!
- **Lifecycle & Navigation Controls**:
  - Scroll restoration & hash anchors (`#section`)
  - Route guards (`beforeEnter`) with stale navigation token protection
  - Route redirects (`redirect: "/login"`) with loop protection
  - Same-route parameter updates without component teardown
  - Focus management (`focus: "#title"`)
- **SEO & Head Metadata (`head()`)**: Dynamically updates `<title>`, `<meta name="description">`, `<meta name="robots">`, `<link rel="canonical">`, OpenGraph tags, and JSON-LD structured data (`<script type="application/ld+json">`).

---

## 7. Diagnostics & Global Error Boundaries

- **Development Diagnostics (`dev: true`)**: `PrimalJSError` class and diagnostic validations providing actionable error messages for structural misuse, duplicate keys, or invalid routes.
- **Global Error Boundary (`createApp({ root, onError })`)**: `onError(err, context)` callback catching unhandled errors escaping local UI boundaries with light context (`{ type, component, route, owner }`).

---

## 8. Technical Proof: No Virtual DOM

| Feature | Virtual DOM Frameworks (React, Preact) | PrimalJS |
| :--- | :--- | :--- |
| **Node Storage** | In-memory tree of JS objects (`VNode` / Fiber) | Real browser DOM nodes directly |
| **State Update** | Component function re-executes → returns new VNode tree | Signal subscriber updates specific DOM node |
| **Control Flow** | Map or ternary in JSX reruns component tree | Standard JS (`ternary`, `.map()`) with fine-grained real DOM updates |
| **Reconciliation** | Diff old VNode tree vs new VNode tree | Direct Real DOM updates without VNode diffing |
| **DOM Touch** | Batch-patched after VNode diff | Micro-mutation on exact target `Text` / `Attribute` / `Range` |
