# Publishing to npm

The [`publish.yml`](../.github/workflows/publish.yml) workflow publishes `@lemadane/primaljs` when a GitHub release is published. Draft releases do not trigger publication. It checks out the release tag, validates package metadata, builds bundles, runs unit and example tests, inspects the package, and publishes with public access.

Authentication uses npm trusted publishing (OIDC), so no `NPM_TOKEN` repository secret is needed. The workflow uses GitHub-hosted runners, Node.js 24, and npm 11 with trusted publishing support. npm automatically generates provenance for public packages published from public GitHub repositories through OIDC.

## One-time npm setup

Use the existing package page: [@lemadane/primaljs on npm](https://www.npmjs.com/package/@lemadane/primaljs). This workflow is for subsequent releases; no additional initial manual publish is needed.

Sign in with a package-maintainer account, open **Settings → Trusted publishing**, and add a **GitHub Actions** publisher with these exact values:

| Field | Value |
| --- | --- |
| Organization or user | `lemadane` |
| Repository | `primaljs` |
| Workflow filename | `publish.yml` |
| Environment name | Leave blank; the workflow does not use an environment |
| Allowed actions | Enable direct publishing with `npm publish` |

New trusted publisher configurations must complete their first successful publish within two days. If one expires, delete it and create another before releasing.

See [npm's trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/) for configuration details. Repository changes do not configure this npm account setting automatically.

## Publishing a release

1. Check existing versions with `npm view @lemadane/primaljs versions --json`. Set an unused version in `package.json` and `package-lock.json`, for example `npm version 0.4.3-beta --no-git-tag-version`.
2. Update version-specific documentation, commit the changes, and push them to GitHub.
3. Create and publish a GitHub release with a tag exactly matching `v` plus the package version, for example `v0.4.3-beta`. Create the tag from the intended release commit containing this workflow.
4. For a version with a prerelease suffix, check **Set as a pre-release** in GitHub. For a stable version, leave that unchecked.
5. Inspect the **Publish to npm** Actions run and verify the published version with `npm view @lemadane/primaljs dist-tags`.

All prerelease versions go to the npm `beta` tag; stable versions go to `latest`. GitHub's separate “latest release” designation does not choose the npm tag. The workflow rejects a release whose tag or prerelease flag disagrees with its package metadata.

An already-published name/version cannot be overwritten. Use a new version for changed contents. For a failed workflow, inspect the publish step before rerunning: it may have reached npm even if a later network response failed.

## Local checks

```bash
node --test test/release_metadata.test.js
npm run build
npm test
npm run test:examples
npm pack --dry-run
```

These checks do not publish. OIDC authentication and the actual registry upload can only be verified by a configured GitHub Actions release run. Cross-browser E2E checks remain in the existing CI workflow; they are not run by the publish workflow.
