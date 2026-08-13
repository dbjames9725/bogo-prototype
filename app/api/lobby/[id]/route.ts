import { NextResponse } from 'next/server';
import { getLobbies } from '@/lib/lobbies';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lobbies = getLobbies();
  const lobby = lobbies[id];
  if (!lobby) {
    return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
  }
  return NextResponse.json(lobby);
}