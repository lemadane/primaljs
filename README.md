# PrimalJS

> **The Super Minimalists’ ReactJS**

PrimalJS is a lightweight, production-capable Single Page Application (SPA) framework built directly on modern browser JavaScript. Back to the fundamentals of web development — **JavaScript stays JavaScript**.

---

## Core PrimalJS Principles

- **Pure JavaScript**: Standard ECMAScript modules (`.js`) parsed directly by native browser engines.

- **Function Components Only**: Clean, predictable function components. No class components, no hook rules.

- **Native Tagged-Template Literals**: `html`...`` templates parsed directly using standard browser `<template>` elements.

- **No JSX Compiler**: Write pure template strings without Babel, SWC, or compilation steps.

- **No Transpiler**: Zero build steps required to run in production or development.

- **No Runtime JavaScript AST**: Native parsing without heavy runtime string-to-AST evaluators.

- **No Virtual DOM**: Real DOM nodes created once. Signal updates mutate target text and attributes directly.

- **No React-Style Reconciliation**: Avoid expensive tree diffing algorithms entirely.

- **No Component Re-Render for Ordinary Signal Changes**: Component functions execute **exactly once** on mount (`executions === 1`). Routine state updates never re-run component functions.

- **Signals Update the Smallest Possible Real-DOM Binding**: Fine-grained Signal writes pinpoint and update exact text nodes and attributes.

- **No Mandatory Node.js Runtime**: Runs anywhere without requiring Node.js on your production server.

- **No Mandatory Bundler**: Serve raw files without Webpack, Vite, Rollup, or Parcel.

- **Native Browser APIs Whenever Practical**: Leverage native `<template>`, `Comment` markers, `document.querySelector`, and `CustomEvent`.

- **Predictable Lifecycle and Cleanup**: Automatic disposal of event listeners, effect subscriptions, and DOM subtrees (`onMount`, `onDestroy`, `dispose()`).

- **Backend/Server Agnostic**: Serve static files from Nginx, Apache, Caddy, Go, Rust, Python, Django, PHP, Spring Boot, or static CDNs.

- **PWA Optional**: Built-in zero-dependency Service Worker registration and lifecycle management (`setupPwa`).

- **SEO First-Class**: Dynamic head metadata management (`head()`) updating `<title>`, `<meta>`, OpenGraph, and JSON-LD structured data.

- **Control Flow Helper Tags**: Declarative control flow (`<If>`, `<ElseIf>`, `<Else>`, `<Switch>`, `<Case>`, `<Default>`, `<For>`, `<Continue />`, `<Break />`, `<Try>`, `<Catch>`, `<Render>`, `<Async>`, `<Await>`, `<Pending>`).

- **KISS**: Keep It Simple, Stupid. Minimal abstraction, maximum clarity, and raw performance.

---

## How to Use PrimalJS in Other Projects

### Method 1: Installing via NPM (Node.js & Bundled Projects)

1. **Install PrimalJS in your project**:
   ```bash
   npm install primaljs
   ```

2. **Import and use in your application**:
   ```javascript
   import {
       createApp,
       createRouter,
       RouteOutlet,
       html,
       signal,
       computed,
       mount
   } from "primaljs";

   function App() {
       const count = signal(0);
       const doubled = computed(() => count.value * 2);

       return html`
           <main>
               <h1>Count: ${count} (Doubled: ${doubled})</h1>
               <button onclick=${() => count.value++}>Increment</button>
           </main>
       `;
   }

   mount(App, "#app");
   ```

---

### Method 2: Direct ES Module Import (Zero Build / No Node.js Required)

