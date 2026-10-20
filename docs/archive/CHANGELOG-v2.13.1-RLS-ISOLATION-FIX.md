# MF MPanel v2.13.1 — RLS Policy Isolation Correction

## Fixes
- Removes legacy permissive SELECT, INSERT, UPDATE, and DELETE policies on `mfp_documents` before installing the intended team-scoped policies.
- Keeps the separate public read policy for active landing assets and the landing settings document.
- Preserves owner access for non-workflow personal documents while restricting workflow collections to explicit team/assignment rules. Checking users may update only assigned source profiles while their team key remains `searching`.
- Keeps the existing Android pairing bridge untouched; website RPC calls still use authenticated database functions.

## Verification
- Website RPC source audit passes.
- TypeScript/TSX syntax transpilation: 88 files, zero syntax errors.
- Full dependency-backed build/test and live migration execution are not yet verified; run in staging before production deployment.
