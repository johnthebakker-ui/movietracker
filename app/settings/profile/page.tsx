import { signOut } from "@/app/actions/auth";
import { updateProfile } from "@/app/actions/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProfileSettings({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const notice = await searchParams;
  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const profile = user && supabase ? (await supabase.from("profiles").select("*").eq("id", user.id).single()).data : null;
  return <div>
    <h2 className="display" style={{ fontSize: "2.5rem", marginTop: 0 }}>Profile & preferences</h2>
    {(notice.error || notice.message) && <div className="notice" style={{ marginBottom: 16 }}>{notice.error || notice.message}</div>}
    <form className="panel" action={updateProfile}>
      <div className="form-grid">
        <div className="field"><label>Display name</label><input className="input" name="displayName" defaultValue={profile?.display_name ?? ""} /></div>
        <div className="field"><label>Username</label><div className="username-input"><span aria-hidden="true">@</span><input className="input" name="username" required pattern="[A-Za-z0-9_]{3,24}" minLength={3} maxLength={24} autoCapitalize="none" autoCorrect="off" spellCheck={false} defaultValue={profile?.username} /></div><small className="muted">Unique, 3–24 characters. Letters, numbers and underscores only.</small></div>
        <div className="field"><label>Avatar <span className="muted">· JPEG, PNG or WebP · max 5 MB</span></label><input className="input" name="avatar" type="file" accept="image/png,image/jpeg,image/webp" /></div>
        <div className="field"><label>Banner <span className="muted">· JPEG, PNG or WebP · max 5 MB</span></label><input className="input" name="banner" type="file" accept="image/png,image/jpeg,image/webp" /></div>
        <div className="field"><label>Region</label><input className="input" name="region" minLength={2} maxLength={2} defaultValue={profile?.region ?? "US"} /></div>
        <div className="field"><label>Metadata language</label><select className="select" name="language" defaultValue={profile?.language ?? "en-US"}><option value="en-US">English</option><option value="nl-NL">Dutch</option><option value="de-DE">German</option><option value="fr-FR">French</option></select></div>
        <div className="field"><label>Theme</label><select className="select" name="theme" defaultValue={profile?.theme ?? "system"}><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select></div>
        <label className="field"><span>Catalog content</span><span><input type="checkbox" name="adultContent" defaultChecked={profile?.adult_content} /> Show adult titles</span></label>
      </div>
      <div className="field" style={{ marginTop: 16 }}><label>Biography</label><textarea className="textarea" name="bio" maxLength={500} defaultValue={profile?.bio ?? ""} /></div>
      <button className="button accent" style={{ marginTop: 16 }}>Save profile</button>
    </form>
    <form action={signOut} style={{ marginTop: 20 }}><button className="button ghost">Sign out</button></form>
  </div>;
}
