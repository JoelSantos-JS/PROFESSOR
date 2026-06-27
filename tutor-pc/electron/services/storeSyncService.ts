import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, hasSupabaseConfig } from '../lib/supabaseConfig.js'
import { SecureSessionStore, activeUserId } from './secureSessionStore.js'
import { StoreService, type StoreData } from './storeService.js'

// Backup/restore dos dados de APRENDIZADO na nuvem (Supabase). Tabela `user_store(user_id, data, updated_at)`
// com RLS (cada um só a própria linha). Sobe só dados leves (sem áudio, sem telemetria). Best-effort:
// NUNCA quebra o app — se faltar tabela/rede/sessão, só loga e segue.

function authedClient(): SupabaseClient | null {
  if (!hasSupabaseConfig()) return null
  const token = new SecureSessionStore().load()?.session?.access_token
  if (!token) return null
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/** Sobe os dados de aprendizado pra nuvem (chamado ao fim da sessão / ao fechar). */
export async function backupStore(): Promise<{ ok: boolean; error?: string }> {
  try {
    const uid = activeUserId()
    const client = authedClient()
    if (!uid || !client) return { ok: false, error: 'no-session' }
    const data = new StoreService().exportForBackup()
    const { error } = await client.from('user_store').upsert({ user_id: uid, data, updated_at: new Date().toISOString() })
    if (error) { console.warn('[sync] backup falhou:', error.message); return { ok: false, error: error.message } }
    console.log('[sync] backup ok')
    return { ok: true }
  } catch (err) {
    console.warn('[sync] backup erro:', (err as Error).message)
    return { ok: false, error: (err as Error).message }
  }
}

/** Restaura da nuvem APENAS se o store local estiver vazio (PC novo / reinstalação). */
export async function restoreStoreIfEmpty(): Promise<{ ok: boolean; restored: boolean; error?: string }> {
  try {
    const uid = activeUserId()
    const client = authedClient()
    if (!uid || !client) return { ok: false, restored: false, error: 'no-session' }
    const store = new StoreService()
    if (store.hasLearningData()) return { ok: true, restored: false }  // já tem dados local → não sobrescreve
    const { data, error } = await client.from('user_store').select('data').eq('user_id', uid).maybeSingle()
    if (error) { console.warn('[sync] restore falhou:', error.message); return { ok: false, restored: false, error: error.message } }
    if (data?.data) {
      store.importFromBackup(data.data as Partial<Omit<StoreData, 'tokenUsage'>>)
      console.log('[sync] restaurado da nuvem')
      return { ok: true, restored: true }
    }
    return { ok: true, restored: false }
  } catch (err) {
    console.warn('[sync] restore erro:', (err as Error).message)
    return { ok: false, restored: false, error: (err as Error).message }
  }
}
