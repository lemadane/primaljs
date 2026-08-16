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

function Dashboard() {
    const message = computed(() => {
        if (shouldFail.value) {
            throw new Error("Dashboard rendering failed due to internal state error.");
        }
        return "Dashboard is working smoothly.";
    });

    return html`
        <div class="status-box">
            <h3>Dashboard Subtree Active</h3>
            <p>${message}</p>
        </div>
    `;
}

function App() {
    return html`
        <main class="card">
            <h2>PrimalJS Try / Catch Demo</h2>
            <p class="subtitle">Declarative UI Error Boundary with Direct DOM Range Ownership</p>

            <div class="button-group">
                <button class="btn-secondary btn-danger" onclick=${() => shouldFail.value = true}>
                    Cause Error
                </button>

                <button class="btn-secondary btn-success" onclick=${() => shouldFail.value = false}>
                    Fix Error Condition
                </button>
            </div>

            <Try>
                <Dashboard />

                <Catch>
                    ${(error, reset) => html`
                        <div class="error-box">
                            <h3>Caught UI Error</h3>
                            <p><strong>${error.name}:</strong> ${error.message}</p>

                            <button class="btn-secondary" onclick=${reset}>
                                Try Again (Reset Boundary)
                            </button>
                        </div>
                    `}
                </Catch>
            </Try>
        </main>
    `;
}

register(Dashboard, App);

mount(App, "#app");
