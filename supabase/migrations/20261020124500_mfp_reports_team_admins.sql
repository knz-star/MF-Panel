-- Include the Reports workspace in the existing Team Admin assignment and analytics system.
alter table public.mfp_team_admin_assignments drop constraint if exists mfp_team_admin_assignments_team_key_check;
alter table public.mfp_team_admin_assignments add constraint mfp_team_admin_assignments_team_key_check check (team_key in ('searching','checking','reports','evidence'));
alter table public.mfp_team_score_warnings drop constraint if exists mfp_team_score_warnings_team_key_check;
alter table public.mfp_team_score_warnings add constraint mfp_team_score_warnings_team_key_check check (team_key in ('searching','checking','reports','evidence'));
alter table public.mfp_team_trend_alerts drop constraint if exists mfp_team_trend_alerts_team_key_check;
alter table public.mfp_team_trend_alerts add constraint mfp_team_trend_alerts_team_key_check check (team_key in ('searching','checking','reports','evidence'));
notify pgrst, 'reload schema';
