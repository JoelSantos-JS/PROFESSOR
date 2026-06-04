export async function providerFetch(provider: string, url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (err) {
    throw new Error(formatProviderNetworkError(provider, err))
  }
}

function formatProviderNetworkError(provider: string, err: unknown): string {
  const error = err as Error & { cause?: { code?: string; message?: string } }
  const causeCode = error.cause?.code
  const causeMessage = error.cause?.message

  if (causeCode === 'DEPTH_ZERO_SELF_SIGNED_CERT' || causeMessage?.toLowerCase().includes('self-signed')) {
    return [
      `${provider}: falha TLS/certificado ao conectar ao provider.`,
      'O Node/Electron recebeu um certificado autoassinado.',
      'Verifique proxy/antivirus HTTPS ou configure o certificado raiz em NODE_EXTRA_CA_CERTS.',
      'Para destravar apenas em desenvolvimento, rode npm run dev:insecure-tls.',
    ].join(' ')
  }

  if (causeCode) {
    return `${provider}: falha de rede (${causeCode})${causeMessage ? `: ${causeMessage}` : ''}`
  }

  return `${provider}: ${error.message || 'falha de rede desconhecida'}`
}
