# Decisions

Why things are the way they are. Newest at the bottom; a decision that gets replaced stays here, marked as such.

| # | Decision | Why | Alternatives considered |
| --- | --- | --- | --- |
| 1 | **Self-hosted LiveKit** for video | An SFU uploads each screen once and fans it out; open source, Docker image, good browser SDK | Peer-to-peer mesh (every viewer costs the sharer upload bandwidth), hosted services (cost, data leaves our server) |
| 2 | **One room, one screen slot** in version 1 | The product is "watch my screen with friends"; the limit is kept as a limit so more screens can come later | Rooms, multiple screens from day one |
| 3 | **No camera, no microphone** | Scope: voice already happens elsewhere; fewer permissions to ask for | — |
| 4 | **Monorepo** (`api/`, `web/`, compose, docs) with a separate private repo for the shared proxy | The app repo knows how to run the app; the infra repo knows how to reach it | One repo per service |
| 5 | **Java 21 + Spring Boot** for the API | Mature security and data libraries; the backend stack most job postings ask for | Node/TypeScript end to end |
| 6 | **Google sign-in + request access + admin approval** | Real identities without passwords; approving people in the app instead of editing a list | Fixed allowlist in configuration |
| 7 | **Server-side sessions** in PostgreSQL (Spring Session JDBC) | Removing a member can end their sessions immediately | Stateless JWT sessions |
| 8 | **Screen slot in API memory**, polled every 2 s | One instance and a few people: simple and enough | Database table, LiveKit room metadata, WebSockets |
| 9 | **LiveKit tokens signed with Nimbus JOSE** | Already on the classpath through Spring Security; one small class | LiveKit's server SDK |
| 10 | **Take over = steal, after a confirmation** | Friends, not strangers: whoever wants the screen gets it | Refuse while busy; ask the sharer |
| 11 | **Screen audio allowed, never a microphone** | Watching a game or a video needs its sound | Screen only |
| 12 | **LiveKit media on one UDP port** (plus a TCP fallback) | One firewall rule instead of a 10,000-port range; fine for a small group | Port range |
| 13 | **Caddy** as the shared reverse proxy | Automatic HTTPS, short config | nginx + certbot, Traefik |
| 14 | **Caddy everywhere**: the web image serves the build with Caddy built from source on the latest Go (same recipe as the proxy, decision 21), running as a non-root user | One web server to know instead of two, with a short config; building from source keeps it free of HIGH/CRITICAL findings | nginx inside the web image (a second server and config style to maintain); the official Caddy image (lags behind Go's security releases) |
| 15 | **Trunk-based: `main` + release tags** (replaced `develop` → staging, `main` → production) | One long-lived branch; production gets the exact image staging tested | Git flow with `develop` and `main` |
| 16 | **Build once, promote**: images built in CI, servers only pull | What's tested is what runs; fast deploys; rollback = previous image | Building on the server |
| 17 | **Pipeline stages: build → validate → tests + vulnerability scan + SAST → publish → deploy with rollback** | Catch problems in the cheapest place; nothing unscanned is published | Tests only |
| 18 | **Trivy and Semgrep** for scanning | Free, run anywhere (no paid code scanning needed for a private repository) | CodeQL (free only for public repositories), Snyk |
| 19 | **Deploy over SSH with a forced-command key** | The key can only run the deploy script | Self-hosted runner on the server, webhook-triggered deploys |
| 20 | **Checks on every commit**, one reusable workflow shared with the stage release | Problems show up on the commit that caused them, before a pull request; one definition of "passes" | Checks only on pull requests |
| 21 | **The proxy runs Caddy rebuilt from source** on the latest Go with updated libraries, rebuilt weekly by CI | The official Caddy image lagged behind Go's security releases (17 HIGH findings, mostly denial of service); rebuilding fixed all of them and keeps automatic HTTPS | Migrating the proxy to nginx + certbot (more moving parts, risky switch, same result). The web image uses the same recipe (decision 14) |
| 22 | **Spec-driven development on GitHub Issues**: issue → approved spec → approved plan → tasks → PR proving every acceptance criterion; Claude Code commands for each stage | The trail from need to deployed code is visible in one place, next to the code; mirrors a Jira workflow without a second tool | Jira, Slack for backlog, GitHub's Spec Kit (heavier) |
| 23 | **Pipeline results go to Discord** through a channel webhook, for every stage release (success and failure) | Already where Henrique looks; one secret, nothing to host; success messages confirm what's live | Email over SMTP (needs a mailbox and three secrets), a Discord bot (hosting and a token for the same result) |
| 24 | **LiveKit webhooks free the screen slot** when the sharing connection leaves or its screen track stops ([spec 0038](../specs/0038-stale-slot/spec.md)); one connection per person | LiveKit already knows at once; signed events, nothing to poll | The API polling LiveKit's participant list; heartbeats from the sharer's browser; one identity per connection (several devices at once) |
