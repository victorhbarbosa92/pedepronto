/**
 * Carrega configuracao do estabelecimento do Firestore
 * Cache em memoria por instancia (Cloud Functions mantém instancias quentes)
 */
const admin = require("firebase-admin");

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 60000; // 1 minuto

async function loadConfig(estabUid) {
  const now = Date.now();
  if (_cache && _cache.uid === estabUid && now - _cacheTime < CACHE_TTL) {
    return _cache;
  }
  const db = admin.firestore();
  const snap = await db.collection("estabelecimentos").doc(estabUid).collection("dados").doc("principal").get();
  if (!snap.exists) throw new Error("Estabelecimento nao encontrado");
  const data = snap.data();
  _cache = {
    uid: estabUid,
    produtos: (data.produtos || []).filter(p => p.ativo !== false),
    categorias: data.categorias || [],
    obs_grupos: data.obs_grupos_globais || [],
    cfg: data.cfg || {},
    pedidos: data.pedidos || [],
    pedido_seq: data.pedido_seq || data.cfg?._pedido_seq || 1,
  };
  _cacheTime = now;
  return _cache;
}

/** Invalida cache (chamado apos escrita) */
function invalidateCache() {
  _cache = null;
  _cacheTime = 0;
}

/** Busca config do agente WhatsApp */
async function getAgentConfig(estabUid) {
  const config = await loadConfig(estabUid);
  return config.cfg.whatsapp_agent || null;
}

module.exports = { loadConfig, invalidateCache, getAgentConfig };
