/** @returns {import("../application/todo-service.js").TodoRepository} */
export function createMemoryTodoRepository() {
    const todos = [];
    let nextId = 1;
    return {
        async list() {
            return todos.map(todo => ({ ...todo }));
        },
        async save(todo) {
            const saved = { ...todo, id: String(nextId++) };
            todos.push(saved);
            return { ...saved };
        }
    };
}
