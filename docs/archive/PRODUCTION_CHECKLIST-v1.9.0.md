# Production checklist — MF MPanel v1.9.0

1. Deploy the updated website to Netlify.
2. In Firebase Console, confirm the deployed Firestore Rules are the same as this project's `firestore.rules`; publish the complete rules file if needed.
3. Sign in using the real admin account and open Admin → System tests. Review each failed collection read.
4. Test a 25-link import, confirm all new records appear in Firestore, then test 500, 1,000 and larger batches before a 10,000-link batch.
5. Test Checking → Ban / Failed with a non-empty explanation and verify the checking record and profile status are saved.
6. Test Login and Signup banner ratio; verify no banner appears on Landing, Searching, Checking, Reports, or Admin pages.
7. Test user accounts for Searching, Checking and Report Generator to confirm module-level route permissions.

The diagnostic screen checks connectivity and reads only. It intentionally does not attempt unsafe writes or change Firestore rules.
