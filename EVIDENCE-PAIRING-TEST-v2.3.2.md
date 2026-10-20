# Evidence pairing regression checklist

1. Sign in to the website with an authorized Evidence user or active administrator.
2. Generate a pairing code; verify exactly six digits are shown and copied, including a possible leading zero.
3. Enter the code in the Android app within ten minutes.
4. Confirm Android calls `mfp-evidence-linking` with `action: redeemPairing`, the same six-digit code, and the current Supabase access token.
5. Confirm website registration status becomes `ACTIVE`, activation status becomes `ACTIVE`, and the code request becomes `CONSUMED`.
6. Reuse the same code: it must fail.
7. Use an expired code: it must fail with an expired-code message.
8. Use a different signed-in account: it must fail with an account mismatch / authorization message.

Website source was updated. Android end-to-end confirmation requires the Android project source and a live device test.
