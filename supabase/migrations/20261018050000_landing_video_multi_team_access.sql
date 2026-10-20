-- MF MPanel v2.4.1: public landing content, admin-managed video and team access hardening.
-- Applied to Supabase project nvzvyzgantmtwjfnrqdo on 2026-10-18.

ALTER TABLE public.mfp_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read landing settings and active assets" ON public.mfp_documents;
CREATE POLICY "Public read landing settings and active assets"
ON public.mfp_documents FOR SELECT TO anon, authenticated
USING (
  (collection_name = 'landingAssets' AND data->>'isActive' = 'true')
  OR (collection_name = 'siteSettings' AND document_id = 'landing')
);

DROP POLICY IF EXISTS "MFP users read permitted documents" ON public.mfp_documents;
CREATE POLICY "MFP users read permitted documents"
ON public.mfp_documents FOR SELECT TO authenticated
USING (
  owner_uid = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.mfp_user_profiles p
    WHERE p.user_id = (SELECT auth.uid()) AND p.account_status = 'ACTIVE'
      AND (p.role = 'ADMIN' OR (mfp_documents.team_key IS NOT NULL AND mfp_documents.team_key = ANY(p.allowed_modules)))
  )
);

DROP POLICY IF EXISTS "MFP users create own non-public documents" ON public.mfp_documents;
CREATE POLICY "MFP users create own non-public documents"
ON public.mfp_documents FOR INSERT TO authenticated
WITH CHECK (
  collection_name NOT IN ('landingAssets','siteSettings')
  AND owner_uid = (SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.mfp_user_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.account_status='ACTIVE')
);

DROP POLICY IF EXISTS "MFP users update own non-public documents" ON public.mfp_documents;
CREATE POLICY "MFP users update own non-public documents"
ON public.mfp_documents FOR UPDATE TO authenticated
USING (
  collection_name NOT IN ('landingAssets','siteSettings')
  AND (owner_uid = (SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.mfp_user_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='ADMIN' AND p.account_status='ACTIVE'))
)
WITH CHECK (
  collection_name NOT IN ('landingAssets','siteSettings')
  AND (owner_uid = (SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.mfp_user_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='ADMIN' AND p.account_status='ACTIVE'))
);

DROP POLICY IF EXISTS "MFP users delete own non-public documents" ON public.mfp_documents;
CREATE POLICY "MFP users delete own non-public documents"
ON public.mfp_documents FOR DELETE TO authenticated
USING (
  collection_name NOT IN ('landingAssets','siteSettings')
  AND (owner_uid = (SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.mfp_user_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='ADMIN' AND p.account_status='ACTIVE'))
);

DROP POLICY IF EXISTS "MFP admins manage landing content" ON public.mfp_documents;
CREATE POLICY "MFP admins manage landing content"
ON public.mfp_documents FOR ALL TO authenticated
USING (EXISTS(SELECT 1 FROM public.mfp_user_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='ADMIN' AND p.account_status='ACTIVE'))
WITH CHECK (EXISTS(SELECT 1 FROM public.mfp_user_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='ADMIN' AND p.account_status='ACTIVE'));

-- Team assignment is now admin-managed in the web admin user-management screen.
-- Prevent direct self-assignment through the old authenticated RPC.
REVOKE EXECUTE ON FUNCTION public.mfp_assign_team(text) FROM anon, authenticated;
NOTIFY pgrst, 'reload schema';
