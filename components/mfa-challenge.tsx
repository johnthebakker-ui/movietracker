"use client";
import { ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function MfaChallenge({ next }: { next: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []); const router = useRouter(); const [factorId, setFactorId] = useState(""); const [code, setCode] = useState(""); const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  useEffect(() => { supabase?.auth.mfa.listFactors().then(({ data, error }) => { const factor = data?.totp.find(item => item.status === "verified"); if (error || !factor) setMessage(error?.message ?? "No verified authenticator was found."); else setFactorId(factor.id); }); }, [supabase]);
  async function verify(event: React.FormEvent) { event.preventDefault(); if (!supabase || !factorId || !/^\d{6}$/.test(code)) return setMessage("Enter the six-digit code from your authenticator app."); setPending(true); const challenge = await supabase.auth.mfa.challenge({ factorId }); if (challenge.error) { setPending(false); return setMessage(challenge.error.message); } const result = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code }); setPending(false); if (result.error) return setMessage(result.error.message); router.replace(next); router.refresh(); }
  return <form className="mfa-challenge" onSubmit={verify}><ShieldCheck size={34} /><div><div className="eyebrow">Two-step verification</div><h1 className="display">Confirm it’s you.</h1><p className="muted">Enter the current six-digit code from the authenticator connected to your MovieTracker account.</p></div>{message && <div className="notice">{message}</div>}<label className="field"><span>Authenticator code</span><input className="input mfa-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="000000" /></label><button className="button accent" disabled={pending || !factorId}>{pending ? "Verifying…" : "Verify and continue"}</button></form>;
}
