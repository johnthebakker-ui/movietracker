"use client";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SecurityPanel(){
  const supabase=useMemo(()=>createSupabaseBrowserClient(),[]); const [factors,setFactors]=useState<any[]>([]); const [qr,setQr]=useState(""); const [factorId,setFactorId]=useState(""); const [code,setCode]=useState(""); const [message,setMessage]=useState("");
  useEffect(()=>{supabase?.auth.mfa.listFactors().then(({data})=>setFactors(data?.totp??[]));},[supabase]);
  async function enroll(){if(!supabase)return;const {data,error}=await supabase.auth.mfa.enroll({factorType:"totp",friendlyName:"MovieTracker authenticator"});if(error)return setMessage(error.message);setQr(data.totp.qr_code);setFactorId(data.id);}
  async function verify(){if(!supabase)return;const challenge=await supabase.auth.mfa.challenge({factorId});if(challenge.error)return setMessage(challenge.error.message);const result=await supabase.auth.mfa.verify({factorId,challengeId:challenge.data.id,code});if(result.error)return setMessage(result.error.message);setMessage("Authenticator enabled.");setQr("");location.reload();}
  async function remove(id:string){if(!supabase)return;const level=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(level.data?.currentLevel!=="aal2")return setMessage("Verify your authenticator in a new session before removing it.");const {error}=await supabase.auth.mfa.unenroll({factorId:id});setMessage(error?.message??"Authenticator removed.");if(!error)location.reload();}
  async function updatePassword(form:React.FormEvent<HTMLFormElement>){form.preventDefault();if(!supabase)return;const password=new FormData(form.currentTarget).get("password") as string;const {error}=await supabase.auth.updateUser({password});setMessage(error?.message??"Password updated.");}
  return <div style={{display:'grid',gap:20}}>
    {message&&<div className="notice">{message}</div>}
    <section className="panel"><h3>Password</h3><form className="status-actions" onSubmit={updatePassword}><input className="input" style={{maxWidth:360}} name="password" type="password" minLength={8} required placeholder="New password"/><button className="button accent">Update password</button></form></section>
    <section className="panel"><h3>Authenticator app</h3>{factors.length?<>{factors.map(f=><div className="status-actions" key={f.id}><span className="muted">{f.friendly_name??"Authenticator"} · verified</span><button className="button ghost small" onClick={()=>remove(f.id)}>Remove</button></div>)}</>:qr?<div><p>Scan this QR code in your authenticator app, then enter its six-digit code.</p><img src={qr} width={220} height={220} alt="Authenticator QR code"/><div className="status-actions"><input className="input" style={{maxWidth:180}} value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric" maxLength={6}/><button className="button accent" onClick={verify}>Verify</button></div></div>:<><p className="muted">Require a time-based one-time code after your password.</p><button className="button accent" onClick={enroll}>Set up authenticator</button></>}</section>
  </div>;
}
