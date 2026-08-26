// @ts-nocheck
import { html, signal, computed, isSignal, register, mount } from "../../primal.js";

/**
 * Reusable Leaf Component: Button
 * Accepts props: variant, onclick, disabled, children
 */
function Button(props) {
    const variantClass = props.variant ? `btn-${props.variant}` : "btn-secondary";
    return html`
        <button
            id=${props.id}
            class="btn ${variantClass}"
            onclick=${props.onclick}
            disabled=${props.disabled}
        >
            ${props.children}
        </button>
    `;
}

/**
 * Reusable Leaf Component: Badge
 * Accepts props: status (signal | function | string), children
 */
function Badge(props) {
    const getStatusStr = () => {
        if (isSignal(props.status)) return props.status.value;
        if (typeof props.status === "function") return props.status();
        return props.status;
    };

    return html`
        <span class="badge ${() => getStatusStr() === "active" ? "badge-active" : "badge-inactive"}">
            ${props.children}
        </span>
    `;
}

/**
 * Composite Subcomponent: UserCard
 * Uses child subcomponents <Badge> and <Button> inside its template.
 * Accepts props: user (object), onToggle (fn), onDelete (fn)
 */
function UserCard(props) {
    const user = props.user;

    return html`
        <div class="user-card" id="user-${user.id}">
            <div class="user-info">
                <div>
                    <div class="user-name">${user.name}</div>
                    <div class="user-role">${user.role}</div>
                </div>
                <Badge status=${user.status}>
                    ${user.status}
                </Badge>
            </div>
            <div class="user-actions">
                <Button variant="secondary" onclick=${() => props.onToggle(user.id)}>
                    Toggle Status
                </Button>
                <Button variant="danger" onclick=${() => props.onDelete(user.id)}>
                    Remove
                </Button>
            </div>
        </div>
    `;
}

/**
 * Container Component: CardSlot
 * Demonstrates component slotting via props.children
 */
function CardSlot(props) {
    return html`
        <div class="card-slot">
            <div class="card-slot-title">${props.title || "Slotted Container"}</div>
            <div class="card-slot-body">
                ${props.children}
            </div>
        </div>
    `;
}

/**
 * Header Component
 * Accepts title and activeCount signal
 */
function HeaderNav(props) {
    return html`
        <div class="header-banner">
            <h1>${props.title}</h1>
            <Badge status="active">
                Active Users: ${props.activeCount}
            </Badge>
        </div>
    `;
}

/**
 * Top-Level App Component
 * Demonstrates composing subcomponents inside parent components.
 */
function App() {
    const users = signal([
        { id: 1, name: "Lemuel Adane", role: "Lead Architect", status: signal("active") },
        { id: 2, name: "Sarah Chen", role: "Frontend Engineer", status: signal("active") },
        { id: 3, name: "Alex Rivera", role: "DevOps Engineer", status: signal("inactive") }
    ]);

    const activeCount = computed(() =>
        users.value.filter(u => isSignal(u.status) ? u.status.value === "active" : u.status === "active").length
    );

    function toggleUserStatus(id) {
        const u = users.value.find(item => item.id === id);
        if (u && isSignal(u.status)) {
            u.status.value = u.status.value === "active" ? "inactive" : "active";
        }
    }

    function deleteUser(id) {
        users.value = users.value.filter(u => u.id !== id);
    }

    function addUser() {
        const id = Date.now();
        users.value = [
            ...users.value,
            { id, name: `New User ${users.value.length + 1}`, role: "Software Developer", status: signal("active") }
        ];
    }

    return html`
        <main class="card">
            <HeaderNav title="Component Composition Demo" activeCount=${activeCount} />

            <p class="subtitle">
                Demonstrating how PrimalJS components instantiate and pass props, event callbacks, signals, and children to child components.
            </p>

            <div style="margin-bottom: 1rem;">
                <Button id="add-user-btn" variant="primary" onclick=${addUser}>
                    + Add New User
                </Button>
            </div>

            <CardSlot title="Managed Team Members">
                <div class="user-list">
                    ${() => users.value.map(u => html`
                        <UserCard
                            key=${u.id}
                            user=${u}
                            onToggle=${toggleUserStatus}
                            onDelete=${deleteUser}
                        />
                    `)}
                </div>
            </CardSlot>
        </main>
    `;
}

// Register custom components so PrimalJS tagged templates recognize <Button>, <Badge>, <UserCard>, etc.
register(Button, Badge, UserCard, CardSlot, HeaderNav, App);

// Mount top-level component to container
mount(App, "#app");
