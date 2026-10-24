---
title: Getting started with Kelft
description: Install the public native compiler and check, build, and run a first Kelft program.
---

# Getting started

## Install the public compiler

Check the [public compiler’s releases](https://github.com/kelftlang/kelft/releases)
for available packages. Follow the [installation guide](<!-- COMPILER_INSTALL -->)
for your operating system, prerequisites, checksum verification, and provenance.
An available specification profile does not guarantee that a matching package has
been published or qualified for your host.

Extract the package into a user-owned directory. Add its `bin` directory to PATH,
or invoke `bin/kelft` (`bin/kelft.exe` on Windows) by its full path. Installed native
compilation needs no Node, Rust, or C development tools. Building the website is
a separate developer task with its own Node dependencies.

## Write a program

Save the public compiler’s hello example as `hello.kelft`:

<!-- HELLO -->

From that directory:

```sh
kelft version
kelft check hello.kelft --json
kelft build hello.kelft -o hello
kelft run hello.kelft --project-root .
```

On Windows use `-o hello.exe` for the build output. The output directory must
already exist. `build` creates an executable; `run` compiles and executes through
the platform boundary. Follow the public installation guide for host requirements
and command exit codes.

## Choose your next step

Read [Core](dev/language.md) for executable source or [Intent](dev/intent-v0.2.md)
for declarations and verification contracts. See [examples](dev/examples.md) for
both forms. Install [Kelft editor support](https://github.com/kelftlang/vscode-kelft)
for highlighting and compiler integration; follow its README for current features
and distribution options.
