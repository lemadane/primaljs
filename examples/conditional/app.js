import {
    html,
    signal,
    computed,
    mount,
    register,
    If,
    ElseIf,
    Else
} from "../../primal.js";

const status = signal("loading");
const showDetails = signal(false);
const roleSignal = signal("admin");

// Computed condition
const isAdmin = computed(() => roleSignal.value === "admin");

function Loading() {
    return html`
        <div class="status-box">
            <p class="loading-msg">⏳ Loading data from server...</p>
        </div>
    `;
}

function ErrorPage() {
    return html`
        <div class="status-box" style="border-color: #ef4444;">
            <p class="error-msg" style="color: #ef4444;">⚠️ Something went wrong. Please try again.</p>
        </div>
    `;
}

function Dashboard() {
    return html`
        <div class="status-box" style="border-color: #22c55e;">
            <h3 class="dashboard-header" style="color: #22c55e; margin-bottom: 8px;">🎉 Dashboard Ready</h3>
            <p>Welcome back! PrimalJS declarative control-flow toggles DOM ranges directly.</p>

            <!-- Nested <If> using Computed signal condition -->
            <If when=${isAdmin}>
                <div class="admin-panel" style="margin-top: 12px; padding: 12px; background: rgba(34, 197, 94, 0.1); border-radius: 8px;">
                    <p class="admin-badge">🛡️ Admin Control Panel Active</p>

                    <!-- Nested <If> using boolean signal -->
                    <If when=${showDetails}>
                        <p class="details-text" style="font-size: 0.85rem; margin-top: 6px;">Sensitive system metrics: CPU 12%, Memory 45%</p>
                    </If>
                </div>
            </If>
        </div>
    `;
}

function App() {
    return html`
        <main class="card">
            <h2>PrimalJS Control-Flow</h2>
            <p class="subtitle">Declarative &lt;If&gt;, &lt;ElseIf&gt;, &lt;Else&gt; without Virtual DOM</p>

            <div class="button-group">
                <button class="btn-secondary btn-loading" onclick=${() => status.value = "loading"}>
                    Loading
                </button>
                <button class="btn-secondary btn-error" onclick=${() => status.value = "error"}>
                    Error
                </button>
                <button class="btn-secondary btn-ready" onclick=${() => status.value = "ready"}>
                    Ready
                </button>
                <button class="btn-secondary btn-none" onclick=${() => status.value = "none"}>
                    None (Empty Fallback)
                </button>
            </div>

            <div class="button-group" style="margin-top: 12px;">
                <button class="btn-secondary btn-toggle-role" onclick=${() => roleSignal.value = roleSignal.value === "admin" ? "user" : "admin"}>
                    Toggle Admin Role
                </button>
                <button class="btn-secondary btn-toggle-details" onclick=${() => showDetails.value = !showDetails.value}>
                    Toggle Details
                </button>
            </div>

            <!-- Main <If> container testing function getters, ElseIf, Else -->
            <If when=${() => status.value === "loading"}>
                <Loading />

                <ElseIf when=${() => status.value === "error"}>
                    <ErrorPage />
                </ElseIf>

                <ElseIf when=${() => status.value === "ready"}>
                    <Dashboard />
                </ElseIf>

                <!-- When status.value === "none", no branch matches and no Else is present -> Empty DOM range -->
            </If>
        </main>
    `;
}

register(
    Loading,
    ErrorPage,
    Dashboard,
    App,
    If,
    ElseIf,
    Else
);

mount(App, "#app");
