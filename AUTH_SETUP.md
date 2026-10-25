# MF MPanel authentication configuration (v2.16.4)

## Disable Supabase email confirmation (manual dashboard setting required)

In Supabase Dashboard → Authentication → Sign In / Providers → Email, turn **Confirm email OFF** and save. This is a hosted Auth configuration setting and cannot be changed by a frontend ZIP or a Postgres migration. Do not edit `auth.users` to fake confirmation. The website no longer offers resend-confirmation UI and expects immediate signup sessions; until this dashboard setting is disabled, signup will show a clear configuration error. Admin approval and team assignment remain in MF MPanel profile/workspace logic.

## Password reset quota

The website now calls `mfp_check_password_reset_quota` before sending a recovery email. The database function allows at most **2 reset requests per email address per rolling 7 days**, and the frontend shows the retry time. This rate limit applies to the website reset flow; it cannot stop a user from bypassing the website and calling Supabase Auth's public recovery endpoint directly. Supabase Auth's own rate limits remain enabled as a separate safety layer.

## Recovery URL configuration

In Supabase Dashboard → Authentication → URL Configuration, verify:
- Site URL: `https://mf-panel.vercel.app`
- Redirect URL: `https://mf-panel.vercel.app/reset-password`
- Redirect URL: `https://mf-panel.vercel.app/login`

Add exact custom-domain URLs if using a custom domain.

## Banner image resilience

Login and sign-up banner images now fall back to a bundled local SVG if the admin-provided or remote image URL fails. This prevents broken external image URLs from leaving a broken image area.

## Google sign-in

Continue with Google is removed from the login screen.
