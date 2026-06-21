"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function followUser(form: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !data.user) redirect("/login");
  const followingId = String(form.get("userId")); const username=String(form.get("username")); const isPrivate=form.get("private") === "true";
  await supabase.from("follows").upsert({ follower_id:data.user.id, following_id:followingId, status:isPrivate?"pending":"accepted" });
  revalidatePath(`/profile/${username}`);
}

export async function unfollowUser(form: FormData) {
  const supabase = await createSupabaseServerClient(); const { data } = supabase ? await supabase.auth.getUser() : { data:{user:null} };
  if (!supabase || !data.user) redirect("/login");
  await supabase.from("follows").delete().eq("follower_id",data.user.id).eq("following_id",String(form.get("userId")));
  revalidatePath(`/profile/${String(form.get("username"))}`);
}

export async function acceptFollow(form: FormData) {
  const supabase=await createSupabaseServerClient(); const user=supabase?(await supabase.auth.getUser()).data.user:null;
  if(!supabase||!user)redirect('/login');
  await supabase.from('follows').update({status:'accepted'}).eq('following_id',user.id).eq('follower_id',String(form.get('followerId')));
  revalidatePath('/notifications');
}
