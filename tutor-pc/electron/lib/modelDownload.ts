// Agrega o progresso de download do modelo Kokoro (vários arquivos) num único % — para mostrar
// "Baixando voz local X%" na 1ª vez. Puro/testável (o callback do HF dispara por arquivo).

export interface DownloadState { files: Record<string, { loaded: number; total: number }> }
export const emptyDownload: DownloadState = { files: {} }

export interface ProgressEvent { file?: string; name?: string; loaded?: number; total?: number; status?: string }

/** Aplica um evento de progresso e retorna o estado novo + % geral + se ainda está baixando. */
export function aggregateDownload(state: DownloadState, ev: ProgressEvent): { state: DownloadState; percent: number; active: boolean } {
  const file = ev.file || ev.name || ''
  const files = { ...state.files }
  if (file && (ev.total ?? 0) > 0) {
    files[file] = { loaded: Math.max(files[file]?.loaded ?? 0, ev.loaded ?? 0), total: ev.total as number }
  }
  let loaded = 0
  let total = 0
  for (const f of Object.values(files)) { loaded += f.loaded; total += f.total }
  const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
  const active = total > 0 && loaded < total
  return { state: { files }, percent, active }
}
