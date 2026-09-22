---
status: accepted
---

# Deploy as a single embedded-Vue Windows executable, no containers or services

The Vue frontend is built and its static output embedded into the Go binary via `go:embed`, so the API and UI ship as one exe on one port (`:8080`) rather than as separate deployables behind a reverse proxy. GitHub Actions cross-compiles for `windows/amd64` on tag push and publishes the exe to a GitHub Release; installing means downloading the zip and unzipping onto the target machine — an old Windows PC on the home LAN, reachable by a static local IP, not always powered on. No Docker, no systemd/Windows Service, no auth. Chosen because this is a single-user personal app with no uptime requirement and no ops appetite: one file to copy beats a container runtime or service supervisor to maintain on hardware repurposed for this alone. Revisit if the app needs to run on multiple hosts, needs zero-downtime deploys, or the PC becomes always-on and auto-start-on-boot is wanted.
