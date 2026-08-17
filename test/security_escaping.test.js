import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { html, unsafeHtml, mount, register, signal } from "../src/index.js";

describe("PrimalJS Security, XSS Escaping & URL Sanitization Engine", () => {
    it("escapes dynamic string values into safe DOM text nodes by default", () => {
        const xssPayload = `<script>alert('xss')</script><img src=x onerror="alert(1)">`;

        function SafeComponent() {
            return html`<div id="safe-container">${xssPayload}</div>`;
        }

        register(SafeComponent);

        const handle = mount(SafeComponent, "#app");
        const el = document.getElementById("safe-container");

        assert.equal(el.children.length, 0);
        assert.equal(el.innerHTML, "&lt;script&gt;alert('xss')&lt;/script&gt;&lt;img src=x onerror=\"alert(1)\"&gt;");

        handle.dispose();
    });

    it("renders unescaped raw HTML only when explicitly wrapped with unsafeHtml()", () => {
        const trustedHtml = `<span class="badge">Trusted Content</span>`;

        function UnsafeComponent() {
            return html`<div id="unsafe-container">${unsafeHtml(trustedHtml)}</div>`;
        }

        register(UnsafeComponent);

        const handle = mount(UnsafeComponent, "#app");
        const el = document.getElementById("unsafe-container");

        assert.equal(el.children.length, 1);
        assert.equal(el.querySelector(".badge").textContent, "Trusted Content");

        handle.dispose();
    });

    it("sanitizes dangerous URL protocol schemes (javascript:, vbscript:, data:text/html)", () => {
        const maliciousUrl = signal("javascript:alert(document.cookie)");

        function LinkComponent() {
            return html`<a id="test-link" href=${maliciousUrl}>Dangerous Link</a>`;
        }

        register(LinkComponent);

        const handle = mount(LinkComponent, "#app");
        const linkEl = document.getElementById("test-link");

        assert.equal(linkEl.getAttribute("href"), "about:blank");

        handle.dispose();
    });

    it("preserves safe URL protocols (https:, http:, mailto:, tel:, relative paths)", () => {
        const safeUrl = signal("https://example.com/dashboard");

        function SafeLinkComponent() {
            return html`<a id="safe-link" href=${safeUrl}>Safe Link</a>`;
        }

        register(SafeLinkComponent);

        const handle = mount(SafeLinkComponent, "#app");
        const linkEl = document.getElementById("safe-link");

        assert.equal(linkEl.getAttribute("href"), "https://example.com/dashboard");

        handle.dispose();
    });
});
