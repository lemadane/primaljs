/** Validate business input without depending on PrimalJS or a browser. */
export function createTodo(title) {
    if (typeof title !== "string" || !title.trim()) {
        throw new Error("A title is required.");
    }
    return { title: title.trim(), completed: false };
}
