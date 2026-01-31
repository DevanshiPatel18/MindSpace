"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/Card";
import { Button } from "@/components/Button";
import { deriveKeyFromPassphrase } from "@/lib/crypto";
import { getOrCreateAppSaltB64 } from "@/lib/storage";
import { bytesFromB64 } from "@/lib/util";
import { setSessionKey } from "@/lib/session";

export default function UnlockPage() {
  const router = useRouter();
  const [pass, setPass] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  async function onUnlock() {
    setErr("");
    if (!pass.trim()) return setErr("Enter a passphrase.");
    setBusy(true);
    try {
      const saltB64 = await getOrCreateAppSaltB64();
      const key = await deriveKeyFromPassphrase(pass, bytesFromB64(saltB64));
      setSessionKey(key);
      router.replace("/");
    } catch {
      setErr("Could not unlock. Check your passphrase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid place-items-center min-h-[70vh]">
      <div className="w-full max-w-md">
        <Card className="shadow-[var(--shadow)]">
          <CardBody>
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Encrypted on this device
            </div>

            <h1 className="mt-4 text-2xl font-bold text-neutral-900">Unlock</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Your journal is stored locally and encrypted. If you forget your passphrase, entries cannot be recovered.
            </p>

            <div className="mt-6 space-y-3">
              <input
                type="password"
                className="w-full rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Enter passphrase"
              />
              {err ? <div className="text-sm text-red-600">{err}</div> : null}

              <Button className="w-full" onClick={onUnlock} disabled={busy}>
                {busy ? "Unlocking…" : "Unlock"}
              </Button>

              <div className="text-xs text-neutral-500">
                Tip: Use a memorable phrase (e.g., 4–6 words). You can delete everything anytime in Settings.
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
