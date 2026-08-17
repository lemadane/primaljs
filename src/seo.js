/**
 * PrimalJS SEO & Head Metadata Management Engine
 * Dynamically updates and cleans up stale head metadata when navigating between routes.
 */

let initialTitle = typeof document !== "undefined" ? document.title : "";

export function head(meta = {}) {
    if (typeof document === "undefined") return;

    const m = meta || {};

    // 1. Title
    if (m.title) {
        document.title = m.title;
        setMetaTag("property", "og:title", m.title);
    } else {
        if (initialTitle) {
            document.title = initialTitle;
        }
        removeMetaTag("property", "og:title");
    }

    // 2. Description
    if (m.description) {
        setMetaTag("name", "description", m.description);
        setMetaTag("property", "og:description", m.description);
    } else {
        removeMetaTag("name", "description");
        removeMetaTag("property", "og:description");
    }

    // 3. Image
    if (m.image) {
        setMetaTag("property", "og:image", m.image);
    } else {
        removeMetaTag("property", "og:image");
    }

    // 4. Robots
    if (m.robots) {
        setMetaTag("name", "robots", m.robots);
    } else {
        removeMetaTag("name", "robots");
    }

    // 5. Canonical Link
    if (m.canonical) {
        setLinkTag("canonical", m.canonical);
    } else {
        removeLinkTag("canonical");
    }

    // 6. Custom meta tags array (meta: [{ name: "...", content: "..." }, { property: "...", content: "..." }])
    if (Array.isArray(m.meta)) {
        for (const item of m.meta) {
            if (item) {
                const keyAttr = item.name ? "name" : (item.property ? "property" : (item.httpEquiv ? "http-equiv" : null));
                const keyVal = item.name || item.property || item.httpEquiv;
                if (keyAttr && keyVal && item.content !== undefined) {
                    setMetaTag(keyAttr, keyVal, item.content);
                }
            }
        }
    }

    // 7. Custom link tags array (link: [{ rel: "canonical", href: "..." }])
    if (Array.isArray(m.link)) {
        for (const item of m.link) {
            if (item && item.rel && item.href) {
                setLinkTag(item.rel, item.href);
            }
        }
    }

    // 8. JSON-LD Structured Data
    if (m.structuredData || m.jsonLd) {
        setStructuredData(m.structuredData || m.jsonLd);
    } else {
        removeStructuredData();
    }
}

function setMetaTag(keyAttr, keyVal, contentVal) {
    let el = document.querySelector(`meta[${keyAttr}="${keyVal}"]`);
    if (!el) {
        el = document.createElement("meta");
        el.setAttribute(keyAttr, keyVal);
        document.head.appendChild(el);
    }
    el.setAttribute("content", contentVal);
}

function removeMetaTag(keyAttr, keyVal) {
    const el = document.querySelector(`meta[${keyAttr}="${keyVal}"]`);
    if (el && el.parentNode) {
        el.parentNode.removeChild(el);
    }
}

function setLinkTag(relVal, hrefVal) {
    let el = document.querySelector(`link[rel="${relVal}"]`);
    if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", relVal);
        document.head.appendChild(el);
    }
    el.setAttribute("href", hrefVal);
}

function removeLinkTag(relVal) {
    const el = document.querySelector(`link[rel="${relVal}"]`);
    if (el && el.parentNode) {
        el.parentNode.removeChild(el);
    }
}

function setStructuredData(data) {
    let el = document.querySelector(`script[type="application/ld+json"]`);
    if (!el) {
        el = document.createElement("script");
        el.setAttribute("type", "application/ld+json");
        document.head.appendChild(el);
    }
    const jsonString = typeof data === "string" ? data : JSON.stringify(data);
    el.textContent = jsonString;
}

function removeStructuredData() {
    const el = document.querySelector(`script[type="application/ld+json"]`);
    if (el && el.parentNode) {
        el.parentNode.removeChild(el);
    }
}
