import {
    html,
    signal,
    computed,
    register,
    mount,
    Try,
    Catch
} from "../../primal.js";

const shouldFail = signal(false);
const throwMode = signal("error"); // "error" | "string" | "rethrow"
const activeBoundaryTab = signal("single"); // "single" | "nested" | "static"

function Dashboard() {
    const message = computed(() => {
        if (shouldFail.value) {
            if (throwMode.value === "string") {
                throw "Raw String Error Thrown";
            }
            throw new Error("Dashboard rendering failed due to internal state error.");
        }
        return "Dashboard is working smoothly.";
    });

    return html`
        <div class="status-box">
            <h3>Dashboard Subtree Active</h3>
            <p class="status-msg">${message}</p>
        </div>
    `;
}

function InnerComponent() {
    const data = computed(() => {
        if (shouldFail.value) {
            if (throwMode.value === "rethrow") {
                throw new Error("Inner Boundary Error -> Rethrown to Outer");
            }
            throw new Error("Inner Component Local Error");
        }
        return "Inner Subtree Data Loaded";
    });

    return html`<p class="inner-msg">${data}</p>`;
}

function App() {
    return html`
        <main class="card">
            <h2>PrimalJS Try / Catch Demo</h2>
            <p class="subtitle">Declarative UI Error Boundary with Direct DOM Range Ownership</p>

            <div class="button-group">
                <button class="btn-secondary btn-mode-single" onclick=${() => activeBoundaryTab.value = "single"}>
                    Single Boundary
                </button>
                <button class="btn-secondary btn-mode-nested" onclick=${() => activeBoundaryTab.value = "nested"}>
                    Nested Boundaries
                </button>
                <button class="btn-secondary btn-mode-static" onclick=${() => activeBoundaryTab.value = "static"}>
                    Static Fallback
                </button>
            </div>

            <div class="button-group" style="margin-top: 12px;">
                <button class="btn-secondary btn-cause-error" onclick=${() => { throwMode.value = "error"; shouldFail.value = true; }}>
                    Throw Error
                </button>
                <button class="btn-secondary btn-cause-string" onclick=${() => { throwMode.value = "string"; shouldFail.value = true; }}>
                    Throw String
                </button>
                <button class="btn-secondary btn-cause-rethrow" onclick=${() => { throwMode.value = "rethrow"; shouldFail.value = true; }}>
                    Rethrow to Outer
                </button>
                <button class="btn-secondary btn-fix" onclick=${() => shouldFail.value = false}>
                    Fix Error Condition
                </button>
            </div>

            ${() => activeBoundaryTab.value === "single" ? html`
                <Try>
                    <Dashboard />

                    <Catch>
                        ${(error, reset) => html`
                            <div class="error-box single-err-box">
                                <h3>Caught UI Error</h3>
                                <p class="err-text"><strong>Details:</strong> ${error ? (error.message || String(error)) : ""}</p>
                                <button class="btn-secondary btn-reset" onclick=${reset}>
                                    Try Again (Reset Boundary)
                                </button>
                            </div>
                        `}
                    </Catch>
                </Try>
            ` : activeBoundaryTab.value === "nested" ? html`
                <!-- Outer Boundary -->
                <Try>
                    <div class="outer-box" style="padding: 16px; border: 1px dashed #a855f7; border-radius: 8px;">
                        <h4>Outer Try Boundary</h4>

                        <!-- Inner Boundary -->
                        <Try>
                            <InnerComponent />

                            <Catch>
                                ${(error, reset) => {
                                    if (error && error.message && error.message.includes("Rethrown")) {
                                        throw error; // Rethrow to outer boundary
                                    }
                                    return html`
                                        <div class="error-box inner-err-box">
                                            <h4>Inner Catch Handled</h4>
                                            <p class="inner-err-text">${error.message}</p>
                                            <button class="btn-secondary btn-reset-inner" onclick=${reset}>Reset Inner</button>
                                        </div>
                                    `;
                                }}
                            </Catch>
                        </Try>
                    </div>

                    <Catch>
                        ${(error, reset) => html`
                            <div class="error-box outer-err-box">
                                <h3>Outer Catch Handled Rethrow</h3>
                                <p class="outer-err-text">${error.message}</p>
                                <button class="btn-secondary btn-reset-outer" onclick=${reset}>Reset Outer</button>
                            </div>
                        `}
                    </Catch>
                </Try>
            ` : html`
                <!-- Static Catch Mode -->
                <Try>
                    <Dashboard />

                    <Catch>
                        <div class="error-box static-err-box">
                            <h3>Static Fallback View</h3>
                            <p>Static UI rendered without dynamic error function.</p>
                        </div>
                    </Catch>
                </Try>
            `}
        </main>
    `;
}

register(Dashboard, InnerComponent, App, Try, Catch);

mount(App, "#app");
