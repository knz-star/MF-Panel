# MF MPanel v2.1.0

## Fixed
- Firebase deployment configuration now explicitly includes the `functions/` source and runs the TypeScript build as a predeploy step.
- Added the missing composite Firestore index used by Evidence platform-count aggregation.
- Profile loading uses a server read and no longer suppresses Firestore permission/network failures.
- Removed the unsafe fallback that fabricated an ACTIVE user profile after a failed Firestore read.
- Added source-aware diagnostics to login/signup, Evidence Linking, Get Links, protected profile-load failures, and the global React error boundary.
- Ensured admin profiles/modules include Evidence access.
- Added automated error-source classification tests.

## Verification
- TypeScript/TSX syntax parse: 62 files, 0 syntax diagnostics.
- Workflow unit test script: passed all 20 assertions when run from transpiled sources; JSZip was stubbed only because package dependencies are not installed in this environment and the tested path does not call ZIP parsing.
- Firestore indexes JSON parses successfully and includes the Evidence composite index.
- ZIP integrity test: passed.
- Full dependency-backed `npm run lint` / `npm run build` could not run because `vite/client` and npm dependencies are not installed. Live Firebase/Netlify deployment and Android end-to-end pairing were not run.
