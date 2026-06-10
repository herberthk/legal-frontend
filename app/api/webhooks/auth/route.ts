import { NextRequest, NextResponse } from 'next/server';
import { createVerify, createPublicKey } from 'node:crypto';

async function fetchPawaPayPublicKeys(): Promise<{ id: string; key: string }[]> {
  const res = await fetch('https://api.pawapay.io/v2/public-key/http', {
    headers: { Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}` },
    next: { revalidate: 3600 },
  });
  return res.json();
}

/**
 * Build the RFC 9421 signature base from the request headers and signature-input.
 */
function buildSignatureBase(
  method: string,
  authority: string,
  path: string,
  headers: Headers,
  signatureInputParams: string
): string {
  // Parse the covered components from the signature-input parameters
  // e.g. ("@method" "@authority" "@path" "signature-date" "content-digest" "content-type");alg=...
  const componentsMatch = signatureInputParams.match(/^\(([^)]*)\)/);
  if (!componentsMatch) throw new Error('Invalid signature-input format');

  const componentNames = componentsMatch[1]
    .split(/\s+/)
    .map((c) => c.replace(/"/g, ''))
    .filter(Boolean);

  const lines: string[] = [];
  for (const name of componentNames) {
    let value: string;
    switch (name) {
      case '@method':
        value = method.toUpperCase();
        break;
      case '@authority':
        value = authority;
        break;
      case '@path':
        value = path;
        break;
      default:
        // Regular header field
        value = headers.get(name) ?? '';
        break;
    }
    lines.push(`"${name}": ${value}`);
  }

  // The @signature-params line uses the full params string (without the label prefix)
  lines.push(`"@signature-params": ${signatureInputParams}`);

  return lines.join('\n');
}

async function verifyPawaPayCallback(req: NextRequest): Promise<{
  valid: boolean;
  rawBody: string;
}> {
  const rawBody = await req.text();

  // Step 1: Verify Content-Digest
  const contentDigestHeader = req.headers.get('content-digest') ?? '';
  const match = contentDigestHeader.match(/^(sha-\d+)=:(.+):$/);
  if (!match) return { valid: false, rawBody };

  const [, algo, expectedHash] = match;
  const hashAlgo = algo === 'sha-512' ? 'SHA-512' : 'SHA-256';

  const bodyBuffer = new TextEncoder().encode(rawBody);
  const digestBuffer = await crypto.subtle.digest(hashAlgo, bodyBuffer);
  const computedHash = btoa(String.fromCharCode(...new Uint8Array(digestBuffer)));

  if (computedHash !== expectedHash) {
    console.error('Content-Digest mismatch');
    return { valid: false, rawBody };
  }

  // Step 2: Parse signature-input header to extract the params
  const signatureInputHeader = req.headers.get('signature-input') ?? '';
  // Strip the label prefix, e.g. "sig-pp=" → the params
  const labelMatch = signatureInputHeader.match(/^([^=]+)=(.*)/s);
  if (!labelMatch) return { valid: false, rawBody };
  const [, signatureLabel, signatureInputParams] = labelMatch;

  // Step 3: Reconstruct the signature base
  // Determine the authority: prefer the Host header (which reflects the original
  // authority PawaPay signed against), fall back to the URL host
  const url = new URL(req.url);
  const authority = req.headers.get('host') || url.host;

  const signatureBase = buildSignatureBase(
    req.method,
    authority,
    url.pathname,
    req.headers,
    signatureInputParams
  );

  console.log('signatureBase:\n' + signatureBase);

  // Step 4: Fetch pawaPay public keys
  const publicKeys = await fetchPawaPayPublicKeys();

  // Step 5: Extract the signature bytes
  const signatureHeader = req.headers.get('signature') ?? '';
  // e.g. "sig-pp=:MEUC...MAY=:"
  const sigMatch = signatureHeader.match(
    new RegExp(`^${signatureLabel}=:([A-Za-z0-9+/=]+):$`)
  );
  if (!sigMatch) return { valid: false, rawBody };
  const signatureB64 = sigMatch[1];

  // Step 6: Verify against each public key using Node.js crypto
  // Node's crypto.verify natively handles DER-encoded ECDSA signatures,
  // so we don't need to manually convert DER → raw P1363 format.
  const sigBaseBuffer = Buffer.from(signatureBase, 'utf-8');
  const sigBuffer = Buffer.from(signatureB64, 'base64');

  for (const { key: pem } of publicKeys) {
    try {
      const publicKey = createPublicKey({
        key: pem,
        format: 'pem',
        type: 'spki',
      });

      const verifier = createVerify('SHA256');
      verifier.update(sigBaseBuffer);
      verifier.end();

      const isValid = verifier.verify(publicKey, sigBuffer);
      console.log('Verification result with key:', isValid);

      if (isValid) return { valid: true, rawBody };
    } catch (err) {
      console.error('Error verifying with key:', err);
    }
  }

  return { valid: false, rawBody };
}

export async function POST(req: NextRequest) {
  const { valid, rawBody } = await verifyPawaPayCallback(req);

  console.log('is valid:', valid);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Parse the already-consumed body from the raw string
  const body = JSON.parse(rawBody);

  if ('depositId' in body) {
    console.log('deposit:', body);
  } else if ('payoutId' in body) {
    console.log('payout:', body);
  } else if ('refundId' in body) {
    console.log('refund:', body);
  }

  return NextResponse.json({}, { status: 200 });
}