# MF MPanel v2.14.0 — Remaining QA blockers

This package is **not approved for production deployment** yet.

## Dependency-backed lint/build

The source workspace has no installed `node_modules` and no `package-lock.json`. Installing dependencies timed out because this execution environment cannot resolve `registry.npmjs.org`. `npm run lint` therefore fails before TypeScript checking starts (`TS2688: Cannot find type definition file for 'vite/client'`). This is an environment/dependency blocker, not a confirmed source lint failure or pass.

To complete this check, use a Node environment with registry access and run:

```bash
npm install
npm run audit:source
npm test
npm run test:acceptance
npm run lint
npm run build
```

Commit the generated lockfile only after reviewing the resolved dependency versions and passing tests.

## PostgreSQL migration testing

The six migrations listed in `DEPLOYMENT-v2.14.0-SINGLE-TEAM-ASSIGNMENT.md` must be applied in order to an isolated staging database and exercised with representative Admin, Searching, Checking, Reports, and Evidence accounts. Do not use production as a syntax-test target and do not apply these blindly.

The linked Supabase project currently has no development branches. Creating an isolated Supabase branch triggered a cost-confirmation requirement; no branch was created and no production SQL was executed. Obtain explicit cost approval, create a QA branch, run each missing migration there, and verify RPC permissions, RLS isolation, existing Android pairing compatibility, and migration idempotency before any production change.

## Migration filename fix

A duplicate local migration timestamp was found and corrected by renaming `20261018050000_mfp_evidence_performance_recovery.sql` to `20261018050100_mfp_evidence_performance_recovery.sql`. Confirm the local migration set against the live migration history before using `supabase db push`, because the source package's historical migration names do not all exactly match the already-applied live migration identifiers.
