import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const { data: lobbies, error } = await supabase
      .from('lobbies')
      .select('*')
      .eq('status', 'PENDING')
      .not('host_payment_intent_id', 'is', null) // Must have host pre-hold placed
      .is('partner_payment_intent_id', null)    // Still waiting for partner
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    return NextResponse.json({ lobbies: lobbies || [] }, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}