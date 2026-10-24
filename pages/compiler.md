---
title: The Kelft compiler
description: Find the public Kelft compiler, installation instructions, platform information, and release guidance.
---

# The Kelft compiler

The [public compiler repository](https://github.com/kelftlang/kelft) contains the
Kelft compiler, its source specification, examples, and build documentation.
The self-hosted compiler is written in Kelft. Its installed native compilation
path does not depend on Node or a TypeScript compiler.

Start with the public compiler’s:

- [Installation guide](<!-- COMPILER_INSTALL -->)
- [Build guide](<!-- COMPILER_BUILD -->)
- [Architecture and host dependencies](<!-- COMPILER_ARCHITECTURE -->)
- [Releases](https://github.com/kelftlang/kelft/releases)
- [Issue tracker](https://github.com/kelftlang/kelft/issues)
- [Contribution guide](<!-- COMPILER_CONTRIBUTING -->)

## Versions and availability

<!-- COMPILER_IDENTITY -->

The development reference follows reviewed imports from public compiler `main`.
It may describe work beyond a published compiler release. Versioned references
are preserved snapshots, with their own compiler source identity. Neither a
specification snapshot nor successful source checking establishes platform
qualification or application correctness.

For actual target availability, inspect your compiler’s capabilities and the
exact release’s platform documentation, provenance, and qualification results.

## Improving the specification

Propose language and runtime corrections in the [public compiler repository](https://github.com/kelftlang/kelft).
Include the page, source commit, a minimal example, expected behavior, and compiler
output. Website presentation changes belong in [kelft-spec](https://github.com/kelftlang/kelft-spec).
The site receives specification changes through reviewed synchronization PRs.
