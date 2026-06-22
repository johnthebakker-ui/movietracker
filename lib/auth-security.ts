export async function needsMfaChallenge(supabase: any) {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return false;
  return data?.nextLevel === "aal2" && data?.currentLevel !== "aal2";
}

export async function requireMfaIfEnrolled(supabase: any) {
  if (await needsMfaChallenge(supabase)) throw new Error("Complete your authenticator challenge before changing account data");
}
