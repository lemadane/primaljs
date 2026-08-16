import {
    html,
    signal,
    register,
    mount,
    Await,
    Async,
    Pending,
    Catch
} from "../../primal.js";

const userId = signal(1);
const shouldReject = signal(false);

function fetchUserData(id, shouldFail) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (shouldFail) {
                reject(new Error(`Failed to load data for User #${id}`));
            } else {
                resolve({ id, name: `User #${id} (Lemuel)`, role: "Lead Architect" });
            }
        }, 500);
    });
}

function UserCard(props) {
    return html`
        <div class="status-box">
            <h3>User Loaded Successfully</h3>
            <p><strong>ID:</strong> ${props.user.id}</p>
            <p><strong>Name:</strong> ${props.user.name}</p>
            <p><strong>Role:</strong> ${props.user.role}</p>
        </div>
    `;
}

function App() {
    return html`
        <main class="card">
            <h2>PrimalJS Declarative Async / Await Demo</h2>
            <p class="subtitle">Asynchronous Data Fetching & Component Loading with &lt;Await&gt;, &lt;Async&gt;, &lt;Pending&gt;, &lt;Catch&gt;</p>

            <div class="button-group">
                <button class="btn-secondary" onclick=${() => { shouldReject.value = false; userId.value = 1; }}>
                    Load User #1
                </button>
                <button class="btn-secondary" onclick=${() => { shouldReject.value = false; userId.value = 2; }}>
                    Load User #2
                </button>
                <button class="btn-secondary" onclick=${() => shouldReject.value = true}>
                    Trigger Network Error
                </button>
            </div>

            <Await promise=${() => fetchUserData(userId.value, shouldReject.value)}>
                ${userData => html`
                    <UserCard user=${userData} />
                `}

                <Pending>
                    <div class="pending-box">
                        <p>Fetching notifications for User #${userId.value}...</p>
                    </div>
                </Pending>

                <Catch>
                    ${(error, retry) => html`
                        <div class="error-box">
                            <h3>Network Rejection Caught</h3>
                            <p>${error.message}</p>
                            <button class="btn-secondary" onclick=${retry}>
                                Retry Request
                            </button>
                        </div>
                    `}
                </Catch>
            </Await>
        </main>
    `;
}

register(UserCard, App);

mount(App, "#app");
