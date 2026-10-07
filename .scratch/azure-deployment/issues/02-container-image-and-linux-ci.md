# 02: Container image and Linux CI build

**What to build:** a multi-stage Dockerfile (build SPA, build Go with `CGO_ENABLED=0`, minimal runtime image) and a GitHub Actions job that builds and pushes the image to GHCR on tag push alongside the existing Windows exe release.

**Blocked by:** 01

**Status:** implemented (image built and run locally; CI push to GHCR verified on first tag)

- [x] `docker build` produces an image that serves the embedded SPA and API on `PORT`
- [x] Image runs as non-root and holds no secrets
- [x] CI builds `linux/amd64` on tag push and pushes to GHCR (`ghcr.io/yvzn/oenoteq`)
- [x] Existing Windows exe release workflow unchanged and still green
