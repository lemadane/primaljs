import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Validate the release before any registry write and choose its npm channel. */
export function releaseMetadata(pkg, lock, tag, prerelease) {
    if (pkg.name !== "@lemadane/primaljs") {
        throw new Error("Unexpected npm package name.");
    }
    if (tag !== `v${pkg.version}`) {
        throw new Error(`Release tag must be v${pkg.version}; received ${tag}.`);
    }
    if (lock.name !== pkg.name || lock.version !== pkg.version ||
        lock.packages?.[""]?.name !== pkg.name || lock.packages?.[""]?.version !== pkg.version) {
        throw new Error("package.json and package-lock.json must have matching names and versions.");
    }
    const isPrerelease = pkg.version.split("+")[0].includes("-");
    if (prerelease !== isPrerelease) {
        throw new Error("GitHub release prerelease status must match the package version.");
    }
    return { version: pkg.version, dist_tag: isPrerelease ? "beta" : "latest" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
    const metadata = releaseMetadata(pkg, lock, process.env.RELEASE_TAG, process.env.RELEASE_PRERELEASE === "true");
    for (const [key, value] of Object.entries(metadata)) {
        console.log(`${key}=${value}`);
    }
}
