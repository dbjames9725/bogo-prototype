import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ Warning: NEXT_PUBLIC_SUPABASE_URL is missing from environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);