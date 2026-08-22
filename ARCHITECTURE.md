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
   │     └── Child Owners (<Load>, <Guard>, <Place>, <WithinView>, <Animate>, <RouteOutlet>)
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

## 5. Reactive Control Flow & Keyed List Reconciliation

PrimalJS enforces single component execution (`executions === 1`). Routine state updates never re-evaluate component functions.

- **Static vs. Reactive Control Flow**: Standard JavaScript expressions (`if`, `map`) outside arrow functions execute **once on mount**. Wrap reactive conditions or list mappings in arrow functions `${() => ...}` so Signal reads subscribe to fine-grained DOM updates.
- **Keyed List DOM Reconciliation**: Array maps returned from reactive functions `${() => list.value.map(...)}` reconcile DOM nodes by item key (`key=${item.id}`), `item.key`, `item.id`, or reference identity. Existing DOM nodes are preserved and updated in-place, preserving input focus, text selection, scroll position, and child component state.
- **Component Switcher (`<Load>`)**: Declarative dynamic component switching in native tagged templates (`<Load component=${page} />`). Note: `<Load>` is the declarative template component tag, distinct from the imperative application mounting function `mount(Component, target)`.

---

## 6. Declarative DOM Lifecycle Animation & Deferred Destruction (`<Animate>`)

```text
ENTERING Phase:
   DOM attached ──> enter class applied ──> animationend ──> ACTIVE Phase

LEAVING Phase:
   open.value = false ──> DOM kept alive ──> ComponentContext alive ──> leave class applied ──> animationend ──> DESTROYED

INTERRUPTED LEAVE Cancellation:
   LEAVING ──> open.value = true ──> remove leave class ──> restore ACTIVE (same DOM identity, same ComponentContext)
```

- **Deferred Destruction on Leave**: When a child subtree becomes inactive (`open.value = false`), `<Animate leave="fade-out">` keeps the DOM nodes and `ComponentContext` fully alive in the document, applies the `leave` CSS class, listens for `animationend` / `transitionend` (or duration fallback), and only then destroys the context (`destroyContext`), runs `onDestroy` hooks, and removes DOM nodes.
- **Interrupted Leave & Cancellation**: Re-activating content before leave finishes cancels the leave operation, removes the `leave` class, and preserves DOM node identity (`before === after`).
- **No Cloned DOM**: Operates directly on real owned DOM nodes without `cloneNode()`.

---

## 7. Declarative Subtree Preservation & DOM Caching (`<Keep>`)

```text
ACTIVE State:
   DOM attached in document ──> ComponentContext alive ──> reactive effects running

KEPT State:
   navigated away ──> DOM range detached into KeepCache DocumentFragment ──> ComponentContext alive ──> reactive effects running in background ──> onDestroy NOT executed

DESTROYED State:
   <Keep> unmounted or LRU eviction ──> destroyContext ──> onDestroy executed ──> effects disposed ──> DOM permanently removed
```

- **Separation of Attachment & Ownership**: DOM attachment state and component ownership state are separate concepts. A component can be detached from visible DOM while remaining 100% logically alive.
- **Identity Preservation**: Component functions execute **ONLY ONCE** (`executions === 1`). `onMount` runs **ONLY ONCE**. Restoring a kept view re-inserts its preserved DOM fragment without re-instantiating the component.
- **Background Reactivity**: Kept components remain alive. Signals and effects continue updating detached DOM nodes in the background, so restored views immediately reflect current reactive state.
- **LRU Capacity (`max`)**: Supports optional `<Keep max=${N}>` LRU capacity eviction.

---

## 8. Declarative Keyboard Focus Management & Accessibility (`<Focus>`)

```text
INACTIVE State:
   subtree unmounted ──> no event listeners ──> no focus trap

ACTIVE State:
   subtree mounted ──> previous activeElement captured ──> autofocus executed ──> keydown & focusin listeners attached ──> focusStack top

NESTED-SUSPENDED State:
   nested child <Focus> mounted ──> child becomes focusStack top ──> outer trap pauses enforcement until nested modal closes

DESTROYED State:
   unmounted ──> listeners detached ──> focusStack popped ──> previous activeElement focus restored (if connected)
```

- **Physical DOM Range Focus**: Operates on physical DOM nodes bounded by `startAnchor` and `endAnchor`, working transparently across `<Place to="#target">` portals.
- **Autofocus Priority**: `[autofocus]` $\rightarrow$ `initial` selector/ref $\rightarrow$ first tabbable element $\rightarrow$ root range container.
- **Focus Stack**: Stack-based scope model (`focusStack`) isolates nested modals without parent/child trap conflicts.

---

## 9. Declarative Browser Idle Scheduling & Deferred Mounting (`<OnIdle>`)

```text
WAITING State:
   <OnIdle> mounted ──> owner alive ──> child NOT created (0 executions) ──> idle callback registered (requestIdleCallback)

ACTIVATED State:
   browser becomes idle ──> child component function executes (1 execution) ──> child ComponentContext created & mounted ──> onMount runs ──> permanently active

DESTROYED State:
   parent unmounted before idle ──> cancelIdleCallback called ──> child NEVER created ──> 0 orphan contexts
```

- **Deferred Creation Guarantee**: Child components are **NOT** instantiated during initial render (`executions === 0`).
- **`requestIdleCallback` Integration**: Feature-detects `window.requestIdleCallback(cb, { timeout })` with non-blocking fallback (`setTimeout(fn, 1)`). `timeout` specifies maximum wait time before forced eligibility (not an error).
- **Logical Ownership**: Delayed child context is attached directly to declaring parent owner context, preserving `<Guard>` error handling.

