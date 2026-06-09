import { NextResponse } from "next/server";

export async function POST(req: Request) {
    // It is usually 'x-pawapay-signature' or 'X-Signature'.
    const signature = req.headers; 

    console.log('signature: ',signature)
    
    // Convert the raw Buffer back to a UTF-8 string
    const rawBody = await req.json();
    console.log('rawBody: ',rawBody)

    return NextResponse.json({ message: "Webhook received" });
}   