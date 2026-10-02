# GitHub Pages / deployment

## Publish

1. Repository `emanuelesordo/team-manager-next`, public, `main` branch.
2. Settings → Pages → **Build and deployment** → Source: **GitHub Actions**.
3. Push to `main` triggers `.github/workflows/pages.yml`.
4. `npm run check` runs unit tests, checks JavaScript syntax and builds `dist/`.
5. The workflow uploads only `dist`, and deploys via Pages. No Supabase service-role key is needed.

Expected URL: https://emanuelesordo.github.io/team-manager-next/ (verify after deployment).

## What ships

- Static HTML/ES modules/CSS/SVG, PWA icons and manifest.
- `sw.js`: best-effort same-origin shell offline caching, **never** Supabase/API/auth data. Navigation is network-first.
- Build-time CSS hash. No demo data, original specifications or big reference screenshot in the deployed artifact.

## Backend

- Existing URL/anon publishable key in `src/config.js`; this is by design public.
- Existing `auth-login` function must allow requests from the Pages origin (CORS).
- Never place secret keys, credentials, or sensitive row snapshots in this public repository.
- Validate anonymous, authenticated player, fan and admin experiences separately. Editing requires audited server-side authorization and an explicit feature rollout.

## Troubleshooting

- Page 404: Pages not enabled, workflow has not completed, or incorrect Pages source.
- Black skeleton + partial-data state: inspect DevTools Network for Supabase REST status, RLS/GRANT errors or blocked CORS.
- Login error only: check the deployed `auth-login` Edge Function and its CORS configuration.
- Stale shell: refresh or unregister the service worker after deployment; update `VERSION` inside `sw.js` for major shell changes.
