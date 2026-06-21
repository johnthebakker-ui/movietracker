import { redirect } from "next/navigation";
import { SettingsNav } from "@/components/settings-nav";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export default async function SettingsLayout({children}:{children:React.ReactNode}){const supabase=await createSupabaseServerClient();const user=supabase?(await supabase.auth.getUser()).data.user:null;if(!user)redirect('/login');return <main className="page"><div className="shell"><div className="eyebrow">Your account</div><h1 className="display" style={{fontSize:'clamp(3rem,7vw,6rem)',margin:'8px 0 36px'}}>Settings</h1><div className="settings-layout"><SettingsNav/><div>{children}</div></div></div></main>}
