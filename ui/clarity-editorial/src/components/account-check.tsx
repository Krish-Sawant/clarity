"use client";

import { useState } from "react";

export function AccountCheck() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      const data = await response.json();
      setMessage(response.ok ? `Backend connected. Identity verified with ${data.auth_mode}.` : data.error ?? "Connection failed.");
    } catch { setMessage("Could not reach the server. Please try again."); }
    finally { setBusy(false); }
  }
  return <><button className="header-cta" onClick={check} disabled={busy}>{busy ? "Checking…" : "Check backend connection"}</button><p role="status">{message}</p></>;
}
