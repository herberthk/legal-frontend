import { NextResponse } from "next/server";

export async function POST(req: Request) {
    
    const signature = req.headers.get("verif-hash") || req.headers.get("verif-signature");

    if (!signature) {
        return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }
    
    // const body = await req.text();

    // if (!verifyFlutterwaveSignature(body, signature)) {
    //     return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    // }

    // const payload = JSON.parse(body) as WebhookPayload;

    return NextResponse.json({ message: "Webhook received" });
}   