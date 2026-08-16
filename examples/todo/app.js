import { html, signal, computed, mount } from "../../primal.js";

function TodoApp() {
    const todos = signal([
        { id: 1, text: "Build PrimalJS framework core", done: true },
        { id: 2, text: "Prove 0 Virtual DOM architecture", done: true },
        { id: 3, text: "Enjoy pure, compiler-free JavaScript", done: false }
    ]);
    const inputText = signal("");

    const remaining = computed(() =>
        todos.value.filter(t => !t.done).length
    );

    function addTodo() {
        if (!inputText.value.trim()) return;
        todos.value = [
            ...todos.value,
            { id: Date.now(), text: inputText.value.trim(), done: false }
        ];
        inputText.value = "";
    }

    function toggleTodo(id) {
        todos.value = todos.value.map(t =>
            t.id === id ? { ...t, done: !t.done } : t
        );
    }

    function removeTodo(id) {
        todos.value = todos.value.filter(t => t.id !== id);
    }

    return html`
        <div class="card">
            <h2>PrimalJS Todo App</h2>
            <p class="subtitle">
                Tasks remaining: ${remaining}
            </p>

            <form onsubmit=${(e) => { e.preventDefault(); addTodo(); }}>
                <div class="todo-input-group">
                    <input
                        class="input-text"
                        placeholder="Add a new task..."
                        value=${inputText}
                        oninput=${(e) => inputText.value = e.target.value}
                    />
                    <button type="submit" class="btn">Add</button>
                </div>
            </form>

            <ul class="todo-list">
                ${() => todos.value.map(item => html`
                    <li class="todo-item ${item.done ? "completed" : ""}">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1;">
                            <input
                                type="checkbox"
                                checked=${item.done}
                                onchange=${() => toggleTodo(item.id)}
                            />
                            <span>${item.text}</span>
                        </label>
                        <button class="del-btn" onclick=${() => removeTodo(item.id)}>✕</button>
                    </li>
                `)}
            </ul>
        </div>
    `;
}

mount(TodoApp, "#app");
