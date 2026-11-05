import { html, signal, onDestroy } from "../../src/index.js";

/**
 * @param {{ onSave: (title: string) => Promise<unknown> }} props
 * onSave resolves after saving or rejects with a displayable error.
 */
export function TodoEditor({ onSave }) {
    const pending = signal(false);
    const error = signal("");
    const status = signal("");
    let alive = true;
    onDestroy(() => { alive = false; });

    const submit = async event => {
        event.preventDefault();
        if (!alive || pending.value) return;
        const form = event.currentTarget;
        const title = form.elements.namedItem("title").value;
        pending.value = true;
        error.value = "";
        status.value = "";
        try {
            await onSave(title);
            if (!alive) return;
            form.reset();
            status.value = "Saved.";
        } catch (err) {
            if (alive) error.value = err instanceof Error ? err.message : "Could not save.";
        } finally {
            if (alive) pending.value = false;
        }
    };

    return html`
        <form onsubmit=${submit}>
            <label>Title <input name="title" required disabled=${pending} /></label>
            <button disabled=${pending}>Save</button>
            <p role="alert">${error}</p>
            <p role="status">${status}</p>
        </form>
    `;
}
