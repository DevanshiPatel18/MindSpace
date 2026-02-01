"use client";

let sessionKey: CryptoKey | null = null;
let lastActive = Date.now();

export function setSessionKey(key: CryptoKey) {
  sessionKey = key;
  touch();
}
export function getSessionKey() {
  return sessionKey;
}
export function clearSessionKey() {
  sessionKey = null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("ai_api_key");
  }
}
export function touch() {
  lastActive = Date.now();
}
export function getLastActive() {
  return lastActive;
}