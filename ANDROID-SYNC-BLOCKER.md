# Android Evidence sync — required separate source update

This website ZIP cannot safely complete the Android-side Firestore-to-Supabase migration because the Android repository/source is not included in this project archive. The requested Connection Diagnostics screen, fresh Supabase-token pairing, outbox retry/delivery, and per-item sync errors must be implemented and tested in the Android repository (`knz-star/MF-MEv`) itself. Do not claim Android sync is fixed until that source is available, the app is rebuilt, and an end-to-end pairing/outbox test succeeds.

The website-side `mfp-evidence-linking` function remains in this ZIP. It cannot make a Firebase-only app session become a valid Supabase session on its own.
