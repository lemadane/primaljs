import {
    html,
    signal,
    computed,
    register,
    mount,
    Switch,
    Case,
    Default
} from "../../primal.js";

const status = signal("loading");
const numericScore = signal(50);
const nestedMode = signal("summary");

const isHighPriority = computed(() => status.value === "urgent");

function Loading() {
    return html`
        <div class="status-box">
            <p class="loading-text">⏳ Loading data...</p>
        </div>
    `;
}

function Processing() {
    return html`
        <div class="status-box" style="border-color: #eab308;">
            <p class="processing-text" style="color: #eab308;">⚙️ Processing tasks...</p>
        </div>
    `;
}

function Complete() {
    return html`
        <div class="status-box" style="border-color: #22c55e;">
            <h3 class="complete-header" style="color: #22c55e; margin-bottom: 8px;">🎉 Task Complete!</h3>
            <p>PrimalJS &lt;Switch&gt; toggles DOM ranges with fine-grained reactivity.</p>

            <!-- Nested <Switch> inside <Case> -->
            <div class="nested-box" style="margin-top: 12px; padding: 12px; background: rgba(34, 197, 94, 0.1); border-radius: 8px;">
                <Switch value=${nestedMode}>
                    <Case value="summary">
                        <p class="nested-summary">Nested Switch: Summary View Active</p>
                    </Case>
                    <Case value="detail">
                        <p class="nested-detail">Nested Switch: Extended Technical Metrics View</p>
                    </Case>
                </Switch>
            </div>
        </div>
    `;
}

function HighScore() {
    return html`
        <div class="status-box score-box" style="border-color: #a855f7;">
            <h3 class="score-header" style="color: #a855f7;">🏆 Predicate Case Matched: High Score (${numericScore.value})</h3>
        </div>
    `;
}

function Unknown() {
    return html`
        <div class="status-box" style="border-color: #ef4444;">
            <p class="unknown-text" style="color: #ef4444;">⚠️ Unknown status state.</p>
        </div>
    `;
}

function App() {
    return html`
        <main class="card">
            <h2>PrimalJS Switch Control-Flow</h2>
            <p class="subtitle">Declarative &lt;Switch&gt;, &lt;Case&gt;, &lt;Default&gt; without Virtual DOM</p>

            <div class="button-group">
                <button class="btn-secondary btn-loading" onclick=${() => status.value = "loading"}>
                    Loading
                </button>
                <button class="btn-secondary btn-processing" onclick=${() => status.value = "processing"}>
                    Processing
                </button>
                <button class="btn-secondary btn-complete" onclick=${() => status.value = "complete"}>
                    Complete
                </button>
                <button class="btn-secondary btn-score" onclick=${() => { status.value = 150; numericScore.value = 150; }}>
                    High Score (150)
                </button>
                <button class="btn-secondary btn-unknown" onclick=${() => status.value = "unknown"}>
                    Unknown State
                </button>
                <button class="btn-secondary btn-none" onclick=${() => status.value = "empty-no-default"}>
                    Empty (No Default)
                </button>
            </div>

            <div class="button-group" style="margin-top: 12px;">
                <button class="btn-secondary btn-toggle-nested" onclick=${() => nestedMode.value = nestedMode.value === "summary" ? "detail" : "summary"}>
                    Toggle Nested View Mode
                </button>
            </div>

            <!-- Outer <Switch> testing signal value, multiple values array, predicate fn, fallback Default -->
            <Switch value=${status}>
                <Case value="loading">
                    <Loading />
                </Case>

                <!-- Multiple values array matching -->
                <Case value=${["pending", "processing"]}>
                    <Processing />
                </Case>

                <Case value="complete">
                    <Complete />
                </Case>

                <!-- Predicate Function Matching: matches numbers > 100 -->
                <Case value=${(val) => typeof val === "number" && val > 100}>
                    <HighScore />
                </Case>

                <!-- Case for empty testing -->
                <Case value="empty-no-default">
                    <!-- Outer container switches here, no children -> empty -->
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
    HighScore,
    Unknown,
    App,
    Switch,
    Case,
    Default
);

mount(App, "#app");
