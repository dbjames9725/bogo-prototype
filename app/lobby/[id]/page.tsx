import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import LobbyClientView from './LobbyClientView';

interface Props {
  params: Promise<{ id: string }>;
}

// Dynamic Open Graph Metadata
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const { data: lobby } = await supabase
    .from('lobbies')
    .select('*')
    .eq('id', id)
    .single();

  if (!lobby) {
    return {
      title: 'BOGO Split - Lobby Not Found',
      description: 'Join BOGO Split to share Buy 1 Get 1 Free deals.',
    };
  }

  const dealTitle = lobby.deal_type === 'BOGO_50' ? 'Buy 1 Get 1 50% OFF' : 'Buy 1 Get 1 FREE';
  const priceFormatted = lobby.user_b_share ? `$${lobby.user_b_share.toFixed(2)}` : 'half price';

  const title = `Split "${lobby.item_name}" for ${priceFormatted} on BOGO Split`;
  const description = `Someone created a ${dealTitle} deal for ${lobby.item_name}. Join this lobby to split the purchase and pay only ${priceFormatted}!`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://bogo-prototype-wheat.vercel.app/lobby/${id}`,
    },
  };
}

// Server Component: Fetch data on the server and pass to client
export default async function LobbyPage({ params }: Props) {
  const { id } = await params;

  // Server-side database fetch (Bypasses browser client-side blocking)
  const { data: initialLobby } = await supabase
    .from('lobbies')
    .select('*')
    .eq('id', id)
    .single();

  return <LobbyClientView lobbyId={id} initialLobby={initialLobby} />;
}
