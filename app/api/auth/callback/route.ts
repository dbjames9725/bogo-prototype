import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop");
  const code = searchParams.get("code");

  if (!shop || !code) {
    return NextResponse.json(
      { error: "Missing shop or code parameter" },
      { status: 400 }
    );
  }

  const clientId = process.env.SHOPIFY_API_KEY || "8f8fcdce9de3a64d5bb0404660f1018e";
  const clientSecret = process.env.SHOPIFY_API_SECRET;

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      return NextResponse.json(
        { error: "Failed to exchange authorization code for access token", details: tokenData },
        { status: 500 }
      );
    }

    // Upsert merchant token into Supabase
    const { error: dbError } = await supabase
      .from("merchants")
      .upsert(
        {
          shop_domain: shop,
          access_token: tokenData.access_token,
          scopes: tokenData.scope,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "shop_domain" }
      );

    if (dbError) {
      console.error("Supabase write error:", dbError);
      return NextResponse.json(
        { error: "Database save failed", details: dbError },
        { status: 500 }
      );
    }

    // Redirect merchant to Campaign Builder
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    return NextResponse.redirect(`${protocol}://${host}/campaigns/new?shop=${shop}`);
  } catch (err: any) {
    console.error("OAuth Callback Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