1. **Copy `primal.js` into your static asset folder**:
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
       <title>My PrimalJS Application</title>
   </head>
   <body>
       <div id="app"></div>
       <script type="module" src="./src/main.js"></script>
   </body>
   </html>
   ```

3. **Create your `src/main.js`**:
   ```javascript
   import { html, signal, mount } from "../js/primal.js";

   function Counter() {
       const count = signal(0);

       return html`
           <div>
               <h2>Count: ${count}</h2>
               <button onclick=${() => count.value++}>Increment</button>
           </div>
       `;
   }

   mount(Counter, "#app");
   ```

4. **Serve with any HTTP web server**:
   ```bash
   # Python
   python3 -m http.server 8000

   # Node static server
   npx serve .

   # Or serve directly via Nginx, Apache, or Caddy!
   ```

---

## Comprehensive Feature & API Guide

#### A. `signal()` — State Management (Shopping Cart Quantity)
```javascript
import { signal, html } from "primaljs";

// Create a reactive state holder
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

#### B. `computed()` — Derived State (E-Commerce Order Subtotal & Tax)
```javascript
import { signal, computed, html } from "primaljs";

const itemPrice = signal(49.99);
const quantity = signal(2);
const taxRate = signal(0.08); // 8% tax

// Computed value recalculates automatically when itemPrice, quantity, or taxRate changes
const orderTotal = computed(() => {
    const subtotal = itemPrice.value * quantity.value;
    const total = subtotal * (1 + taxRate.value);
    return total.toFixed(2);
});

function OrderSummary() {
    return html`
        <div class="summary">
            <p>Total: <strong>\$${orderTotal}</strong></p>
        </div>
    `;
}
```

#### C. `effect()` — Side Effects & Persistence (Dark Mode LocalStorage Sync)
```javascript
import { signal, effect } from "primaljs";

const theme = signal(localStorage.getItem("user_theme") || "dark");

// Synchronizes state to document.body and localStorage whenever theme.value changes
effect(() => {
    localStorage.setItem("user_theme", theme.value);
    document.body.className = `theme-${theme.value}`;
});
```

#### D. `batch()` — Multi-Field Atomic Updates (Form Reset)
```javascript
import { signal, batch } from "primaljs";

const username = signal("Lemuel");
const email = signal("lem@example.com");
const role = signal("admin");

function resetForm() {
    // Groups multiple signal writes into a single subscriber notification pass
    batch(() => {
        username.value = "";
        email.value = "";
        role.value = "user";
    });
}
```

#### E. `untrack()` — Silent Reading Without Dependency Subscription (Search Analytics)
```javascript
import { signal, computed, untrack } from "primaljs";

const searchQuery = signal("");
const currentCategory = signal("electronics");

// Re-evaluates when searchQuery changes, but reads currentCategory silently without subscribing to category mutations
const filteredProducts = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    const category = untrack(() => currentCategory.value);
    return products.filter(p => p.category === category && p.name.toLowerCase().includes(query));
});
```

#### F. `ref()` — Direct DOM Element Control (Auto-Focus Search Input)
```javascript
import { html, ref, onMount } from "primaljs";

function SearchModal() {
    const inputRef = ref();

    onMount(() => {
        // Access raw HTMLInputElement node directly after component mounts
        if (inputRef.current) {
            inputRef.current.focus();
        }
    });

    return html`
        <div class="modal">
            <input ref=${inputRef} type="text" placeholder="Search..." />
        </div>
    `;
}
```

### 2. Declarative Control Flow Helpers
```javascript
import { html, signal, If, For, Switch, Case, Default, Try, Catch, Await, Pending, Render } from "primaljs";

// Declarative Conditionals (<If>, <ElseIf>, <Else>)
const userRole = signal("admin");
const isPending = signal(false);

html`
    <If when=${() => isPending.value}>
        <div class="spinner">Authenticating user...</div>
        <ElseIf when=${() => userRole.value === "admin"}>
            <AdminPanel />
        </ElseIf>
        <ElseIf when=${() => userRole.value === "editor"}>
            <EditorPanel />
        </ElseIf>
        <Else>
            <GuestPanel />
        </Else>
    </If>
