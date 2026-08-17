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
            <!-- Nested <For> loop iterating tags -->
            <div class="tag-list" style="display: inline-flex; gap: 4px; margin-left: 8px;">
                <For each=${props.user.tags || []}>
                    ${tag => html`<span class="tag-badge" style="font-size: 0.75rem; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">${tag}</span>`}
                </For>
            </div>
        </div>
    `;
}

function App() {
    const users = signal([
        { id: 1, name: "John", active: true, tags: ["admin", "lead"] },
        { id: 2, name: "Mike", active: false, tags: ["guest"] },
        { id: 3, name: "Anna", active: true, tags: ["dev", "ui"] },
        { id: 4, name: "StopHere", active: true, isStop: true, tags: ["system"] },
        { id: 5, name: "David", active: true, tags: ["dev"] }
    ]);

    const stopAtId = signal(4);

    function addUser() {
        const nextId = Date.now();
        users.value = [
            ...users.value,
            { id: nextId, name: `User_${nextId.toString().slice(-4)}`, active: true, tags: ["new"] }
        ];
    }

    function removeFirstUser() {
        if (users.value.length > 0) {
            users.value = users.value.slice(1);
        }
    }

    function clearUsers() {
        users.value = [];
    }

    function restoreUsers() {
        users.value = [
            { id: 1, name: "John", active: true, tags: ["admin", "lead"] },
            { id: 2, name: "Mike", active: false, tags: ["guest"] },
            { id: 3, name: "Anna", active: true, tags: ["dev", "ui"] },
            { id: 4, name: "StopHere", active: true, isStop: true, tags: ["system"] },
            { id: 5, name: "David", active: true, tags: ["dev"] }
        ];
        stopAtId.value = 4;
    }

    function toggleStop() {
        stopAtId.value = stopAtId.value === 4 ? 99 : 4;
    }

    return html`
        <main class="card">
            <h2>PrimalJS Declarative For Loop</h2>
            <p class="subtitle">Fine-grained Keyed DOM Ownership with &lt;For&gt;, &lt;Continue&gt;, &lt;Break&gt;, &lt;Else&gt;</p>

            <div class="button-group">
                <button class="btn-secondary btn-add" onclick=${addUser}>Add Item</button>
                <button class="btn-secondary btn-remove" onclick=${removeFirstUser}>Remove First</button>
                <button class="btn-secondary btn-clear" onclick=${clearUsers}>Clear List</button>
                <button class="btn-secondary btn-restore" onclick=${restoreUsers}>Restore List</button>
                <button class="btn-secondary btn-toggle-stop" onclick=${toggleStop}>
                    Toggle Break at ID 4
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
                            <p class="empty-text">No users found in collection.</p>
                        </div>
                    </Else>
                </For>
            </div>
        </main>
    `;
}

register(UserCard, App, For, Continue, Break, Else);

mount(App, "#app");
