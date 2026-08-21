# PrimalJS IntelliSense Guide

PrimalJS delivers **rich editor IntelliSense in VS Code without TypeScript or compilation steps**.

PrimalJS achieves this via a two-layer architecture:
1. **JavaScript API Layer**: Pure JSDoc generic annotations + root `jsconfig.json`.
2. **Template Language Layer**: Custom HTML metadata & VS Code tagged template extensions.

---

## 1. JavaScript API Layer (Signals, Computeds, & Component Props)

Because PrimalJS exports pure standard JavaScript ES modules with JSDoc metadata, VS Code automatically provides full autocompletion for signals, computeds, effects, and function component props.

### Reactivity Autocompletion

```js
import { signal, computed, effect } from "primaljs";

// Signal autocompletion & generic type inference
const user = signal({
    id: 101,
    name: "Lemuel",
    role: "admin"
});

// VS Code knows user.value has id, name, role
console.log(user.value.name); // string IntelliSense

// Derived Computed signals keep full return type inference
const userGreeting = computed(() => `Hello, ${user.value.name}!`);
console.log(userGreeting.value.toUpperCase()); // String method completions

// Reactive side-effects recognize return disposer
const dispose = effect(() => {
    console.log("Current user:", user.value.name);
});
dispose(); // Autocompleted function
```

### Component Props Autocompletion

Annotate component function props using JSDoc:

```js
/**
 * @typedef {Object} UserCardProps
 * @property {string} name User's full name.
 * @property {number} age User's age.
 * @property {boolean} [admin] Optional admin privilege badge.
 */

/**
 * @param {UserCardProps} props
 */
export function UserCard(props) {
    // Typing `props.` suggests `name`, `age`, `admin`
    return html`
        <article class="card">
            <h3>${props.name}</h3>
            <p>Age: ${props.age}</p>
            <If when=${props.admin}>
                <span class="badge">Admin</span>
            </If>
        </article>
    `;
}
```

---

## 2. Project Configuration (`jsconfig.json`)

To enable aggressive VS Code JavaScript type checking across your PrimalJS application, add a `jsconfig.json` at your project root:

```json
{
    "compilerOptions": {
        "target": "ES2024",
        "module": "ESNext",
        "moduleResolution": "Node",
        "checkJs": true,
        "strict": true,
        "allowJs": true
    },
    "include": [
        "src/**/*.js",
        "examples/**/*.js"
    ],
    "exclude": [
        "node_modules"
    ]
}
```

---

## 3. Template Language Layer (`html\`...\``)

Inside PrimalJS `html\`...\`` template literals, standard HTML tags, attributes, and PrimalJS control flow tags (`<If>`, `<For>`, `<Mount>`, `<Wait>`, etc.) can be autocompleted in VS Code.

### Option A: VS Code Custom HTML Data

1. Download or reference `primal-html-data.json` in your project workspace.
2. In your `.vscode/settings.json`, register the custom data file:

```json
{
    "html.customData": [
        "./node_modules/primaljs/docs/primal-html-data.json"
    ]
}
```

This enables hover info, tag completion, and attribute suggestions for built-in PrimalJS tags (`<If when=${...}>`, `<For each=${...} key=${...}>`, `<Mount component=${...}>`).

### Option B: Inline HTML Extensions

Install a tagged template extension in VS Code:
- **Inline HTML** (`pushqrdx.vscode-inline-html`)
- **Comment tagged templates** (`cweijan.vscode-comment-tagged-templates`)

These extensions format and autocomplete HTML inside `html\`...\`` strings automatically.

---

## 4. Official PrimalJS VS Code Extension Roadmap

PrimalJS is building an official VS Code extension (`primaljs-vscode`) designed specifically for standard JS projects:

- **Component Auto-Discovery**: Automatically parses `register(UserCard)` calls across workspace files.
- **Dynamic Prop Inference**: Reads JSDoc `@typedef` / `@param` of registered components and provides tag/attribute autocompletion (`<UserCard name="..." age="..." />`) directly inside template literals.
- **Embedded `${}` JavaScript Intelligence**: Direct JS expression syntax checking inside template expressions.
