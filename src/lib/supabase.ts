import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nvzvyzgantmtwjfnrqdo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ifbjck-YJ2Ms2LyxBZbCDA_nJLcCL95';

// Publishable key is intentionally public. Never place service-role/secret keys in browser code.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 10 } },
});
export const supabaseConfig = { url: SUPABASE_URL, projectRef: 'nvzvyzgantmtwjfnrqdo' };
