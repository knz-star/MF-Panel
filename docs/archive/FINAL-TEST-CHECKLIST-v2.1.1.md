# MF MPanel v2.1.1 — Deployment Verification Checklist

## Routing regression checks
- [ ] Click Admin → Run System Tests; URL must be `/admin/tests` and diagnostics page must render.
- [ ] Click Admin → Overview; URL must be `/admin`.
- [ ] Click Dashboard on the landing page while signed in; `/dashboard` must redirect to the signed-in user's authorized workspace.
- [ ] Visit an intentionally unknown URL; show the route diagnostic page and missing path instead of silently returning to the landing page.

## Evidence backend checks
- [ ] Deploy Functions to the same Firebase project as the website.
- [ ] Generate pairing code as an active Evidence Team user or authorized admin.
- [ ] If the callable fails, capture the UI reference `EVPAIR-...` and locate the matching `createEvidencePairing failed` log entry.
- [ ] Confirm Get Links works only for an active linked Evidence registration.

## Build commands
```bash
npm install
npm run lint
npm test
npm run build
npm --prefix functions install
npm --prefix functions run build
```

Do not mark production verified until these commands and the live route/callable checks pass.
