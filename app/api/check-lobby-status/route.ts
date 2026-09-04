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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lobbyId = searchParams.get('lobbyId');

    if (!lobbyId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: lobbyId' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: lobby, error } = await supabase
      .from('lobbies')
      .select('id, item_name, status, partner_payment_intent_id')
      .eq('id', lobbyId)
      .single();

    if (error || !lobby) {
      return NextResponse.json(
        { error: 'Lobby record not found in database' },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        lobbyId: lobby.id,
        itemName: lobby.item_name,
        status: lobby.status,
        hasPartnerJoined: !!lobby.partner_payment_intent_id,
      },
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Check Lobby Status API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
