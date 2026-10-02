# Team Manager

Modern football team web app. **Mobile-first**, zero-runtime-dependency on public pages, black/lime soft-glass visual design. Intended for a single principal team per organization.

> **Stage**: stable read-only frontend. Admin match editing, event authorization, roster mutation and import processes are intentionally not implemented yet.

## Open the app

The deployment workflow validates and publishes the `dist/` folder to **GitHub Pages**, once Pages has been enabled with **GitHub Actions** as its source in the repository settings. Expected path: `https://emanuelesordo.github.io/team-manager-next/`.

## Develop

- `npm run dev` — local server at `http://localhost:8080` (no install required).
- `npm run check` — domain tests, module syntax validation, deterministic production build.
- `npm run build` — publishable `dist/` directory; only runtime files are copied.

This is a **native HTML/CSS/ESM application**, without a front-end framework or runtime bundle. The logged-out experience fetches the Supabase REST endpoint directly. The pinned Supabase Auth SDK is lazy-loaded only for sign-in and active sessions. Images are lazy-loaded and the prototype screenshot is excluded from production.

## Architecture

- Backend: the existing `team-manager` Supabase project. No new tables or migrations.
- Principal team, season, competition, fixture, match, event and ratings use the existing app-specific schema as documented in [the data map](docs/architecture-data.md).
- Supabase RLS and column privileges decide server-side authorization. UI access is not an authorization boundary.
- All standings, match results and statistical cards reflect existing records only. No fabricated sports data.
- A missing score is different from 0–0; an event suggestion is not automatically official.

## Design and documentation

The supplied brief is preserved in [`docs/specification-original.txt`](docs/specification-original.txt), the reference image (WebP) in [`assets/reference-design.webp`](assets/reference-design.webp). They are product-direction references, **not** a frozen official README. The README stays intentionally concise; details evolve by topic:

| Document | Purpose |
|---|---|
| [Design](docs/design-system.md) | Palette, glass treatment, mobile/desktop behavior, animation |
| [Architecture](docs/architecture-data.md) | Model, sources of truth, API, caching and null handling |
| [Modules](docs/modules.md) | Screens and user-facing functionality |
| [Security](docs/security.md) | Supabase grants, RLS, Auth, personal data and CORS |
| [Roadmap](docs/roadmap.md) | Planned development milestones, explicitly distinguished from production |
| [Deployment](docs/deployment.md) | Build and GitHub Pages configuration |

## Product constraints

The `app_*` model and the general administrative model (`seasons`, `matches`, etc.) are distinct and intentionally **not** merged. Fixtures are authoritative for results and match scheduling. The interface supports historical seasons, clear missing-data states and deep links with hash navigation. Public assets contain only the Supabase publishable API key, never privileged credentials.
