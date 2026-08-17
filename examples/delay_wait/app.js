import {
    html,
    signal,
    register,
    mount,
    Delay,
    Wait,
    Briefly,
    Failed
} from "../../primal.js";

const userId = signal(1);
const shouldFail = signal(false);
const activeTab = signal("delay"); // "delay" | "wait" | "component"

// 1. Task Factory Function (with AbortSignal)
function fetchUserTask(id, failFlag, { signal: abortSignal }) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            if (failFlag) {
                reject(new Error(`Failed to load Profile #${id}`));
            } else {
                resolve({ id, name: `User #${id} (Lemuel)`, role: "Lead Architect" });
            }
        }, 120);

        if (abortSignal) {
            abortSignal.addEventListener("abort", () => clearTimeout(timer));
        }
    });
}

// 2. Single Promise Instance
const staticPromiseSignal = signal(
    new Promise((resolve) => setTimeout(() => resolve("Single Promise Resolved Data"), 120))
);

function reloadStaticPromise() {
    staticPromiseSignal.value = new Promise((resolve) =>
        setTimeout(() => resolve("Fresh Promise Resolved Data"), 120)
    );
}

// 3. Dynamic Component Loader Promise
function fetchAsyncComponent(failFlag) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (failFlag) {
                reject(new Error("Component Module Bundle Not Found"));
            } else {
                resolve({
                    default: function LazyWidget(props) {
                        return html`
                            <div class="status-box lazy-widget">
                                <h3>Lazy Loaded Component</h3>
                                <p>Dynamically imported module rendered successfully!</p>
                            </div>
                        `;
                    }
                });
            }
        }, 120);
    });
}

function UserCard(props) {
    return html`
        <div class="status-box">
            <h3>Profile Loaded Successfully</h3>
            <p class="user-info"><strong>User:</strong> ${props.user.name}</p>
            <p><strong>Role:</strong> ${props.user.role}</p>
        </div>
    `;
}

function App() {
    return html`
        <main class="card">
            <h2>PrimalJS Expressive Delay & Wait Demo</h2>
            <p class="subtitle">Human-First Async Controls: &lt;Delay&gt;, &lt;Wait&gt;, &lt;Briefly&gt;, &lt;Failed&gt;</p>

            <div class="button-group">
                <button class="btn-secondary tab-delay" onclick=${() => activeTab.value = "delay"}>
                    &lt;Delay task&gt; Mode
                </button>
                <button class="btn-secondary tab-wait" onclick=${() => activeTab.value = "wait"}>
                    &lt;Wait for&gt; Mode
                </button>
                <button class="btn-secondary tab-component" onclick=${() => activeTab.value = "component"}>
                    &lt;Delay component&gt; Mode
                </button>
            </div>

            ${() => activeTab.value === "delay" ? html`
                <div class="section-mode">
                    <div class="button-group">
                        <button class="btn-secondary btn-user-1" onclick=${() => { shouldFail.value = false; userId.value = 1; }}>
                            Load Profile #1
                        </button>
                        <button class="btn-secondary btn-user-2" onclick=${() => { shouldFail.value = false; userId.value = 2; }}>
                            Load Profile #2
                        </button>
                        <button class="btn-secondary btn-fail" onclick=${() => shouldFail.value = true}>
                            Trigger Fail State
                        </button>
                    </div>

                    <Delay task=${({ signal }) => fetchUserTask(userId.value, shouldFail.value, { signal })}>
                        ${userData => html`
                            <UserCard user=${userData} />
                        `}

                        <Briefly>
                            <div class="briefly-box">
                                <p class="briefly-text">Briefly fetching user #${userId.value}...</p>
                            </div>
                        </Briefly>

                        <Failed>
                            ${(error, retry) => html`
                                <div class="failed-box">
                                    <h3>Operation Failed</h3>
                                    <p class="error-msg">${error.message}</p>
                                    <button class="btn-secondary btn-retry" onclick=${retry}>
                                        Retry Request
                                    </button>
                                </div>
                            `}
                        </Failed>
                    </Delay>
                </div>
            ` : activeTab.value === "wait" ? html`
                <div class="section-mode">
                    <div class="button-group">
                        <button class="btn-secondary btn-reload-promise" onclick=${reloadStaticPromise}>
                            Reload Single Promise
                        </button>
                    </div>

                    <Wait for=${staticPromiseSignal.value}>
                        ${val => html`
                            <div class="status-box promise-result">
                                <h3>Promise Value Unwrapped</h3>
                                <p class="promise-val">${val}</p>
                            </div>
                        `}

                        <Briefly>
                            <div class="briefly-box">
                                <p class="briefly-text-wait">Briefly unwrapping Promise...</p>
                            </div>
                        </Briefly>

                        <Failed>
                            ${(error) => html`
                                <div class="failed-box">
                                    <h3>Wait Rejection</h3>
                                    <p>${error.message}</p>
                                </div>
                            `}
                        </Failed>
                    </Wait>
                </div>
            ` : html`
                <div class="section-mode">
                    <div class="button-group">
                        <button class="btn-secondary btn-load-comp" onclick=${() => shouldFail.value = false}>
                            Load Lazy Component
                        </button>
                        <button class="btn-secondary btn-fail-comp" onclick=${() => shouldFail.value = true}>
                            Fail Lazy Component
                        </button>
                    </div>

                    <Delay component=${() => fetchAsyncComponent(shouldFail.value)}>
                        <Briefly>
                            <div class="briefly-box">
                                <p class="briefly-text-comp">Briefly importing module component...</p>
                            </div>
                        </Briefly>

                        <Failed>
                            ${(error, retry) => html`
                                <div class="failed-box comp-failed-box">
                                    <h3>Component Import Failed</h3>
                                    <p class="comp-error-msg">${error.message}</p>
                                    <button class="btn-secondary btn-retry-comp" onclick=${retry}>
                                        Retry Import
                                    </button>
                                </div>
                            `}
                        </Failed>
                    </Delay>
                </div>
            `}
        </main>
    `;
}

register(UserCard, App, Delay, Wait, Briefly, Failed);

mount(App, "#app");
