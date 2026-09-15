import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const alt = 'BOGO Co-Op Split Deal';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: lobby } = await supabase
    .from('lobbies')
    .select('item_name, item_price')
    .eq('id', id)
    .single();

  const itemName = lobby?.item_name || 'BOGO Co-Op Item';
  const fullPrice = lobby?.item_price ? Number(lobby.item_price) : 0;
  const splitPrice = (fullPrice / 2).toFixed(2);

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#09090b',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          padding: '40px',
          border: '12px solid #18181b',
        }}
      >
        {/* BADGE */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            color: '#34d399',
            padding: '8px 24px',
            borderRadius: '9999px',
            border: '1px solid rgba(52, 211, 153, 0.3)',
            fontSize: '20px',
            fontWeight: 'bold',
            letterSpacing: '2px',
            marginBottom: '24px',
            textTransform: 'uppercase',
          }}
        >
          🤝 BOGO Co-Op Lobby • 50% Off Split
        </div>

        {/* ITEM NAME */}
        <div
          style={{
            fontSize: '56px',
            fontWeight: '900',
            textAlign: 'center',
            marginBottom: '32px',
            maxWidth: '900px',
            lineHeight: '1.2',
          }}
        >
          {itemName}
        </div>

        {/* PRICE SPLIT CARD */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
            backgroundColor: '#18181b',
            padding: '24px 48px',
            borderRadius: '24px',
            border: '1px solid #27272a',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '18px', color: '#a1a1aa', textTransform: 'uppercase' }}>Retail Price</span>
            <span style={{ fontSize: '32px', color: '#71717a', textDecoration: 'line-through', fontWeight: 'bold' }}>
              ${fullPrice.toFixed(2)}
            </span>
          </div>

          <div style={{ fontSize: '36px', color: '#f59e0b', fontWeight: '900' }}>→</div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '18px', color: '#34d399', textTransform: 'uppercase', fontWeight: 'bold' }}>
              Your 50% Split
            </span>
            <span style={{ fontSize: '48px', color: '#34d399', fontWeight: '900' }}>
              ${splitPrice}
            </span>
          </div>
        </div>

        {/* FOOTER CALL TO ACTION */}
        <div
          style={{
            marginTop: '36px',
            fontSize: '22px',
            color: '#fbbf24',
            fontWeight: 'bold',
          }}
        >
          ⚡ Click link to join lobby & pre-authorize your half!
        </div>
      </div>
    ),
    { ...size }
  );
}

