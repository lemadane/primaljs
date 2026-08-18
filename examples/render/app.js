import {
    html,
    signal,
    register,
    mount,
    Mount
} from "../../primal.js";

let parentExecutions = 0;

function ProfileView(props) {
    return html`
        <div class="status-box profile-view">
            <h3>Profile Component</h3>
            <p class="prop-title">Title: ${props.title}</p>
            <div class="children-content">${props.children}</div>
        </div>
    `;
}

function SettingsView(props) {
    return html`
        <div class="status-box settings-view" style="border-color: #eab308;">
            <h3 style="color: #eab308;">Settings Component</h3>
            <p class="prop-title">Title: ${props.title}</p>
            <div class="children-content">${props.children}</div>
        </div>
    `;
}

function AnalyticsView(props) {
    return html`
        <div class="status-box analytics-view" style="border-color: #a855f7;">
            <h3 style="color: #a855f7;">Analytics Component</h3>
            <p class="prop-title">Title: ${props.title}</p>
            <div class="children-content">${props.children}</div>
        </div>
    `;
}

function App() {
    parentExecutions++;
    const activeCompSignal = signal(ProfileView);
    const titleSignal = signal("User Account Overview");

    return html`
        <main class="card">
            <h2>PrimalJS Dynamic &lt;Mount&gt; Demo</h2>
            <p class="subtitle">Mount components in owned DOM ranges without parent rerenders</p>

            <p class="exec-count">Parent Executions: ${parentExecutions}</p>

            <div class="button-group">
                <button class="btn-secondary btn-profile" onclick=${() => { activeCompSignal.value = ProfileView; titleSignal.value = "User Profile View"; }}>
                    Profile View
                </button>
                <button class="btn-secondary btn-settings" onclick=${() => { activeCompSignal.value = SettingsView; titleSignal.value = "User Settings View"; }}>
                    Settings View
                </button>
                <button class="btn-secondary btn-analytics" onclick=${() => { activeCompSignal.value = AnalyticsView; titleSignal.value = "System Analytics View"; }}>
                    Analytics View
                </button>
                <button class="btn-secondary btn-null" onclick=${() => activeCompSignal.value = null}>
                    Unmount (Null)
                </button>
            </div>

            <!-- Dynamic <Mount> component tag forwarding props & children -->
            <Mount component=${activeCompSignal} title=${titleSignal}>
                <span class="slotted-badge">Slotted Content Forwarded</span>
            </Mount>
        </main>
    `;
}

register(ProfileView, SettingsView, AnalyticsView, App, Mount);

mount(App, "#app");
