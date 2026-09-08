# 01: Project skeleton

**What to build:** A running Go HTTP API backed by SQLite, with migrations and a test harness that exercises the real database (per the spec's testing seam — no mocked storage), proven out with a single trivial endpoint. This is the foundation every other ticket builds on; it carries no user-facing feature on its own beyond confirming the service is alive.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Go module set up with an HTTP server that starts and serves requests
- [ ] SQLite wired up with a migration mechanism (schema versioned, repeatable)
- [ ] A health-check endpoint (e.g. `GET /health`) returns a success response
- [ ] Test harness exists that spins up a real SQLite (temp-file or in-memory) per test run and drives the HTTP layer — no mocking of storage
- [ ] At least one test exercises the health-check endpoint through this harness, establishing the pattern later tickets will follow
