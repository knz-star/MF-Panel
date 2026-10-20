# MF MPanel v1.4.4 — Team assignment race fix

- Team assignment now uses a Firestore transaction.
- Handles the case where the Firebase Auth onCreate Cloud Function creates `users/{uid}` between the client's first read and write.
- When a profile already exists, the transaction updates only `team`, `allowedModules`, `teamConfirmed`, and `updatedAt`, matching the one-time assignment rule.
- Updated the permission-denied guidance to mention the `mf-mpanel` project and UID/document-ID check.
- Kept the existing project structure and least-privilege role protections.
