import "./setup.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { head } from "../src/index.js";

describe("PrimalJS head() Metadata Management Engine API Compatibility", () => {
    it("supports primary flat options API (title, description, image, robots, canonical, jsonLd)", () => {
        head({
            title: "Test Page Title",
            description: "Test description content",
            image: "https://example.com/test.png",
            robots: "noindex, nofollow",
            canonical: "https://example.com/test",
            jsonLd: { "@context": "https://schema.org", "@type": "WebPage", name: "Test" }
        });

        assert.equal(document.title, "Test Page Title");
        assert.equal(document.querySelector('meta[name="description"]').getAttribute("content"), "Test description content");
        assert.equal(document.querySelector('meta[property="og:description"]').getAttribute("content"), "Test description content");
        assert.equal(document.querySelector('meta[property="og:image"]').getAttribute("content"), "https://example.com/test.png");
        assert.equal(document.querySelector('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
        assert.equal(document.querySelector('link[rel="canonical"]').getAttribute("href"), "https://example.com/test");
        assert.ok(document.querySelector('script[type="application/ld+json"]').textContent.includes("schema.org"));
    });

    it("supports custom meta and link tag arrays API (meta: [...], link: [...])", () => {
        head({
            title: "Custom Array Test",
            meta: [
                { name: "author", content: "Lemuel Adane" },
                { property: "og:site_name", content: "PrimalJS Showcase" }
            ],
            link: [
                { rel: "alternate", href: "https://example.com/en" }
            ]
        });

        assert.equal(document.title, "Custom Array Test");
        assert.equal(document.querySelector('meta[name="author"]').getAttribute("content"), "Lemuel Adane");
        assert.equal(document.querySelector('meta[property="og:site_name"]').getAttribute("content"), "PrimalJS Showcase");
        assert.equal(document.querySelector('link[rel="alternate"]').getAttribute("href"), "https://example.com/en");
    });
});
