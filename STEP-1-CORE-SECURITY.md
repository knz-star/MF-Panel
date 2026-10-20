# MF MPanel Final Project — Step 1: Core & Security

This step builds on v2.11.0 without changing the Android application source.

## Included
- Signup now requires Male/Female selection and stores the selection in Supabase Auth signup metadata.
- Additive Supabase migration adds canonical gender fields and stable public profile/post identifiers while preserving existing internal document IDs.
- Profile links receive `mfpProfileId` values in the format `MFP` + 16 digits. Post links receive `mfpPostId` values `MFP1`, `MFP2`, ... scoped to their profile reference.
- Existing Report Generator routes remain Admin-only at the website route layer; backend `mfp-link-workflow` continues to reject ZIP reconciliation unless the caller is an active Admin.
- Existing Admin Links page verifies actual Supabase deletion and lists failures rather than reporting false success.

## Before production
1. Review and apply `supabase/migrations/20261020120000_mfp_gender_profile_post_ids.sql` in a staging Supabase project first.
2. Confirm the existing Supabase schema has `mfp_user_profiles`, `mfp_documents`, `mfp_private.is_admin()` and the existing auth trigger functions.
3. Install dependencies and run `npm run audit:source`, `npm run test`, `npm run test:acceptance`, and `npm run build`.
4. Test with one admin, one male signup, one female signup, and two posts under one profile. Confirm no existing document IDs change.

## Important limits of Step 1
This is the first checkpoint, not a production deployment. Full physical/online report packaging, manifest-aware screenshot reconciliation, encrypted ZIP password support, organization report sharing, and team-admin-specific analytics backend are Step 2 work. Gender selection is not itself a permission grant; roles and module access remain controlled by the canonical Supabase profile.
