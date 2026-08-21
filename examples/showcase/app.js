// @ts-nocheck
import {
    html,
    signal,
    computed,
    ref,
    register,
    createApp,
    createRouter,
    RouteOutlet,
    head,
    onMount
} from "../../primal.js";

// --- Global Reactive State ---
const searchQuery = signal("");
const activeTab = signal("all");

const mockUsers = signal([
    { id: 1, name: "Lemuel Adane", role: "Lead Architect", status: "active" },
    { id: 2, name: "Sarah Chen", role: "Senior Frontend Engineer", status: "active" },
    { id: 3, name: "Alex Rivera", role: "DevOps Lead", status: "away" },
    { id: 4, name: "Elena Rostova", role: "Product Designer", status: "active" },
    { id: 5, name: "Marcus Vance", role: "QA Automation Engineer", status: "offline" }
]);

const filteredUsers = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    const tab = activeTab.value;
    return mockUsers.value.filter(u => {
        const matchesQuery = !query || u.name.toLowerCase().includes(query) || u.role.toLowerCase().includes(query);
        const matchesTab = tab === "all" || u.status === tab;
        return matchesQuery && matchesTab;
    });
});

// --- Components ---

function HeaderNav() {
    return html`
        <header>
            <div class="nav-container">
                <div class="logo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                        <polyline points="2 17 12 22 22 17"></polyline>
                        <polyline points="2 12 12 17 22 12"></polyline>
                    </svg>
                    PrimalJS Showcase
                </div>
                <nav>
                    <ul>
                        <li><a href="/">Dashboard</a></li>
                        <li><a href="/users">Users List (${() => filteredUsers.value.length})</a></li>
                        <li><a href="/async">Async Loader</a></li>
                    </ul>
                </nav>
            </div>
        </header>
    `;
}

function MainLayout() {
    return html`
        <div>
            <HeaderNav />
            <div class="app-container">
                <RouteOutlet />
            </div>
        </div>
    `;
}

function DashboardPage() {
    head({
        title: "Dashboard | PrimalJS Showcase",
        meta: [{ name: "description", content: "Production-grade SPA Dashboard built with PrimalJS." }]
    });

    const counter = signal(0);
    const textInput = signal("Fine-Grained Binding");
    const inputRef = ref();

    const handleFocus = () => {
        if (inputRef.current) inputRef.current.focus();
    };

    return html`
        <div>
            <h1>Framework Dashboard</h1>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                Demonstrating fine-grained Signals, zero Virtual DOM, and 100% direct real DOM updates.
            </p>

            <div class="grid-2">
                <div class="card">
                    <h3>Signal Reactivity</h3>
                    <p style="margin: 1rem 0;">Counter Value: <strong>${counter}</strong></p>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn" onclick=${() => counter.value++}>Increment</button>
                        <button class="btn btn-secondary" onclick=${() => counter.value = 0}>Reset</button>
                    </div>
                </div>

                <div class="card">
                    <h3>Direct Input Binding & Ref</h3>
                    <input ref=${inputRef} class="input-field" value=${textInput} oninput=${(e) => textInput.value = e.target.value} placeholder="Type something..." />
                    <p style="margin-top: 0.75rem;">Bound Text: <em>${textInput}</em></p>
                    <button class="btn btn-secondary" style="margin-top: 0.75rem;" onclick=${handleFocus}>Focus Input via Ref</button>
                </div>
            </div>
        </div>
    `;
}

function UsersPage() {
    head({ title: "Users | PrimalJS Showcase" });

    return html`
        <div>
            <h2>User Search & List</h2>
            <div class="card" style="margin-top: 1rem;">
                <div style="display: flex; gap: 1rem; margin-bottom: 1rem; align-items: center;">
                    <input class="input-field" placeholder="Search users by name or role..." oninput=${(e) => searchQuery.value = e.target.value} style="margin-top:0;" />
                    <button class="btn btn-secondary" onclick=${() => activeTab.value = "all"}>All</button>
                    <button class="btn btn-secondary" onclick=${() => activeTab.value = "active"}>Active</button>
                </div>

                <div class="user-list">
                    ${() => filteredUsers.value.length > 0 ? filteredUsers.value.map(u => html`
                        <div class="user-row">
                            <div>
                                <strong>${u.name}</strong>
                                <div style="font-size: 0.85rem; color: var(--text-muted);">${u.role}</div>
                            </div>
                            <span class="badge ${u.status === 'active' ? 'badge-success' : 'badge-warning'}">${u.status}</span>
                        </div>
                    `) : html`<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No users found.</div>`}
                </div>
            </div>
        </div>
    `;
}

function AsyncPage() {
    head({ title: "Async Loader | PrimalJS Showcase" });

    const dataSignal = signal(null);
    const loadingSignal = signal(true);

    onMount(() => {
        setTimeout(() => {
            dataSignal.value = { title: "PrimalJS Async Capability", timestamp: new Date().toLocaleTimeString() };
            loadingSignal.value = false;
        }, 300);
    });

    return html`
        <div>
            <h2>Async State Loading</h2>
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                Async data loading with Signals without parent component re-renders.
            </p>

            <div class="card">
                ${() => loadingSignal.value ? html`
                    <div style="display: flex; align-items: center; gap: 0.75rem; color: var(--text-secondary);">
                        <div class="loading-spinner"></div>
                        <span>Fetching mock async data from server...</span>
                    </div>
                ` : html`
                    <div style="color: var(--accent-emerald);">
                        <h3>✓ Data Resolved Successfully</h3>
                        <p><strong>Title:</strong> ${dataSignal.value?.title}</p>
                        <p><strong>Time:</strong> ${dataSignal.value?.timestamp}</p>
                    </div>
                `}
            </div>
        </div>
    `;
}

// --- Router Setup ---

const router = createRouter({
    routes: [
        {
            path: "/",
            component: MainLayout,
            children: [
                { path: "", component: DashboardPage },
                { path: "users", component: UsersPage },
                { path: "async", component: AsyncPage }
            ]
        }
    ]
});

// --- Component Registration ---

register(HeaderNav, MainLayout, DashboardPage, UsersPage, AsyncPage, RouteOutlet);

// --- App Initialization ---

const app = createApp({
    router,
    dev: true,
    onError(err) {
        console.error("[PrimalJS Global Error]:", err);
    }
});

app.mount("#app");
