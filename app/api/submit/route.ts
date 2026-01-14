import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

    if (!N8N_WEBHOOK_URL) {
      console.error("N8N_WEBHOOK_URL is not set in environment variables.");
      return NextResponse.json({ success: false, message: "Server configuration error." }, { status: 500 });
    }

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("n8n webhook error:", response.status, errorBody);
      throw new Error(`n8n webhook failed with status ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in /api/submit:", error);
    return NextResponse.json({ success: false, message: "Failed to submit to n8n." }, { status: 500 });
  }
}