---
layout: home
title: Kelft — Intent, compiled.
description: Explore Kelft, its native compiler, and the Core and Intent language specifications.
hero:
  name: Kelft
  text: Intent, compiled.
  tagline: Typed programs. Explicit constraints. A native compiler written in Kelft.
  image:
    src: /favicon.svg
    alt: Kelft Brandmark
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: Read the specification
      link: /dev/
    - theme: alt
      text: Public compiler
      link: https://github.com/kelftlang/kelft
features:
  - title: Core
    details: Write typed, deterministic executable programs with functions, modules, and structured values.
    link: /dev/language
  - title: Intent
    details: Describe outcomes, constraints, and verification contracts. Declarations make requirements explicit; evidence must establish that they hold.
    link: /dev/intent-v0.2
  - title: Native compilation
    details: Check source, build native programs, and inspect the compiler’s supported capabilities. Target availability depends on the selected release.
    link: /compiler
---

## A first program

<!-- HELLO -->

Save this as `hello.kelft`. With the public compiler installed:

```sh
kelft check hello.kelft --json
kelft run hello.kelft --project-root .
```

See [Getting Started](getting-started.md) for installation and native build instructions.

## Two ways to describe a program

**Core** defines executable behavior. **Intent** adds typed declarations of outcomes,
constraints, capabilities, and change contracts. Both use `.kelft`; their source
forms have separate grammars. Checking a declaration does not prove its requirements.

The compiler, Core, Intent, and specification snapshots have separate versions.
Use the [compatibility guide](dev/compatibility.md) to understand those boundaries.

## Explore the project

- [Public compiler and releases](compiler.md)
- [Core and Intent examples](dev/examples.md)
- [VS Code and compatible editor support](https://github.com/kelftlang/vscode-kelft)
- [Specification Markdown](https://github.com/kelftlang/kelft-spec)
- [Licensing](licensing.md)
