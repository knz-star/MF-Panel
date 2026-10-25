# MF MPanel authentication configuration (v2.16.2)

## Password reset

The frontend sends recovery emails through Supabase Auth and redirects to `/reset-password`. The recovery page supports Supabase's PKCE `code` callback and recovery session events, waits for the auth callback, and does not allow a direct visit to the password update form without a recovery link.

In Supabase Dashboard → Authentication → URL Configuration, verify these values for the production deployment:

- Site URL: `https://mf-panel.vercel.app`
- Redirect URL: `https://mf-panel.vercel.app/reset-password`
- Redirect URL: `https://mf-panel.vercel.app/login`

If the site is deployed on another/custom domain, add that exact domain's `/reset-password` and `/login` URLs as well. Do not use broad wildcards for production domains. Supabase's email provider and SMTP/email delivery settings must also be enabled and valid. This source ZIP cannot modify the hosted Supabase Auth URL allowlist; that setting is managed in the Supabase Dashboard.

## Google sign-in

The “Continue with Google” button and its frontend handler are intentionally removed in v2.16.2 because Google OAuth provider enablement and Google Client ID/Secret could not be verified from this workspace. Re-add only after configuring Google provider credentials in Supabase Dashboard → Authentication → Sign In / Providers → Google and registering the exact callback URL shown by Supabase with Google Cloud Console. Do not put a Google client secret in frontend code.
