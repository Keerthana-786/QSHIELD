// ================================================================
//  QuantumShield — Real Quantum Encryption Engine
//  Source 1: ANU Quantum Random Number Generator (real quantum physics)
//  Source 2: AES-256-GCM via Web Crypto API (built into every browser)
// ================================================================

// Fetch real quantum random bytes from Australian National University.
// They measure quantum vacuum fluctuations — genuinely quantum.
async function getQuantumBytes(n = 32) {
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(
    `https://qrng.anu.edu.au/API/jsonI.php?length=${n}&type=uint8`
  )}`;
  const res  = await fetch(proxy, { signal: AbortSignal.timeout(6000) });
  const wrap = await res.json();
  const body = JSON.parse(wrap.contents);
  if (!body.success || body.data.length !== n) throw new Error("Bad QRNG response");
  return new Uint8Array(body.data);
}

// Generate a 256-bit key — tries ANU first, falls back to browser CSPRNG
export async function generateQuantumKey() {
  try {
    const bytes = await getQuantumBytes(32);
    return {
      bytes,
      hex: toHex(bytes),
      source: "ANU Quantum Vacuum Fluctuations",
      tag: "ANU QRNG",
      real: true,
    };
  } catch {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return {
      bytes,
      hex: toHex(bytes),
      source: "Browser CSPRNG (ANU offline)",
      tag: "CSPRNG",
      real: false,
    };
  }
}

function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function importKey(bytes) {
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

// AES-256-GCM encrypt → base64 string
export async function aesEncrypt(text, keyBytes) {
  const key = await importKey(keyBytes);
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const ct  = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv); out.set(new Uint8Array(ct), 12);
  return btoa(String.fromCharCode(...out));
}

// AES-256-GCM decrypt → string
export async function aesDecrypt(b64, keyBytes) {
  const key = await importKey(keyBytes);
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const pt  = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, key, buf.slice(12));
  return new TextDecoder().decode(pt);
}

// SHA-256 fingerprint
async function sha256(text) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return toHex(new Uint8Array(h));
}

// High-level: lock a record with quantum encryption
export async function lockRecord(data) {
  const qkey = await generateQuantumKey();
  const plain = typeof data === "string" ? data : JSON.stringify(data);
  const cipher = await aesEncrypt(plain, qkey.bytes);
  const fp = (await sha256(cipher)).slice(0, 16);
  return {
    cipher,
    keyHex:   qkey.hex,
    keySource: qkey.source,
    keyTag:    qkey.tag,
    isQuantum: qkey.real,
    algorithm: "AES-256-GCM",
    bits:      256,
    fingerprint: fp,
    lockedAt: new Date().toISOString(),
  };
}

// High-level: unlock a record
export async function unlockRecord(cipher, keyHex) {
  const bytes = new Uint8Array(keyHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  return aesDecrypt(cipher, bytes);
}

// Blockchain-style audit hash — tamper-evident chain
export async function chainHash(entry, prevHash = "0000000000000000") {
  return (await sha256(prevHash + JSON.stringify(entry))).slice(0, 32);
}

// Simple password hash (SHA-256) for local auth
export async function hashPassword(password) {
  return (await sha256(password + "qs_salt_2026")).slice(0, 32);
}
