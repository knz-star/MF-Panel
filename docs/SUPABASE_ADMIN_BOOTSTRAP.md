# MF MPanel default administrator bootstrap — v2.3.1

The intended default administrator is `knzbro602@gmail.com`. The live `public.mfp_user_profiles` row is currently configured as `ADMIN`, `ACTIVE`, `team_confirmed = true`, with `searching`, `checking`, `reports`, `evidence`, and `admin` module access.

The migration `20261017060000_exact_admin_bootstrap_and_strict_score_threshold.sql` also updates `public.mfp_ensure_profile()` so that this exact email receives ADMIN privileges only after Supabase Auth confirms the email. No frontend email check grants admin privileges.

If this account has not yet been created, create it through Supabase Auth using the exact email, confirm the address, and sign in once. Then verify the resulting profile in the SQL Editor:

```sql
select user_id, email, role, account_status, team_key, team_confirmed, allowed_modules
from public.mfp_user_profiles
where lower(email) = lower('knzbro602@gmail.com');
```

Do not grant ADMIN to other accounts unless explicitly authorized by the project owner.
