# Maintaining the Kelft website

`kelft-spec` hosts **www.kelft.com**, Kelft’s main website for now. Specification
content comes from [kelftlang/kelft](https://github.com/kelftlang/kelft), not a
private compiler checkout. Website introductions live in `pages/`; imported
Markdown stays byte-for-byte identical to the public compiler. The renderer
adjusts source links and adds provenance without changing imported files.

## Import a public compiler revision

Use Node 24 and pnpm 11.19.0. Run from this repository:

```sh
pnpm sync --ref main
pnpm check
pnpm test
pnpm build
```

Prefer an explicit public commit SHA or tag for manual review. `main` is resolved
once to a full commit SHA before fetching inputs. The importer only reads public
specification files, version metadata, supporting documents, and the hello
example. It never executes upstream tools. Failed downloads or invalid inputs
do not change the local import. Source hashes, paths, and versions are recorded
in `compiler-source.json`; local edits cause a conflict rather than an overwrite.

An unchanged input set keeps its existing pin even if unrelated compiler commits
have landed. Review generated changes before merging. `pnpm build` is offline;
`pnpm build:production` additionally checks that the pinned public commit and
content are resolvable. Neither command builds the compiler.

For preparation before the compiler’s first public commit only:

```sh
pnpm sync --draft --source ../kelft
```

This labels the input as an unpublished draft, records no fabricated source SHA,
and permits local previews. Production deployment refuses draft inputs. Once the
compiler has a public commit, replace the draft through a normal public import.
Before committing an initial draft snapshot, replace it with a public pin:

```sh
pnpm sync --ref PUBLIC_COMMIT_SHA
pnpm snapshot 0.2.0 --refresh-uncommitted
pnpm build:production
```

The refresh option only accepts an existing, hash-valid unpublished draft whose
snapshot directory has no tracked or staged files and no history across available
Git refs. An unrelated README-only commit does not prevent that refresh. Pinned
snapshots and snapshots previously committed on any available branch or tag remain
immutable. Production requires public pins for both the development reference and
every versioned snapshot. Finish this initial pinning before committing the snapshot
and enabling the website’s update schedule.

## Automatic update PRs

The daily **Update compiler specification** workflow resolves public compiler
`main`. It skips dependency installation and building if imported inputs have
not changed; otherwise it validates the import, tests, and built site before
opening/updating `automation/update-compiler-spec`. It never changes snapshots,
merges a PR, or deploys. A human-modified automation branch causes a conflict.

Enable Actions and the repository setting allowing GitHub Actions to create pull
requests. The update job uses repository-scoped `GITHUB_TOKEN` permissions
`contents: write` and `pull-requests: write`; no private-repository token is needed.
Bot-created/updated PR workflows may require a maintainer to approve their runs.
The sync job validates its proposed content independently. See
[GitHub workflow behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).

## Versioned references

Current Core, Intent, compiler, and specification versions are separate identities.
The `/dev/` reference follows reviewed compiler imports; `/vVERSION/` retains the
original source lock and content. Create a new snapshot explicitly:

```sh
pnpm snapshot 0.2.1
```

Snapshot creation requires a public pin and refuses an existing version. Update
the website’s `publication.json` version when selecting a new current snapshot.
Never rewrite committed/released snapshot bytes. The initial uncommitted draft
may be refreshed during first-publication preparation, with hash checks intact.

## GitHub Pages and the custom domain

After review, commit and merge into `main`. In repository **Settings → Pages**,
select **GitHub Actions** as the publishing source. Verify domain ownership, set
the custom domain to **www.kelft.com**, then configure DNS:

- `www`: CNAME to `kelftlang.github.io` (no repository path).
- Apex `kelft.com`: use the DNS provider’s supported ALIAS/ANAME to the Pages
  host, or GitHub’s documented A/AAAA records, so the apex can redirect to `www`.
- Enable **Enforce HTTPS** once GitHub has provisioned the certificate.

Configure the Pages domain before pointing DNS at it. For custom Actions
deployments GitHub ignores repository `CNAME` files; the Pages setting is required.
Follow [GitHub’s current domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
for verification, exact DNS addresses, propagation, and certificate checks.

Manually run **Publish Kelft website** from `main`. It verifies the public compiler
pin, runs tests, builds and crawls the site, then deploys the Pages artifact.
PRs validate without deployment. After deployment check the root page, a current
reference, a versioned reference, both intrinsic JSON downloads, search, and HTTPS.

To roll back, review and merge a revert restoring a prior site and compiler lock,
then manually redeploy. Existing snapshots remain unchanged.

## Moving the documentation later

`publication.json` configures `origin` and `base`. They default to
`https://www.kelft.com` and `/`. Use base `/docs/` for a subdirectory, or origin
`https://docs.kelft.com` with base `/` for a subdomain. Preview overrides are
`KELFT_SITE_ORIGIN` and `KELFT_SITE_BASE`. Rebuild to regenerate links, canonical
URLs, robots.txt, and sitemap; reconfigure hosting/DNS and redirects separately.
Keep existing `/dev/` and `/vVERSION/` suffixes when migrating.

Generated `site/`, `.vitepress/dist/`, `.vitepress/cache/`, and `.vitepress/.temp/`
are ignored. No generated assets should enter a source commit. `.publication.json`
tracks the reviewed scaffold/import inventory; synchronization updates imported
entries while preserving other files. Contributions follow [the contribution guide](../CONTRIBUTING.md).
