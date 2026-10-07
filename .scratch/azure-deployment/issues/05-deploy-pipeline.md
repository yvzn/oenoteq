# 05: Deploy pipeline: tag push to live app

**What to build:** pushing a release tag builds the image (ticket 02), publishes it to GHCR, and rolls the Container App to that new image automatically. No manual `az` commands for a normal release. A failed rollout is visible and does not leave the app down.

**Blocked by:** 04 (Azure infra and Easy Auth)

**Status:** done

- [ ] A tag push updates the running Container App to the new image tag and the new revision serves traffic
- [ ] GitHub authenticates to Azure with OIDC federated credentials (no long-lived client secret stored in GitHub)
- [ ] Deploy waits for the new revision to pass its health check; on failure the previous revision keeps serving and the workflow fails
- [ ] Revision stays single-replica (one SQLite writer) during rollout: old revision is deactivated before or as the new one takes over, so two writers never run against the same replica
- [ ] Manual dispatch available to redeploy or roll back to a given tag
- [ ] Existing Windows exe release workflow unchanged and still green
- [ ] Release procedure documented in `docs/`
