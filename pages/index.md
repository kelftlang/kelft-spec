---
layout: home
title: Kelft — Build with AI. Stay in control.
description: An AI-native, intent-first programming language designed for safer, verifiable software under human control.
hero:
  name: Kelft
  text: Build with AI. Stay in control.
  tagline: Kelft is an AI-native programming language designed to keep people in control of AI-generated software. Describe the outcomes and constraints that matter, let AI propose an implementation, and use trusted checks and explicit review to control what gets accepted. Its compiler builds accepted source without asking AI to generate it again.
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
  - title: Build practical software
    details: Write typed Core programs with functions, modules, and structured values. Kelft has a self-hosted compiler and native compilation; availability depends on the selected release.
    link: /dev/language
  - title: Put intent first
    details: Describe outcomes, constraints, permissions, and authorized changes. Code-optional development still produces executable programs; declarations alone do not prove requirements.
    link: /dev/intent-v0.2
  - title: Check before accepting
    details: Kelft's development workflow combines supported contract checks, registered tests, and explicit review. Trusted checks and external grants remain outside the proposal's control.
    link: /compiler
---

Kelft is under active development as a general-purpose language and
software-development system. The authoring workflow and optional targets described
here are distinct from the commands and components included in a particular
native alpha. See [compiler versions and availability](compiler.md#versions-and-availability).

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

## People define the boundaries

Code that compiles or passes incomplete tests can still violate what someone
asked for. AI-generated changes may misunderstand requirements, remove protections
or exceed the authorized scope. Kelft is designed around a simple principle:
AI can propose software, while people retain authority over its requirements,
permissions and acceptance.

In the development authoring workflow, people define the requirements and trusted
checks. AI proposes code within configured limits. Kelft checks supported contracts
and registered tests, reports unresolved obligations, and presents the changes for
review. Acceptance records the reviewed inputs and evidence; supported accepted
builds can reproduce artifacts from identified inputs without AI.

A visual change should not automatically authorize changing access-control rules.
The configured workflow protects human-owned code, fixtures and external grants
from proposal edits. Supported runtime permissions require external grants within
compiled restrictions. These boundaries depend on trusted tools and host
mechanisms; they are not a complete operating-system sandbox for a coding agent.

Trusted verification means checks controlled outside the proposal, not an
independent security audit or proof of every behavior. Reproducibility does not
guarantee correctness or security. Read the
[Intent development contract](dev/intent-v0.2.md) for supported checks and obligations.

## A language built around this workflow

Other languages and coding assistants can use independent tests, permissions and
review systems. Kelft makes intent and constraints first-class inputs and develops
these controls together as part of a programming language and its tooling.
Its compiler works independently of AI generation, and Core programs can be
written directly.

The compiler, Core, Intent, and specification snapshots have separate versions.
Use the [compatibility guide](dev/compatibility.md) to understand those boundaries.

Kelft's mission is to make AI-generated software safer, more predictable,
understandable and controllable. Whether software is proposed by today’s coding
assistants or future systems with general or superhuman capabilities, people
should retain authority over its requirements, permissions and acceptance.
Its long-term research direction is to evaluate
how explicit requirements, restricted authority and evidence-based acceptance can
support oversight of increasingly autonomous software development. Broader safety
benefits and comparative advantages remain open research questions.

## Explore the project

- [Public compiler and releases](compiler.md)
- [Core and Intent examples](dev/examples.md)
- [VS Code and compatible editor support](https://github.com/kelftlang/vscode-kelft)
- [Specification Markdown](https://github.com/kelftlang/kelft-spec)
- [Licensing](licensing.md)
