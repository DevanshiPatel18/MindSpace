"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSessionKey, getLastActive, touch, clearSessionKey } from "@/lib/session";
import { getSettings } from "@/lib/storage";

export function LockGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();

  React.useEffect(() => {
    if(path === "/unlock") return;
    // if (path === "/unlock" || path.startsWith("/scripts/seed")) return;
    if (!getSessionKey()) router.replace("/unlock");

    let interval: number | undefined;

    (async () => {
      const settings = await getSettings();
      interval = window.setInterval(() => {
        const ms = settings.autoLockMinutes * 60 * 1000;
        if (Date.now() - getLastActive() > ms) {
          clearSessionKey();
          router.replace("/unlock");
        }
      }, 2000);
    })();

    const onActivity = () => touch();
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("click", onActivity);

    return () => {
      if (interval) window.clearInterval(interval);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("click", onActivity);
    };
  }, [router, path]);

  return <>{children}</>;
}
