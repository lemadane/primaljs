# SOLID components example

A reusable editor receives an `onSave` callback. A service validates the title and delegates persistence to either an in-memory or local storage repository. The component and service are identical for both adapters.

See the [SOLID component guide](../../docs/SOLID_COMPONENTS.md) for before-and-after examples, the five principles, and testing guidance.

From the repository root:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/examples/solid-components/`. Use the links to choose memory or browser-local persistence. Data is stored under `primaljs-solid-todos` in local mode. This example demonstrates saving rather than a full todo application; it has no list or deletion UI, and local storage does not coordinate concurrent tab writes.

Run component and shared repository contract tests with:

```bash
npm run test:examples
```

No framework changes, extra production dependencies, or service container are required.
