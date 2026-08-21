// @ts-nocheck
import {
    html,
    signal,
    register,
    mount
} from "../../primal.js";

function Greeting(props) {
    return html`
        <h2>
            Hello ${props.children}
        </h2>
    `;
}

function Counter() {
    const count = signal(0);

    function increment() {
        count.value++;
    }

    return html`
        <section class="card">
            <Greeting>
                ${"Lemuel"}
            </Greeting>

            <p class="subtitle">Minimalists’ ReactJS — Pure JS, Signals & Direct DOM</p>

            <button class="btn" onclick=${increment}>
                Count: ${count}
            </button>
        </section>
    `;
}

register(
    Greeting,
    Counter
);

mount(Counter, "#app");
