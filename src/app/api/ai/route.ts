import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // 1. Try client-provided key first
    let apiKey = req.headers.get("Authorization")?.replace(/^Bearer\s*/i, "") ?? "";
    
    // 2. Fallback to server env var
    if (!apiKey || apiKey === "undefined" || apiKey === "null") {
      apiKey = process.env.OPENAI_API_KEY ?? "";
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key provided (client or server)." },
        { status: 401 }
      );
    }

    // 3. Call OpenAI
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json({ error: txt }, { status: res.status });
    }

    // 4. Return response
    const json = await res.json();
    return NextResponse.json(json);

  } catch (e: unknown) {
    console.error("AI Proxy Error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
