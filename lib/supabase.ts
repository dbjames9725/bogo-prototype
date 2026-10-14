import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('SUPABASE ERROR: Public keys missing from .env.local!');
}

// 1. Client-side browser client (for LobbyClientView.tsx, Realtime subscriptions, etc.)
export const supabase = createClient(
  supabaseUrl || 'https://missing-env-url.supabase.co',
  supabaseAnonKey || 'missing-key'
);

// 2. Admin client for server-side API routes ONLY (bypasses RLS safely on server)
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://missing-env-url.supabase.co',
  supabaseServiceKey || 'missing-key'
);