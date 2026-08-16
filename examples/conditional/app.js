import {
    html,
    signal,
    mount,
    register,
    If,
    ElseIf,
    Else
} from "../../primal.js";

function Loading() {
    return html`
        <div class="status-box">
            <p>⏳ Loading data from server...</p>
        </div>
    `;
}

function ErrorPage() {
    return html`
        <div class="status-box" style="border-color: #ef4444;">
            <p style="color: #ef4444;">⚠️ Something went wrong. Please try again.</p>
        </div>
    `;
}

function Dashboard() {
    return html`
        <div class="status-box" style="border-color: #22c55e;">
            <h3 style="color: #22c55e; margin-bottom: 8px;">🎉 Dashboard Ready</h3>
            <p>Welcome back! PrimalJS declarative control-flow toggles DOM ranges directly.</p>
        </div>
    `;
}

function App() {
    const status = signal("loading");

    return html`
        <main class="card">
            <h2>PrimalJS Control-Flow</h2>
            <p class="subtitle">Declarative &lt;If&gt;, &lt;ElseIf&gt;, &lt;Else&gt; without Virtual DOM</p>

            <div class="button-group">
                <button
                    class="btn-secondary"
                    onclick=${() => status.value = "loading"}
                >
                    Loading
                </button>

                <button
                    class="btn-secondary"
                    onclick=${() => status.value = "error"}
                >
                    Error
                </button>

                <button
                    class="btn-secondary"
                    onclick=${() => status.value = "ready"}
                >
                    Ready
                </button>
            </div>

            <If when=${() => status.value === "loading"}>
                <Loading />

                <ElseIf when=${() => status.value === "error"}>
                    <ErrorPage />
                </ElseIf>

                <Else>
                    <Dashboard />
                </Else>
            </If>
        </main>
    `;
}

register(
    Loading,
    ErrorPage,
    Dashboard,
    App
);

mount(App, "#app");
