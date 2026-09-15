import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import LobbyClientView from './LobbyClientView';
import { notFound } from 'next/navigation';

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const { data: lobby } = await supabase
    .from('lobbies')
    .select('item_name, item_price')
    .eq('id', id)
    .single();

  const title = lobby
    ? `Split 50/50: ${lobby.item_name}`
    : 'BOGO Co-Op Deal Splitter';

  const description = lobby
    ? `Join my BOGO lobby to split ${lobby.item_name} for $${(Number(lobby.item_price) / 2).toFixed(2)} each!`
    : 'Split BOGO deals 50/50 with a co-op partner instantly.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'BOGO Co-Op',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function LobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  // Verify lobby exists before rendering client view
  const { data: lobby, error } = await supabase
    .from('lobbies')
    .select('id')
    .eq('id', id)
    .single();

  if (error || !lobby) {
    notFound();
  }

  return <LobbyClientView lobbyId={id} />;
}



