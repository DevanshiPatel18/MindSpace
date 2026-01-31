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
        <Card>
          <CardBody>
            <h1 className="text-2xl font-bold text-neutral-900">Unlock</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Your journal is encrypted on this device. If you forget your passphrase, entries cannot be recovered.
            </p>

            <div className="mt-6 space-y-3">
              <input
                type="password"
                className="w-full rounded-2xl border border-neutral-200 px-3 py-2 text-sm"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Enter passphrase"
              />
              {err ? <div className="text-sm text-red-600">{err}</div> : null}

              <Button className="w-full" onClick={onUnlock} disabled={busy}>
                {busy ? "Unlocking…" : "Unlock"}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
