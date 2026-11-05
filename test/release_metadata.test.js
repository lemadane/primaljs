import { test } from "node:test";
import assert from "node:assert/strict";
import { releaseMetadata } from "../scripts/release-metadata.js";

function fixture(version) {
    const pkg = { name: "@lemadane/primaljs", version };
    return [pkg, { ...pkg, packages: { "": { ...pkg } } }];
}

test("prereleases publish to beta and stable releases to latest", () => {
    assert.deepEqual(releaseMetadata(...fixture("0.4.2-beta"), "v0.4.2-beta", true), {
        version: "0.4.2-beta", dist_tag: "beta"
    });
    assert.deepEqual(releaseMetadata(...fixture("1.0.0"), "v1.0.0", false), {
        version: "1.0.0", dist_tag: "latest"
    });
});

test("mismatched tags, lockfiles, package names, and release flags are rejected", () => {
    const [pkg, lock] = fixture("0.4.2-beta");
    assert.throws(() => releaseMetadata(pkg, lock, "v0.4.1", true), /Release tag/);
    assert.throws(() => releaseMetadata(pkg, lock, "v0.4.2-beta", false), /prerelease status/);
    assert.throws(() => releaseMetadata({ ...pkg, name: "other" }, lock, "v0.4.2-beta", true), /package name/);
    assert.throws(() => releaseMetadata(pkg, { ...lock, version: "0.4.1" }, "v0.4.2-beta", true), /matching/);
    assert.throws(() => releaseMetadata(pkg, { ...lock, packages: {} }, "v0.4.2-beta", true), /matching/);
    assert.throws(() => releaseMetadata(...fixture("1.0.0"), "v1.0.0", true), /prerelease status/);
});
