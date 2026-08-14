import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch single lobby from Supabase matching the ID
  const { data: lobby, error } = await supabase
    .from('lobbies')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !lobby) {
    return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
  }

  // Map database column names back to expected object keys
  const formattedLobby = {
    id: lobby.id,
    itemPrice: Number(lobby.total_price),
    userA: {
      paymentIntentId: lobby.host_payment_intent_id,
      chargeAmount: (Number(lobby.host_share) + 2.5 + 1.82).toFixed(2),
    },
    userB: lobby.partner_payment_intent_id ? {
      paymentIntentId: lobby.partner_payment_intent_id,
      chargeAmount: (Number(lobby.partner_share) + 2.5 + 1.82).toFixed(2),
    } : undefined,
    status: lobby.status,
    createdAt: new Date(lobby.created_at).getTime(),
    expiresAt: lobby.expires_at ? new Date(lobby.expires_at).getTime() : undefined,
  };

  return NextResponse.json(formattedLobby);
}
