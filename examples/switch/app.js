import {
    html,
    signal,
    register,
    mount,
    Switch,
    Case,
    Default
} from "../../primal.js";

function Loading() {
    return html`
        <div class="status-box">
            <p>⏳ Loading data...</p>
        </div>
    `;
}

function Processing() {
    return html`
        <div class="status-box" style="border-color: #eab308;">
            <p style="color: #eab308;">⚙️ Processing tasks...</p>
        </div>
    `;
}

function Complete() {
    return html`
        <div class="status-box" style="border-color: #22c55e;">
            <h3 style="color: #22c55e; margin-bottom: 8px;">🎉 Task Complete!</h3>
            <p>PrimalJS &lt;Switch&gt; toggles DOM ranges with fine-grained reactivity.</p>
        </div>
    `;
}

function Unknown() {
    return html`
        <div class="status-box" style="border-color: #ef4444;">
            <p style="color: #ef4444;">⚠️ Unknown status state.</p>
        </div>
    `;
}

function App() {
    const status = signal("loading");

    return html`
        <main class="card">
            <h2>PrimalJS Switch Control-Flow</h2>
            <p class="subtitle">Declarative &lt;Switch&gt;, &lt;Case&gt;, &lt;Default&gt; without Virtual DOM</p>

            <div class="button-group">
                <button
                    class="btn-secondary"
                    onclick=${() => status.value = "loading"}
                >
                    Loading
                </button>

                <button
                    class="btn-secondary"
                    onclick=${() => status.value = "processing"}
                >
                    Processing
                </button>

                <button
                    class="btn-secondary"
                    onclick=${() => status.value = "complete"}
                >
                    Complete
                </button>

                <button
                    class="btn-secondary"
                    onclick=${() => status.value = "unknown"}
                >
                    Unknown
                </button>
            </div>

            <Switch value=${status}>
                <Case value="loading">
                    <Loading />
                </Case>

                <Case values=${["pending", "processing"]}>
                    <Processing />
                </Case>

                <Case value="complete">
                    <Complete />
                </Case>

                <Default>
                    <Unknown />
                </Default>
            </Switch>
        </main>
    `;
}

register(
    Loading,
    Processing,
    Complete,
    Unknown,
    App
);

mount(App, "#app");
