import { supabase } from '@/lib/supabase';
import LobbyClientView from './LobbyClientView';
import { notFound } from 'next/navigation';

export const revalidate = 0;

export default async function LobbyPage({ params }: { params: Promise<{ id: string }> }) {
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
