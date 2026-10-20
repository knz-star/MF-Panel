# Export password security status

The website admin UI now uses `mfp-admin-export-settings`, which authenticates the bearer token and requires an active `mfp_user_profiles.role = ADMIN` profile for reads/writes.

**Important migration gate:** live database policy inspection showed `mf_config_public_read` allows `anon` and `authenticated` to SELECT `config` rows where `key = 'export_settings'`. The current Android client may depend on that read. Do not remove the policy until the Android app is migrated to an authenticated server-mediated flow and tested. The website endpoint alone does not make a value secret while a public SELECT policy remains. After Android migration, remove that public-read policy in a reviewed migration and verify the app no longer reads the table directly.
