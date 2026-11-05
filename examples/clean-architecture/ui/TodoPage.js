import { html, signal, onMount, onDestroy } from "../../../src/index.js";

/** @param {{ todos: ReturnType<import("../application/todo-service.js").createTodoService> }} props */
export function TodoPage({ todos }) {
    const items = signal([]);
    const busy = signal(true);
    const error = signal("");

    let alive = true;
    onDestroy(() => { alive = false; });

    onMount(async () => {
        try {
            const loaded = await todos.list();
            if (alive) items.value = loaded;
        } catch (err) {
            if (alive) error.value = err instanceof Error ? err.message : "Could not complete the operation.";
        } finally {
            if (alive) busy.value = false;
        }
    });

    const submit = async event => {
        event.preventDefault();
        if (!alive || busy.value) return;
        const form = event.currentTarget;
        const title = form.elements.namedItem("title").value;
        busy.value = true;
        error.value = "";
        try {
            const saved = await todos.add(title);
            if (!alive) return;
            items.value = [...items.value, saved];
            form.reset();
        } catch (err) {
            if (alive) error.value = err instanceof Error ? err.message : "Could not complete the operation.";
        } finally {
            if (alive) busy.value = false;
        }
    };

    return html`
        <main>
            <h1>Todos with clear responsibilities</h1>
            <p>Components own presentation state; injected services own use cases.</p>
            <form onsubmit=${submit}>
                <label>Title <input name="title" required disabled=${busy} /></label>
                <button disabled=${busy}>Add todo</button>
            </form>
            <p role="alert">${error}</p>
            <ul>${() => items.value.map(todo => html`<li key=${todo.id}>${todo.title}</li>`)}</ul>
            <p>Demo data lives in memory and resets when you reload.</p>
        </main>
    `;
}
