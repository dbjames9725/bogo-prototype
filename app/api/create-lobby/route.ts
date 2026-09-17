import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { itemName, itemPrice, dealType, durationMinutes } = await req.json();

    const priceNum = Number(itemPrice) || 0;
    const deal = (dealType || 'BOGO_FREE').toUpperCase();
   
    // Default to 60 minutes (1 hour) if not specified by the client
    const duration = Number(durationMinutes) || 60;
   
    // Calculate the future expiration timestamp based on selected duration
    const expiresAt = new Date(Date.now() + duration * 60 * 1000).toISOString();

    const { data: lobby, error } = await supabase
      .from('lobbies')
      .insert([
        {
          item_name: itemName || 'BOGO Split Item',
          item_price: priceNum,
          deal_type: deal,
          duration_minutes: duration,
          expires_at: expiresAt,
          status: 'PENDING',
        },
      ])
      .select()
      .single();

    if (error || !lobby) {
      console.error('Supabase Lobby Creation Error:', error);
      return NextResponse.json(
        { error: error?.message || 'Failed to insert lobby into Supabase' },
        { status: 500 }
      );
    }

    return NextResponse.json({ lobbyId: lobby.id });
  } catch (err: any) {
    console.error('Create Lobby Route Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
