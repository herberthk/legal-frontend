// ── Public key cache ──────────────────────────────────────────────────────────

import { NextRequest } from "next/server";

interface PawaPayPublicKey { id: string; key: string }
let cachedKeys: PawaPayPublicKey[] | null = null;
let cacheExpiry = 0;

async function getPublicKeys(forceRefresh = false): Promise<PawaPayPublicKey[]> {
  const now = Date.now();
  if (!forceRefresh && cachedKeys && now < cacheExpiry) return cachedKeys;

  // ✅ FIX: use sandbox key endpoint when not in production
  // const isProd = process.env.PAWAPAY_ENVIRONMENT === 'production';
  // const keyUrl = isProd
  //   ? 'https://api.pawapay.io/v2/public-key/http'
  //   : 'https://api.sandbox.pawapay.io/v2/public-key/http';
  const keyUrl = 'https://api.sandbox.pawapay.io/v2/public-key/http'

  const res = await fetch(keyUrl, {
    headers: { Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Key fetch failed: ${res.status}`);

  cachedKeys = await res.json();
  cacheExpiry = now + 3_600_000; // 1 hour
  return cachedKeys!;
}

// ── PEM → CryptoKey ───────────────────────────────────────────────────────────

async function importEcPublicKey(pem: string): Promise<CryptoKey> {
  const base64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'spki', der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['verify']
  );
}

// ── DER → IEEE P1363 ──────────────────────────────────────────────────────────

function derToP1363(der: Uint8Array): Uint8Array {
  if (der[0] !== 0x30) throw new Error(`Expected SEQUENCE 0x30, got 0x${der[0]?.toString(16)}`);

  let pos = 1;
  // Handle long-form length encoding
  if (der[pos]! & 0x80) { pos += (der[pos]! & 0x7f) + 1; } else { pos++; }

  // r INTEGER
  if (der[pos] !== 0x02) throw new Error('Expected INTEGER tag for r');
  pos++;
  let rLen = der[pos]!; pos++;
  let rStart = pos;
  if (der[rStart] === 0x00) { rStart++; rLen--; } // strip DER padding byte
  pos = rStart + rLen;

  // s INTEGER
  if (der[pos] !== 0x02) throw new Error('Expected INTEGER tag for s');
  pos++;
  let sLen = der[pos]!; pos++;
  let sStart = pos;
  if (der[sStart] === 0x00) { sStart++; sLen--; } // strip DER padding byte

  // Right-align r and s into 64-byte P1363 format
  const p1363 = new Uint8Array(64);
  p1363.set(der.slice(rStart, rStart + rLen), 32 - rLen);
  p1363.set(der.slice(sStart, sStart + sLen), 64 - sLen);
  return p1363;
}

// ── RFC-9421 signature base ───────────────────────────────────────────────────

function buildSignatureBase(req: NextRequest): string {
  const url            = new URL(req.url);
  const signatureInput = req.headers.get('signature-input') ?? '';

  const derived: Record<string, string> = {
    '@method':    req.method.toUpperCase(),
    '@authority': req.headers.get('host') ?? url.host,  // host header = public domain
    '@path':      url.pathname,
    '@query':     url.search || '?',
    '@scheme':    url.protocol.replace(':', ''),
  };

  const componentsMatch = signatureInput.match(/\(([^)]*)\)/);
  if (!componentsMatch?.[1]) throw new Error('Cannot parse covered components');

  const covered = componentsMatch[1]
    .split(/\s+/).map(c => c.replace(/"/g, '')).filter(Boolean);

  const lines = covered.map(comp => {
    const value = comp in derived ? derived[comp]! : req.headers.get(comp);
    if (value === null || value === undefined) throw new Error(`Missing header: "${comp}"`);
    return `"${comp}": ${value}`;
  });

  lines.push(`"@signature-params": ${signatureInput.replace(/^[^=]+=/, '')}`);
  return lines.join('\n');
}

// ── Verification result ───────────────────────────────────────────────────────

interface VerifyResult { valid: boolean; body: unknown; error?: string }

export async function verifyPawaPayCallback(req: NextRequest): Promise<VerifyResult> {
  // Step 0: Read body once — stream can only be consumed once in Web API Request
  const rawBody = await req.text();
  let body: unknown;
  try { body = JSON.parse(rawBody); }
  catch { return { valid: false, body: null, error: 'Body is not valid JSON' }; }

  // Step 1: Content-Digest
  const cdHeader = req.headers.get('content-digest') ?? '';
  const cdMatch  = cdHeader.match(/^(sha-256|sha-512)=:([A-Za-z0-9+/]+=*):$/);
  if (!cdMatch?.[1] || !cdMatch[2]) {
    return { valid: false, body, error: `Malformed content-digest: "${cdHeader}"` };
  }
  const algo     = cdMatch[1] === 'sha-512' ? 'SHA-512' : 'SHA-256';
  const expected = cdMatch[2];
  const digest   = await crypto.subtle.digest(algo, new TextEncoder().encode(rawBody));
  const computed = btoa(String.fromCharCode(...new Uint8Array(digest)));
  if (computed !== expected) {
    return { valid: false, body, error: `Content-Digest mismatch` };
  }

  // Step 2: Build RFC-9421 signature base
  let sigBase: string;
  try { sigBase = buildSignatureBase(req); }
  catch (e) { return { valid: false, body, error: `Signature base: ${(e as Error).message}` }; }

  // Step 3: Parse signature value (DER → P1363)
  const sigHeader = req.headers.get('signature') ?? '';
  const sigMatch  = sigHeader.match(/^sig-pp=:([A-Za-z0-9+/]+=*):$/);
  if (!sigMatch?.[1]) return { valid: false, body, error: 'Malformed signature header' };

  let p1363: Uint8Array;
  try {
    const der = Uint8Array.from(atob(sigMatch[1]), c => c.charCodeAt(0));
    p1363 = derToP1363(der);
  } catch (e) { return { valid: false, body, error: `DER decode: ${(e as Error).message}` }; }

  // Step 4: Expiry check
  const sigInput    = req.headers.get('signature-input') ?? '';
  const expiresMatch = sigInput.match(/expires=(\d+)/);
  if (expiresMatch?.[1] && Date.now() / 1000 > Number(expiresMatch[1])) {
    return { valid: false, body, error: 'Signature expired' };
  }

  // Step 5: Verify — try cached keys first, then force-refresh once
  const sigBaseBytes = new TextEncoder().encode(sigBase);
  for (const forceRefresh of [false, true]) {
    let keys: PawaPayPublicKey[];
    try { keys = await getPublicKeys(forceRefresh); }
    catch (e) { return { valid: false, body, error: `Key fetch: ${(e as Error).message}` }; }

    for (const { id, key: pem } of keys) {
      let cryptoKey: CryptoKey;
      try { cryptoKey = await importEcPublicKey(pem); }
      catch { continue; }

      const isValid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        //@ts-ignore
        cryptoKey, p1363, sigBaseBytes
      );
      if (isValid) return { valid: true, body };
    }
    if (forceRefresh) break;
  }

  return { valid: false, body, error: 'No key matched the signature' };
}