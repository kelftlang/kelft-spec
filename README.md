# Kelft website and specification

**Build with AI. Stay in control.** Kelft is an AI-native, intent-first programming
language designed to keep people in control of AI-generated software. Its
introduction connects practical programming with explicit requirements, trusted
checks and human acceptance, while distinguishing development workflows from
the components available in a particular compiler release.

The source for [www.kelft.com](https://www.kelft.com): Kelft’s introduction,
getting-started guide, and language specification. The
[public Kelft compiler](https://github.com/kelftlang/kelft) is the upstream for
specification content and implementation guidance.

Core 0.1, Intent IR 0.1 and Intent source 0.2 are separate language contracts.
Read the [development specification](spec/README.md), [versioned snapshots](versions/),
or the public compiler’s [installation guide](https://github.com/kelftlang/kelft/blob/main/docs/install.md).
`compiler-source.json` records the imported public commit and content hashes.
An unpublished draft is explicitly labelled and cannot be deployed as production.

Use Node 24 and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
pnpm build
pnpm preview
```

Builds use committed content and need no compiler checkout or network fetch.
The build checks generated pages, assets, downloads, and anchors, as well as source
Markdown. See [maintaining the website](docs/maintaining.md) for upstream imports,
snapshots, automatic update PRs, deployment, custom domains, and rollback.

Prose: CC-BY-4.0. First-party code examples: MIT-0. Site tooling, intrinsic data
and grammar: MIT OR Apache-2.0. Brand artwork: separate terms in TRADEMARKS.md.
All license texts are included. Build dependencies retain their own licenses.
The theme uses system fonts rather than redistributing a font bundle.
