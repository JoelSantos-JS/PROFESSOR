export const SUPABASE_URL =
  process.env.PROFESSOR_SUPABASE_URL ?? 'https://wradnfrhvqkgbswygioj.supabase.co'

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.PROFESSOR_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_2A5-obCNVEpHLqnCJHFDQA_ixrQa0Yq'

export function hasSupabaseConfig(): boolean {
  return /^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(SUPABASE_URL)
    && SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')
}
