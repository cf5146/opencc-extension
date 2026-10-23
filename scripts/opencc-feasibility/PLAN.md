# Official OpenCC WASM Feasibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build official 1.4.2 with Jieba and prove parity plus long-input behavior in Edge.
**Architecture:** Compile unchanged official core and Jieba implementation. A local static-plugin discovery adapter replaces native dynamic-library loading for WASM. A length-aware heap binding passes complete UTF-8 text; resources remain separately hashed and packaged.
**Tech Stack:** WSL Debian, Emscripten 4.0.22, Python 3.13.9, CMake 3.31.10, Ninja 1.13.0, Node, installed Edge.
**Spec:** SPEC.md

## Global Constraints
- No production engine/UI/DOM changes or publishing.
- Official source tree remains unchanged; source commit and resources are hash-checked.
- No stack string marshalling for text; no truncation, chunking, automatic mode fallback.
- Toolchain isolated from system configuration; first mounted-filesystem Python extraction failed, so tools use the project-specific WSL-native cache.

## Review Focus
- UTF-8 growth and embedded NUL must not truncate output.
- Handles and input allocations must be released on success and error.
- Static plugin discovery must use official Jieba segmentation implementation.
- Native parity uses the same config/policy and fixed corpus, not universal-quality claims.
- Browser stress failures must not contaminate later runs.

### Task 1: Build source-pinned artifacts
- [x] Write and run acceptance probe: missing artifacts fails.
- [x] Add CMake/build script, minimal C binding and static plugin loader.
- [x] Build from verified official commit; copy generated WASM/JS out of WSL.

### Task 2: Resource and runtime boundary
- [x] Prepare exact official 1.4.2 resources and hash manifest.
- [x] Add async initializer followed by length-aware synchronous complete-text conversion.
- [x] Pass native oracle corpus and 100k/1m length-aware regression checks.

### Task 3: Edge and evidence
- [x] Run same oracle and stress checks in isolated MV3 Edge worker.
- [x] Measure initialization, warm conversion, linear memory and selected artifact size.
- [x] Independent review, fix material findings, record limits and go/no-go.

