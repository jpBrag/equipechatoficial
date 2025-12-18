// Utilitário para normalizar JIDs do WhatsApp
// Se vier com @lid, converte para @s.whatsapp.net (usuário) ou @g.us (grupo)

export function normalizeJid(jid: string): string {
  if (!jid) return jid;
  if (jid.includes('@lid')) {
    const base = jid.split('@')[0];
    if (base.length > 15 || jid.includes('g.us')) {
      return base + '@g.us';
    }
    return base + '@s.whatsapp.net';
  }
  return jid;
} 