---

## 10. Declarative Viewport Lifecycle & Lazy Component Mounting (`<WithinView>`)

```text
Before Viewport Intersection:

Page Context
 └── WithinView (Placeholder <div data-primal-within-view style="min-height: 400px">)
      (HeavyChart function has NOT executed; 0 onMount calls, 0 effects)

After Viewport Intersection (isIntersecting === true):

Page Context
 └── WithinView Context
      └── HeavyChart Context (Component function executes; onMount runs; DOM attached)
```

- **Lazy Instantiation Guarantee**: Child component functions (`<HeavyChart />`) passed inside `<WithinView>` are **NOT executed eagerly**. They are instantiated and mounted only after the viewport intersection condition is satisfied.
- **Native `IntersectionObserver` Integration**: Watches a lightweight observation placeholder using `IntersectionObserver` with customizable `margin` (`rootMargin`, e.g. `"200px"`), `threshold` (`0`), `minHeight` (`"400px"`), and `fallback` UI.

---

## 11. Declarative Portal & Logical Ownership (`<Place>`)

```text
Logical PrimalJS Ownership Tree:

Page Context
 └── Place Context
      └── ConfirmDialog Context (onMount, onDestroy, effects, listeners)

Physical DOM Location:

<div id="app">
    <div class="page"><!--primal:place:start--><!--primal:place:end--></div>
</div>

<div id="modal-root">
    <div class="confirm-dialog">...</div>
</div>
```

- **DOM Hierarchy != Ownership Hierarchy**: `<Place to="#target">` physically attaches real DOM nodes into another target container while keeping that content **100% logically owned** by the declaring component context.

---

## 12. Zero-Build Standalone Distribution Bundle

- **ESM Exports**: Core modules in `src/` export native ESM modules.
- **Zero-Build Distribution (`dist/primal.standalone.js`)**: `npm run build` produces a standalone zero-dependency ES module bundle incorporating all framework core primitives. Applications can be served statically with a single `import { ... } from "./js/primal.standalone.js"` without Node.js, npm, or build tools in production.

---

## 13. Client-Side SPA Router & Layout Preservation

- **Native History API**: Built directly on `history.pushState()`, `history.replaceState()`, and `popstate` events.
- **Nested Routes & Layouts**: Route hierarchy support (`children: [...]`) and declarative `<RouteOutlet>` placeholder.
- **Layout DOM Preservation**: Navigating child routes (e.g. `/dashboard/users` -> `/dashboard/settings`) keeps parent layout DOM instances and component state 100% untouched. Only the `<RouteOutlet>` owned region is updated!
- **SEO & Head Metadata (`head()`)**: Dynamically updates `<title>`, `<meta name="description">`, `<meta name="robots">`, `<link rel="canonical">`, OpenGraph tags, and JSON-LD structured data (`<script type="application/ld+json">`).

---

## 14. Diagnostics & Local/Global Error Boundaries

- **Local Error Boundary (`<Guard>` / `<Boundary>`)**: Subtree error boundary component (`<Guard fallback=${...}>`) catching errors thrown during child component mounting or reactive effect updates. Restricts component failure locally without crashing parent layout or app state.
- **Development Diagnostics (`dev: true`)**: `PrimalJSError` class and diagnostic validations providing actionable error messages for structural misuse, duplicate keys, missing `<Place>` targets, or invalid routes.
- **Global Error Boundary (`createApp({ root, onError })`)**: `onError(err, context)` callback catching unhandled errors escaping local UI boundaries with light context (`{ type, component, route, owner }`).

---

## 15. Technical Proof: No Virtual DOM

| Feature | Virtual DOM Frameworks (React, Preact) | PrimalJS |
| :--- | :--- | :--- |
| **Node Storage** | In-memory tree of JS objects (`VNode` / Fiber) | Real browser DOM nodes directly |
| **State Update** | Component function re-executes → returns new VNode tree | Signal subscriber updates specific DOM node |
| **Control Flow** | Map or ternary in JSX reruns component tree | Standard JS (`ternary`, `.map()`) with fine-grained real DOM updates |
| **Garbage Collection** | Sweeps discarded VNode objects continuously | Real DOM nodes cleaned up directly on owner disposal |
| **Reconciliation** | Diff old VNode tree vs new VNode tree | Direct Real DOM updates without VNode diffing |
| **DOM Touch** | Batch-patched after VNode diff | Micro-mutation on exact target `Text` / `Attribute` / `Range` |

---

## 16. Lifecycle-Aware JavaScript DOM Helpers (`onKey()`, `scrollLock()`, `onOutsideClick()`)

PrimalJS DOM helpers provide explicit JavaScript APIs to automate owner lifecycle binding without creating template components or altering normal control flow.

- **`onKey()`**: Listens to keyboard events on `document` or scoped targets (`Element`, `ref`), filtering key codes, modifier keys (`ctrl`, `shift`, `alt`, `meta`), and editable input elements (`ignoreEditable`). Listener detaches automatically on owner context disposal.
- **`scrollLock()`**: Reference-counted (`lockCount`) scroll locker preventing page scrolling while preserving inline `overflow` styles and scrollbar layout width offsets. Unlocks automatically on owner context disposal.
- **`onOutsideClick()`**: Detects pointer interactions outside single or array targets (`[triggerRef, menuRef]`) using `composedPath()` in capture phase, enabling seamless outside-click handling for `<Place>` portals. Listener detaches automatically on owner context disposal.