`

#### `<If>` / `<ElseIf>` / `<Else>`:

- **Reactive Branch Swapping Without Parent Re-renders**: Evaluates condition functions (`when=${...}`) reactively and swaps real DOM node ranges directly without re-executing the enclosing parent component function.

- **Automatic Lifecycle Cleanup**: When active branch switches, PrimalJS automatically disposes of unmounted branch contexts (`onDestroy` hooks, Signal effects, and event listeners).

// Keyed List Iteration (<For>, <Continue />, <Break />, <Else>)
const users = signal([
    { id: 101, name: "Lemuel", active: true, sysAdmin: false },
    { id: 102, name: "Sarah", active: true, sysAdmin: true },
    { id: 103, name: "Marcus", active: false, sysAdmin: false }
]);

html`
    <For each=${users} key=${u => u.id}>
        ${(user, index) => html`
            <!-- Skip rendering inactive users -->
            <Continue when=${() => !user.active} />

            <!-- Stop list iteration if sysAdmin found -->
            <Break when=${() => user.sysAdmin} />

            <div class="user-card">
                <span>#${index() + 1}: ${user.name}</span>
            </div>
        `}
        <Else>
            <p class="empty-msg">No active users available.</p>
        </Else>
    </For>
`

#### `<For>`:

- **Keyed DOM Identity Preservation**: Re-orders, inserts, or removes only altered item DOM nodes when the array mutates, keeping unchanged item DOM node instances intact.

- **Declarative Skip & Early Termination (`<Continue />` & `<Break />`)**: Controls iteration declaratively within template subtrees without manual `.filter()` array transformations.

- **Empty Collection Fallback (`<Else>`)**: Renders fallback DOM content automatically when the collection is empty (`length === 0`), `null`, or `undefined`.

- **Automatic Item Context Teardown**: Disposes of unmounted item contexts (`onDestroy` lifecycle hooks, event listeners, and Signals) when items are removed from the array.

// Branch Matching (<Switch>, <Case>, <Default>)
const status = signal("in_progress");

html`
    <Switch value=${status}>
        <Case value="completed">
            <span class="badge badge-success">Completed</span>
        </Case>
        <Case value=${["in_progress", "pending"]}>
            <span class="badge badge-warning">Processing...</span>
        </Case>
        <Case value=${v => typeof v === "number" && v > 100}>
            <span class="badge badge-info">High Priority (#${status})</span>
        </Case>
        <Default>
            <span class="badge badge-secondary">Unknown Status</span>
        </Default>
    </Switch>
`

#### `<Switch>`:

- **First-Match-Wins & No Fallthrough**: Unlike JavaScript `switch` statements, `<Switch>` uses clean first-match-wins order with zero risk of fallthrough errors and no `break` statements required.

- **Flexible Value & Predicate Matching**: Supports plain values, reactive Signals, arrays of values (`value=${["a", "b"]}`), and predicate functions (`value=${v => v > 10}`).

- **Zero Parent Component Re-execution**: Updates active DOM branch ranges directly without re-executing the surrounding component function.

// Declarative Asynchronous Controls (<Delay>, <Wait>, <Briefly>, <Failed>)
const userId = signal(1);

const fetchUserData = (id, { signal }) => {
    return fetch(`/api/users/${id}`, { signal }).then(res => res.json());
};

html`
    <!-- <Delay> automatically re-triggers when reactive Signals inside task change -->
    <Delay task=${({ signal }) => fetchUserData(userId.value, { signal })}>
        ${user => html`
            <div class="profile-card">
                <h3>${user.name}</h3>
                <p>Email: ${user.email}</p>
            </div>
        `}
        <Briefly>
            <div class="loading-state">Fetching user data...</div>
        </Briefly>
        <Failed>
            ${(err, retry) => html`
                <div class="error-state">
                    <p>Failed: ${err.message}</p>
                    <button onclick=${retry}>Retry Request</button>
                </div>
            `}
        </Failed>
    </Delay>
`

#### `<Delay>` & `<Wait>`:

- **`<Delay task=${...}>`**: Handles reactive async task factories (auto-retriggering when referenced Signals change, with automatic `AbortSignal` fetch cancellation).

- **`<Wait for=${...}>`**: Unwraps single Promise instances directly in templates.

- **`<Briefly>`**: Renders temporary loading placeholder UI while waiting for `<Delay>` or `<Wait>` to resolve.

- **`<Failed>`**: Renders error fallback UI and provides a `(err, retry)` recovery callback if the task or promise fails.

// Single Promise Unwrapping (<Wait>)
const analyticsPromise = fetch("/api/analytics").then(res => res.json());

html`
    <!-- <Wait> unwraps a single Promise instance directly -->
    <Wait for=${analyticsPromise}>
        ${data => html`
            <div class="stats-card">
                <h3>Total Visits: ${data.visits}</h3>
                <p>Conversions: ${data.conversions}</p>
            </div>
        `}
        <Briefly>
            <div class="spinner">Loading analytics...</div>
        </Briefly>
        <Failed>
            ${(err, retry) => html`
                <div>
                    <p>Failed: ${err.message}</p>
                    <button onclick=${retry}>Retry Request</button>
                </div>
            `}
        </Failed>
    </Wait>
`

// Dynamic Component Switcher (<Render>)
function OverviewTab(props) {
    return html`<div><h3>Overview Analytics</h3><p>User: ${props.user.name}</p></div>`;
}

function SettingsTab(props) {
    return html`<div><h3>Account Settings</h3><p>User: ${props.user.name}</p></div>`;
}

// Reactive Signal holding a component function
const activeTab = signal(OverviewTab);
const currentUser = signal({ name: "Lemuel" });

html`
    <div class="dashboard">
        <div class="tab-header">
            <button onclick=${() => activeTab.value = OverviewTab}>Overview</button>
            <button onclick=${() => activeTab.value = SettingsTab}>Settings</button>
        </div>

        <!-- Dynamically mounts activeTab component and passes reactive props directly -->
        <Render component=${activeTab} user=${currentUser} />
    </div>
`

#### `<Render>`:

- **Preserves Single Component Execution (`executions === 1`)**: In PrimalJS, component functions execute **exactly once** on initial mount and do not re-run on routine state changes. `<Render>` enables switching dynamic components or pages reactively when a Signal changes **without re-executing the parent layout/container function**.

- **Deterministic Teardown & Context Disposal**: When `component` changes, `<Render>` automatically cleans up the unmounted component's entire context tree (executes `onDestroy` hooks, unbinds event listeners, unsubscribes signals, and removes DOM nodes).

- **Foundation for Router Outlets & Dynamic Layouts**: `<Render>` powers `<RouteOutlet>`, dynamic tabbed interfaces, multi-step forms, and polymorphic plugin slots seamlessly.

// Declarative Error Boundaries (<Try>, <Catch>)
const hasError = signal(false);

function FragileComponent() {
    if (hasError.value) {
        throw new Error("Failed to render widget content!");
    }
    return html`<div class="widget">Widget Content Loaded</div>`;
}

html`
    <Try>
        <FragileComponent />
        <Catch>
            ${(err, reset) => html`
                <div class="error-box">
                    <p>Exception: ${err.message}</p>
                    <button onclick=${() => {
                        hasError.value = false;
                        reset(); // Resets boundary and remounts protected component
                    }}>
                        Reset Component
                    </button>
                </div>
            `}
        </Catch>
    </Try>
`

#### `<Try>` / `<Catch>`:

- **Prevents Full-Application Crashes**: Wraps render errors, lifecycle `onMount` failures, and reactive Signal compute exceptions inside protective DOM boundaries.

- **Graceful Recovery (`reset()`)**: The `<Catch>` callback receives `(err, reset)`, allowing users to recover state and remount subtrees cleanly without page reloads.

- **Hierarchical Error Propagation**: Nearest nested `<Try>` catches errors first. Uncaught errors escalate up to parent `<Try>` boundaries or `createApp({ onError })`.

- **Partial Teardown Safety**: Immediately cleans up partially rendered DOM nodes, event listeners, and Signal subscriptions if an exception fires mid-mount.

---

### 3. Client-Side SPA Router & Layouts (`createRouter`, `<RouteOutlet>`)

Here is a complete, real-life Single Page Application router example featuring nested layouts, dynamic route parameters (`/users/:id`), route guards (`beforeEnter`), programmatic navigation (`navigate()`), and dynamic SEO head metadata:

```javascript
import {
    createApp,
    createRouter,
    RouteOutlet,
    useRoute,
    navigate,
    head,
    html,
    signal,
    register
} from "primaljs";

// 1. Reactive Auth State for Route Guard
const isAuthenticated = signal(false);

// 2. Route Guard Function (Redirects unauthenticated users to /login)
function authGuard(to) {
    if (!isAuthenticated.value) {
        console.warn("Unauthorized access to:", to.path);
        return "/login"; // Redirect path
    }
    return true; // Proceed to route
}

// 3. Main Persistent Layout (Keeps layout DOM untouched across child page transitions)
function AppLayout() {
    return html`
        <div class="app-layout">
            <header class="navbar">
                <nav>
                    <a href="/">Dashboard</a>
                    <a href="/users/101">User Profile (#101)</a>
                    <a href="/settings">Settings (Protected)</a>
                </nav>
            </header>
            <main class="page-content">
                <!-- <RouteOutlet /> acts as the placeholder for active child route components -->
                <RouteOutlet />
            </main>
        </div>
    `;
}

// 4. Page Components
function DashboardPage() {
    head({
        title: "Dashboard | PrimalJS App",
        meta: [{ name: "description", content: "Overview dashboard analytics." }]
    });

    return html`<h2>Dashboard Overview</h2>`;
}

function UserProfilePage() {
    const route = useRoute(); // Access dynamic route params reactively (:id)

    head({
        title: `User #${route.params.id} Profile`,
        meta: [{ name: "description", content: `User profile page for ID ${route.params.id}` }]
    });

    return html`
        <div class="profile-page">
            <h2>User Profile</h2>
            <p>User ID: <strong>${() => route.params.id}</strong></p>
            <button onclick=${() => navigate("/")}>Return to Dashboard</button>
        </div>
    `;
}

function SettingsPage() {
    head({ title: "Settings | PrimalJS App" });
    return html`<h2>Account Settings (Protected Area)</h2>`;
}

function LoginPage() {
    head({ title: "Login | PrimalJS App" });

    function handleLogin() {
        isAuthenticated.value = true;
        navigate("/settings"); // Navigate programmatically after login
    }

    return html`
        <div class="login-page">
            <h2>Please Log In</h2>
            <button onclick=${handleLogin}>Log In as Admin</button>
        </div>
    `;
}

// Register custom components used in tagged templates
register(AppLayout, DashboardPage, UserProfilePage, SettingsPage, LoginPage, RouteOutlet);

// 5. Create Router Configuration
const router = createRouter({
    routes: [
        {
            path: "/",
            component: AppLayout,
            children: [
                { path: "", component: DashboardPage },
                { path: "users/:id", component: UserProfilePage },
                { path: "settings", component: SettingsPage, beforeEnter: authGuard },
                { path: "login", component: LoginPage }
            ]
        }
    ]
});

// 6. Mount Application
const app = createApp({
    router,
    dev: true,
    onError(err) {
        console.error("Global Router Error:", err);
    }
});

app.mount("#app");
```

#### Key Router Capabilities & Architectural Benefits:

- **Layout Preservation**: Navigating child routes (`/` -> `/users/101`) swaps only the `<RouteOutlet />` content without re-executing or destroying the parent `<AppLayout />` DOM instance.

- **Dynamic Route Params (`useRoute()`)**: Extract URL parameters (like `:id`) reactively.

- **Route Guards & Redirects (`beforeEnter`)**: Protect routes by returning a boolean or string redirect path.

- **Integrated SEO (`head()`)**: Dynamically updates document `<title>`, `<meta>`, canonical links, and JSON-LD structured data on route transitions.

---

### 4. Zero-Dependency PWA Management (`setupPwa`, `unregisterServiceWorkers`)

PrimalJS provides built-in PWA service worker registration and cleanup management without third-party libraries:

```javascript
import { setupPwa, unregisterServiceWorkers } from "primaljs";

// --- Enable PWA Support & Worker Registration ---
setupPwa({
    swPath: "./sw.js",
    updateStrategy: "prompt",
    onUpdateAvailable() {
        if (confirm("A new update is available. Reload app to apply?")) {
            window.location.reload();
        }
    }
});

// --- Disable PWA & Unregister Workers / Clear Caches ---
function disablePwa() {
    // Unregisters service worker script and deletes associated 'primal-' cache stores safely
    unregisterServiceWorkers("./sw.js");
}
```

#### PWA Management Capabilities:

- **Zero Runtime Dependencies**: Native Service Worker registration and event listeners.

- **Update Detection (`updateStrategy: "prompt"`)**: Notifies application when an updated Service Worker is waiting (`onUpdateAvailable`).

- **Safe Teardown (`unregisterServiceWorkers`)**: Safely unregisters PrimalJS service workers and purges `primal-` cache entries without touching unrelated third-party workers.

---

### 5. SEO Safety & Dynamic Head Metadata (`head()`, `activate()`)

PrimalJS is engineered to be **100% SEO safe** out of the box for both search engines (Googlebot, Bingbot) and social media crawlers (OpenGraph, Twitter Cards).

#### A. Dynamic Head Metadata (`head()`) Sample Code:

```javascript
import { html, head, signal } from "primaljs";

function ProductDetail({ product }) {
    // Dynamically manages document title, meta tags, OpenGraph, canonical links, and JSON-LD
    head({
        title: `${product.name} - \$${product.price} | My Store`,
        meta: [
            { name: "description", content: product.description },
            { property: "og:title", content: product.name },
            { property: "og:image", content: product.imageUrl },
            { name: "twitter:card", content: "summary_large_image" }
        ],
        link: [
            { rel: "canonical", href: `https://example.com/products/${product.id}` }
        ],
        script: [
            {
                type: "application/ld+json",
                content: JSON.stringify({
                    "@context": "https://schema.org/",
                    "@type": "Product",
                    "name": product.name,
                    "image": [product.imageUrl],
                    "description": product.description,
                    "offers": {
                        "@type": "Offer",
                        "price": product.price,
                        "priceCurrency": "USD"
                    }
                })
            }
        ]
    });

    return html`
        <article class="product-card">
            <h1>${product.name}</h1>
            <p>${product.description}</p>
            <span class="price">\$${product.price}</span>
        </article>
    `;
}
```

#### B. Pre-rendered HTML Activation (`activate()`) Sample Code:

```javascript
import { activate } from "primaljs";

// Server serves static pre-rendered HTML containing comment markers (e.g., <!--primal-ph-0-->)
// Client browser executes activate() to attach Signals and event listeners WITHOUT clearing innerHTML
activate(ProductDetail, "#app");
```

#### Why PrimalJS is 100% SEO Safe:

1. **True Pre-Render DOM Activation (`activate()`)**:
   Search engine crawlers receive fully formed, semantic HTML directly in the initial HTTP response. When client JavaScript executes `activate(App, "#app")`, PrimalJS locates deterministic markers (`<!--primal-ph-N-->`) and attaches behavior to the **existing DOM nodes** without clearing `innerHTML` or causing layout flashes.

2. **First-Class Dynamic Head Management (`head()`)**:
   Single Page Applications often suffer from stale metadata. `head()` dynamically updates document `<title>`, meta descriptions, OpenGraph cards, canonical links, and JSON-LD structured data on route transitions, automatically purging old route metadata.

3. **Pure Semantic HTML5 Output**:
   PrimalJS generates pure HTML5 element trees directly in the DOM without proprietary Virtual DOM wrapper elements, synthetic event wrappers, or custom non-standard markup.

---

## Architecture & Verification

PrimalJS includes a comprehensive automated test suite verifying strict architectural guarantees:

- **Component Execution Count**: Components execute **exactly once** (`executions === 1`) on mount and never re-execute on Signal changes.

- **DOM Identity Preservation**: Target DOM element instances remain untouched when state mutates.

- **Root Disposal**: `mount()` returns `{ dispose() }` for idempotent teardown of DOM nodes, event listeners, and reactive subscriptions.

Run the test suite:
```bash
npm test
```

---

## License

MIT License
