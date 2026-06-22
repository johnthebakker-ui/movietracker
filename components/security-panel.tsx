"use client";

import { Check, Copy, KeyRound, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name?: string; status: string };

export function SecurityPanel() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [factors, setFactors] = useState<Factor[]>([]); const [qr, setQr] = useState(""); const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState(""); const [code, setCode] = useState(""); const [message, setMessage] = useState(""); const [copied, setCopied] = useState(false); const [pending, setPending] = useState(false);

  useEffect(() => { supabase?.auth.mfa.listFactors().then(({ data }) => setFactors((data?.totp ?? []).filter(factor => factor.status === "verified"))); }, [supabase]);

  async function enroll() {
    if (!supabase) return; setPending(true); setMessage("");
    const current = await supabase.auth.mfa.listFactors();
    await Promise.allSettled((current.data?.totp ?? []).filter(factor => factor.status !== "verified").map(factor => supabase.auth.mfa.unenroll({ factorId: factor.id })));
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "MovieTracker authenticator" });
    if (error || !data || data.type !== "totp") { setPending(false); return setMessage(error?.message ?? "Could not start authenticator setup."); }
    try {
      const image = await QRCode.toDataURL(data.totp.uri, { width: 340, margin: 4, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
      setQr(image); setSecret(data.totp.secret); setFactorId(data.id);
    } catch { setMessage("Could not render the authenticator QR code. Use the manual setup key below."); setSecret(data.totp.secret); setFactorId(data.id); }
    setPending(false);
  }

  async function verify() {
    if (!supabase || !factorId) return; if (!/^\d{6}$/.test(code)) return setMessage("Enter the six-digit code shown in your authenticator app."); setPending(true); setMessage("");
    const challenge = await supabase.auth.mfa.challenge({ factorId }); if (challenge.error) { setPending(false); return setMessage(challenge.error.message); }
    const result = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code }); setPending(false); if (result.error) return setMessage(result.error.message);
    setMessage("Authenticator enabled successfully."); setQr(""); setSecret(""); location.reload();
  }

  async function copySecret() { if (!secret) return; await navigator.clipboard.writeText(secret); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }

  async function remove(id: string) { if (!supabase) return; const level = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(); if (level.data?.currentLevel !== "aal2") return setMessage("Verify your authenticator in a new session before removing it."); const { error } = await supabase.auth.mfa.unenroll({ factorId: id }); setMessage(error?.message ?? "Authenticator removed."); if (!error) location.reload(); }

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (!supabase) return; const password = new FormData(event.currentTarget).get("password") as string; const { error } = await supabase.auth.updateUser({ password }); setMessage(error?.message ?? "Password updated."); }

  return <div className="security-stack">
    {message && <div className="notice">{message}</div>}
    <section className="panel"><h3>Password</h3><form className="status-actions" onSubmit={updatePassword}><input className="input" style={{ maxWidth: 360 }} name="password" type="password" minLength={8} required placeholder="New password" /><button className="button accent"><KeyRound size={16} /> Update password</button></form></section>
    <section className="panel authenticator-panel"><div className="security-panel-heading"><ShieldCheck size={21} /><div><h3>Authenticator app</h3><p className="muted">Protect every new password and Google login with a time-based code.</p></div></div>
      {factors.length ? factors.map(factor => <div className="verified-factor" key={factor.id}><div><Check size={17} /><span><strong>{factor.friendly_name ?? "Authenticator"}</strong><small>Verified and required on new sessions</small></span></div><button className="button ghost small" onClick={() => remove(factor.id)}>Remove</button></div>) : qr || secret ? <div className="authenticator-enrollment"><div className="authenticator-setup-copy"><div className="eyebrow">Step 1</div><h4>Connect your authenticator</h4><p>Scan this code with Google Authenticator, Microsoft Authenticator, 1Password, Authy, or another TOTP application.</p>{qr && <div className="authenticator-qr"><img src={qr} width={340} height={340} alt="MovieTracker authenticator setup QR code" /></div>}</div>
        <div className="manual-auth-key"><div><span>Can’t scan it?</span><small>Choose “Enter a setup key” in your authenticator. Use <strong>MovieTracker</strong> as the account name and select a time-based key.</small></div><code>{secret.match(/.{1,4}/g)?.join(" ")}</code><button type="button" className="button ghost small" onClick={copySecret}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy key"}</button></div>
        <div className="authenticator-verify"><div><div className="eyebrow">Step 2</div><h4>Verify the connection</h4><p className="muted">Enter the six-digit code generated by the app.</p></div><input className="input mfa-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" aria-label="Six-digit authenticator code" /><button className="button accent" onClick={verify} disabled={pending}>{pending ? "Verifying…" : "Verify authenticator"}</button></div>
      </div> : <div className="authenticator-empty"><p className="muted">No authenticator is connected yet.</p><button className="button accent" onClick={enroll} disabled={pending}><ShieldCheck size={16} /> {pending ? "Preparing…" : "Set up authenticator"}</button></div>}
    </section>
  </div>;
}
