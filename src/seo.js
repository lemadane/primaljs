/**
 * PrimalJS SEO & Head Metadata Management
 */

export function head(meta = {}) {
    if (typeof document === "undefined") return;

    if (meta.title) {
        document.title = meta.title;
        setMetaTag("property", "og:title", meta.title);
    }

    if (meta.description) {
        setMetaTag("name", "description", meta.description);
        setMetaTag("property", "og:description", meta.description);
    }

    if (meta.image) {
        setMetaTag("property", "og:image", meta.image);
    }

    if (meta.robots) {
        setMetaTag("name", "robots", meta.robots);
    }

    if (meta.canonical) {
        setLinkTag("canonical", meta.canonical);
    }

    if (meta.structuredData) {
        setStructuredData(meta.structuredData);
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

function setLinkTag(relVal, hrefVal) {
    let el = document.querySelector(`link[rel="${relVal}"]`);
    if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", relVal);
        document.head.appendChild(el);
    }
    el.setAttribute("href", hrefVal);
}

function setStructuredData(data) {
    let el = document.querySelector(`script[type="application/ld+json"]`);
    if (!el) {
        el = document.createElement("script");
        el.setAttribute("type", "application/ld+json");
        document.head.appendChild(el);
    }
    el.textContent = typeof data === "string" ? data : JSON.stringify(data);
}
