import { b64FromBytes, bytesFromB64 } from "./util";

const PBKDF2_ITERATIONS = 600_000;
const KDF_VERSION = 1;

export function getKdfVersion() {
  return KDF_VERSION;
}

export function makeRandomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function deriveKeyFromPassphrase(passphrase: string, salt: Uint8Array) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(passphrase), { name: "PBKDF2" }, false, [
    "deriveKey",
  ]);

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJson(key: CryptoKey, value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

  return { ciphertextB64: b64FromBytes(new Uint8Array(ciphertext)), ivB64: b64FromBytes(iv) };
}

export async function decryptJson<T>(key: CryptoKey, ciphertextB64: string, ivB64: string): Promise<T> {
  const iv = bytesFromB64(ivB64);
  const ciphertext = bytesFromB64(ciphertextB64);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as any }, key, ciphertext as any);
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}