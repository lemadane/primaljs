import {
    html,
    signal,
    register,
    mount,
    For,
    Continue,
    Break,
    Else
} from "../../primal.js";

function UserCard(props) {
    return html`
        <div class="user-card">
            <span><strong>${props.index + 1}.</strong> ${props.user.name}</span>
            <span class="status-badge">Active</span>
        </div>
    `;
}

function App() {
    const users = signal([
        { id: 1, name: "John", active: true },
        { id: 2, name: "Mike", active: false },
        { id: 3, name: "Anna", active: true },
        { id: 4, name: "StopHere", active: true, isStop: true },
        { id: 5, name: "David", active: true }
    ]);

    const stopAtId = signal(4);

    function clearUsers() {
        users.value = [];
    }

    function restoreUsers() {
        users.value = [
            { id: 1, name: "John", active: true },
            { id: 2, name: "Mike", active: false },
            { id: 3, name: "Anna", active: true },
            { id: 4, name: "StopHere", active: true, isStop: true },
            { id: 5, name: "David", active: true }
        ];
    }

    function toggleStop() {
        stopAtId.value = stopAtId.value === 4 ? 99 : 4;
    }

    return html`
        <main class="card">
            <h2>PrimalJS Declarative For Loop</h2>
            <p class="subtitle">Fine-grained Keyed DOM Ownership with &lt;For&gt;, &lt;Continue&gt;, &lt;Break&gt;, &lt;Else&gt;</p>

            <div class="button-group">
                <button class="btn-secondary" onclick=${clearUsers}>Clear List</button>
                <button class="btn-secondary" onclick=${restoreUsers}>Restore List</button>
                <button class="btn-secondary" onclick=${toggleStop}>
                    Toggle Break at ID 4 (Current: ${stopAtId})
                </button>
            </div>

            <div class="user-grid">
                <For each=${users} key=${user => user.id}>
                    ${(user, index) => html`
                        <Continue when=${() => !user.active} />
                        <Break when=${() => user.id === stopAtId.value} />
                        <UserCard user=${user} index=${index} />
                    `}

                    <Else>
                        <div class="empty-card">
                            <p>No users found in collection.</p>
                        </div>
                    </Else>
                </For>
            </div>
        </main>
    `;
}

register(UserCard, App);

mount(App, "#app");
