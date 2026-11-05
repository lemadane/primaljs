# Building maintainable PrimalJS applications

Start small: a component and a service can be enough. Introduce layers when business rules or external integrations need independent tests. PrimalJS does not require classes, a dependency injection container, or this folder structure.

## Runnable example

The [todo example](../examples/clean-architecture/) separates business rules, use cases, storage, and presentation. From the repository root, serve static files with your preferred HTTP server (for example, `python3 -m http.server 8000`), then open `http://localhost:8000/examples/clean-architecture/`.

Data lives in memory and resets on reload. No API server or credentials are needed.

```text
examples/clean-architecture/
├── domain/todo.js                         Business input validation
├── application/todo-service.js            Use cases and repository contract
├── infrastructure/memory-todo-repository.js  Storage implementation
├── ui/TodoPage.js                         Components and presentation state
└── main.js                               Dependency construction and mounting
```

## Dependency rules

| Layer | May import | Must not depend on |
| --- | --- | --- |
| Domain | Other domain modules | PrimalJS, DOM, network, storage |
| Application | Domain, other application modules | UI, concrete repositories, browser APIs |
| Infrastructure | Domain and application contracts | UI |
| UI | Domain, application contracts, PrimalJS | Concrete repositories |
| Composition root (`main.js`) | All layers | — |

Construct the repository and service in `main.js`, then pass the service to the page through props. In an installed application, replace the example's relative framework imports with `@lemadane/primaljs`.

Keep signals for presentation state in the UI: input values, loading indicators, errors, and displayed records. Keep business rules as ordinary functions. Validate at the use-case boundary even when a form also uses HTML validation.

For component-focused before-and-after examples, see [SOLID component design](SOLID_COMPONENTS.md).

## Applying SOLID with functions

- **Single responsibility:** A component renders and handles interactions; a use case coordinates work; a repository handles persistence.
- **Open/closed:** Replace the injected repository to add another storage backend without changing the service.
- **Liskov substitution:** Every repository must satisfy the same behavior: asynchronous `list()` and `save(todo)`, stable unique IDs, isolated returned records, and rejected promises on failure. Run shared contract tests against each implementation.
- **Interface segregation:** Consumers receive only the operations they need. Split contracts when a component or use case needs a smaller capability.
- **Dependency inversion:** The application declares its repository contract through JSDoc. Infrastructure implements it; startup chooses the implementation.

Avoid exposing mutable repository records. Keep failures observable to callers and let the UI decide how to display them. Disable duplicate submissions while an operation is pending. Applications with long-lived requests should also cancel or ignore results after their owning view is disposed.

## Verification and enforcement

Run the business and repository tests without a DOM:

```bash
node --test examples/clean-architecture/architecture.test.js
node examples/clean-architecture/check-boundaries.js
```

The boundary check validates local imports in the example's four layers. It is a small example-specific guard, not a JavaScript parser or a replacement for code review. For larger apps, enforce the same rules with a dependency analysis tool that parses all import forms.

Run `npm run test:examples` to check dependency boundaries and all application examples, including the todo page and the optional [callback-based editor](../examples/solid-components/). The UI tests cover pending submissions, failures, and completion after disposal. This command also runs in repository CI.

Add the relevant checks to your application's CI. Review browser globals and side effects separately: an import check cannot establish that a module has no network or DOM access. Test components with injected fake services, including loading, successful submissions, failures, and repeated clicks. Test HTTP or storage adapters separately from business rules.

When adding an HTTP adapter, implement the repository contract, check unsuccessful response statuses, and inject `fetch` so adapter behavior can be tested. No service locator or framework-level provider is needed for this example.
