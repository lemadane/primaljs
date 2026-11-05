/**
 * @param {Pick<Storage, "getItem" | "setItem">} storage
 * @param {string} [key]
 * @returns {import("../clean-architecture/application/todo-service.js").TodoRepository}
 */
export function createLocalStorageTodoRepository(storage, key = "primaljs-solid-todos") {
    const read = () => {
        const raw = storage.getItem(key);
        const todos = raw === null ? [] : JSON.parse(raw);
        if (!Array.isArray(todos) || todos.some(todo =>
            !todo || typeof todo.id !== "string" || !/^\d+$/.test(todo.id) ||
            typeof todo.title !== "string" || typeof todo.completed !== "boolean"
        )) {
            throw new Error("Stored todos are invalid.");
        }
        return todos;
    };
    return {
        async list() {
            return read();
        },
        async save(todo) {
            const todos = read();
            const nextId = todos.reduce((max, item) => {
                const id = BigInt(item.id);
                return id > max ? id : max;
            }, 0n) + 1n;
            const saved = { ...todo, id: String(nextId) };
            storage.setItem(key, JSON.stringify([...todos, saved]));
            return saved;
        }
    };
}
