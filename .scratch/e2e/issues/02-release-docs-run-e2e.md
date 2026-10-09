# 02: Release docs: run the E2E before release

**What to build:** the release instructions tell the developer to run the E2E suite before releasing, so the missing CI gate is covered by a written step. They also name the trigger for promoting the suite to CI. See `.scratch/e2e/spec.md`.

**Blocked by:** 01: Playwright harness and offline-create tracer

**Status:** ready-for-agent

- [ ] The release instructions contain one line: run the E2E command before releasing
- [ ] The same place notes the promotion trigger: the first regression that slips past local runs gets a CI job
- [ ] The command named matches the one delivered by ticket 01
