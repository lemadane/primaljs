# SOLID component design with PrimalJS

SOLID is optional design guidance. Use these techniques when they make a component easier to understand, reuse, or test. Small applications do not need extra layers or classes just to follow an acronym.

The [runnable editor example](../examples/solid-components/) demonstrates all five principles through functions, props, and interchangeable repositories. For application-wide structure, see the [architecture guide](APPLICATION_ARCHITECTURE.md).

## Before: storage embedded in an event handler

A component can start with rendering, validation, and persistence mixed together:

```javascript
const submit = async event => {
    event.preventDefault();
    const title = event.currentTarget.elements.namedItem("title").value.trim();
    if (!title) throw new Error("A title is required.");
    const todos = JSON.parse(localStorage.getItem("todos") || "[]");
    todos.push({ title, completed: false });
    localStorage.setItem("todos", JSON.stringify(todos));
};
```

Changing storage now changes the component. Testing its interaction requires browser storage, and callers cannot substitute another save operation.

## After: inject the operation the component needs

The example's `TodoEditor` receives one capability:

```javascript
/** @param {{ onSave: (title: string) => Promise<unknown> }} props */
function TodoEditor({ onSave }) {
    // Own input, pending, success, and error presentation.
    // On submission, await onSave(title).
}
```

This is a contract sketch; see [TodoEditor.js](../examples/solid-components/TodoEditor.js) for the complete implementation. It disables input during saving, prevents duplicate submissions, preserves input on failure, and ignores results after disposal. Ignoring a result does not cancel a storage operation already in progress.

Startup wires the behavior:

```javascript
const repository = createMemoryTodoRepository();
const todos = createTodoService(repository);
mount(() => TodoEditor({ onSave: title => todos.add(title) }), "#app");
```

The runnable `main.js` contains all imports. In an installed application, import PrimalJS APIs from `@lemadane/primaljs`.

## How each principle applies

| Principle | Concrete example | What to check in your application |
| --- | --- | --- |
| Single responsibility | `TodoEditor` handles presentation, `createTodo` validates input, the service coordinates saving, and repositories store records. | Does a storage change require editing rendering code? |
| Open/closed | `main.js` can choose memory or local storage without editing the component or service. | Can a new implementation extend behavior through an existing contract? |
| Liskov substitution | Both repositories satisfy shared tests for asynchronous saving/listing, stable IDs, insertion order, and isolated returned records. | Do replacements preserve behavior callers rely on, including failure semantics? |
| Interface segregation | The editor receives `onSave`, not an entire repository or application object. | Can the consumer receive fewer capabilities? |
| Dependency inversion | The service declares a repository contract; startup supplies a concrete adapter. | Does business logic import a concrete browser or HTTP implementation? |

The repository contract is described with JSDoc in `application/todo-service.js`. Both implementations return promises; the local storage adapter rejects when storage fails. Callers must handle rejection. A test fake can reject too, without adding a failure option to production components.

## Testing recipe

Inject a controllable `onSave` promise to test the component while an operation is pending. Assert that repeated submissions invoke it once. Resolve it to verify successful reset, reject it to verify visible errors and retained input, and settle it after disposal to verify detached UI stays untouched.

Run the same repository contract tests for each adapter. An implementation having matching method names is insufficient: test the observable behavior the application requires.

```bash
npm run test:examples
```

This runs the example tests and the architecture example's import-boundary check in CI. SOLID judgment itself is a review responsibility; passing tests does not establish compliance with every principle.

## Running and replacing storage

Serve the repository root, for example with `python3 -m http.server 8000`, then open:

- `http://localhost:8000/examples/solid-components/?storage=memory` for data that resets on reload.
- `http://localhost:8000/examples/solid-components/?storage=local` for data saved in this browser under `primaljs-solid-todos`.

The UI deliberately focuses on saving; it does not list, edit, or delete records. Local storage is a teaching adapter, not a multi-tab transactional database: concurrent writes can overwrite each other. Use a server or transactional store when the application needs those guarantees. Storage access failures appear as editor errors.

To add an API-backed implementation, implement the same repository contract, check unsuccessful HTTP statuses, test it independently, and choose it in `main.js`. Keep authentication and transport configuration outside the editor.
