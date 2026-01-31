"use client";

import React from "react";

export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-2xl bg-neutral-900 text-white px-4 py-2 text-sm shadow-lg">
      {message}
    </div>
  );
}

export function useToast() {
  const [message, setMessage] = React.useState("");
  React.useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 2200);
    return () => clearTimeout(t);
  }, [message]);
  return { message, setMessage };
}