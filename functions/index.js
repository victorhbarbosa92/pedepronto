/**
 * PedePronto — Cloud Functions (2nd gen)
 * Webhook WhatsApp + Webhook Mercado Pago
 */
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const { handleMessage } = require("./src/conversation");
const { invalidateCache, getAgentConfig } = require("./src/config-loader");
const { checkPaymentStatus } = require("./src/payment");
const { updateOrderPayment } = require("./src/order-creator");
const wa = require("./src/whatsapp-api");

// ── WhatsApp Webhook ──────────────────────────────────────────────────────────

exports.whatsappWebhook = onRequest({ region: "southamerica-east1", cors: true }, async (req, res) => {
  // Verificacao do webhook (GET)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // Buscar verify_token do primeiro estabelecimento configurado
    // (MVP: single-tenant — um bot por projeto Firebase)
    const estabUid = await findEstabWithAgent();
    if (!estabUid) {
      console.warn("[Webhook] Nenhum estabelecimento com agente WhatsApp configurado");
      return res.sendStatus(403);
    }
    const agentCfg = await getAgentConfig(estabUid);
    if (mode === "subscribe" && token === (agentCfg?.verify_token || "pedepronto_verify")) {
      console.log("[Webhook] Verificacao OK");
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }

  // Mensagem recebida (POST)
  if (req.method === "POST") {
    try {
      const body = req.body;
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // Ignorar status updates (delivered, read, etc)
      if (value?.statuses) {
        return res.sendStatus(200);
      }

      const msg = value?.messages?.[0];
      if (!msg) return res.sendStatus(200);

      const from = msg.from; // telefone do cliente
      const phoneNumberId = value.metadata?.phone_number_id;

      // Encontrar estabelecimento pelo phone_number_id
      const estabUid = await findEstabByPhoneId(phoneNumberId);
      if (!estabUid) {
        console.warn(`[Webhook] phone_number_id ${phoneNumberId} nao vinculado a nenhum estabelecimento`);
        return res.sendStatus(200);
      }

      const agentCfg = await getAgentConfig(estabUid);
      if (!agentCfg || !agentCfg.ativo) {
        return res.sendStatus(200);
      }

      // Extrair texto da mensagem
      let text = "";
      let msgType = msg.type;
      if (msg.type === "text") {
        text = msg.text?.body || "";
      } else if (msg.type === "interactive") {
        // Botao ou lista selecionado
        text = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "";
      } else if (msg.type === "image") {
        text = "comprovante"; // assume comprovante de pagamento
      }

      // Marcar como lida
      await wa.markRead(phoneNumberId, agentCfg.access_token, msg.id).catch(() => {});

      // Processar mensagem na maquina de estados
      const replies = await handleMessage(estabUid, agentCfg, from, text, msgType);

      // Enviar respostas
      for (const reply of replies) {
        await wa.sendText(phoneNumberId, agentCfg.access_token, from, reply);
      }

    } catch (e) {
      console.error("[Webhook] Erro ao processar mensagem:", e);
    }

    return res.sendStatus(200);
  }

  res.sendStatus(405);
});

// ── Mercado Pago Webhook ──────────────────────────────────────────────────────

exports.mercadoPagoWebhook = onRequest({ region: "southamerica-east1", cors: true }, async (req, res) => {
  if (req.method !== "POST") return res.sendStatus(405);

  try {
    const { type, data } = req.body;

    if (type !== "payment") return res.sendStatus(200);

    const paymentId = data?.id;
    if (!paymentId) return res.sendStatus(200);

    // Encontrar estabelecimento com MP configurado
    const estabUid = await findEstabWithAgent();
    if (!estabUid) return res.sendStatus(200);

    const agentCfg = await getAgentConfig(estabUid);
    if (!agentCfg?.mp_access_token) return res.sendStatus(200);

    // Consultar status do pagamento no MP
    const payment = await checkPaymentStatus(agentCfg.mp_access_token, paymentId);

    if (payment.status === "approved") {
      const orderId = payment.external_reference;
      if (orderId) {
        // Atualizar pedido no Firestore
        await updateOrderPayment(estabUid, orderId, "approved");
        invalidateCache();

        // Notificar cliente via WhatsApp
        const db = admin.firestore();
        // Buscar pedido para pegar telefone
        const docRef = db.collection("estabelecimentos").doc(estabUid).collection("dados").doc("principal");
        const snap = await docRef.get();
        if (snap.exists) {
          const pedidos = snap.data().pedidos || [];
          const ped = pedidos.find(p => p.id === orderId);
          if (ped && ped._wp_phone) {
            const msg = `Pagamento confirmado! ✅\n\nPedido *${ped.num}* em preparo.\nTempo estimado: ${agentCfg.tempo_medio || 45} min.\n\nObrigado pela preferencia!`;
            await wa.sendText(agentCfg.phone_number_id, agentCfg.access_token, ped._wp_phone, msg).catch(() => {});
          }
        }
      }
    }

  } catch (e) {
    console.error("[MP Webhook] Erro:", e);
  }

  res.sendStatus(200);
});

// ── Mercado Pago Point Proxy (evita CORS do browser) ────────────────────────

exports.mpProxy = onRequest({ region: "southamerica-east1", cors: true }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { action, token, device_id, intent_id, amount, description, idempotency_key } = req.body;

    if (!token) return res.status(400).json({ error: "Token obrigatorio" });

    const axios = require("axios");
    const headers = { "Authorization": "Bearer " + token, "Content-Type": "application/json" };

    if (action === "devices") {
      // Listar dispositivos
      const r = await axios.get("https://api.mercadopago.com/point/integration-api/devices", { headers });
      return res.json(r.data);

    } else if (action === "device_status") {
      // Status de um dispositivo
      if (!device_id) return res.status(400).json({ error: "device_id obrigatorio" });
      const r = await axios.get("https://api.mercadopago.com/point/integration-api/devices/" + device_id, { headers });
      return res.json(r.data);

    } else if (action === "create_intent") {
      // Criar payment intent
      if (!device_id || !amount) return res.status(400).json({ error: "device_id e amount obrigatorios" });
      const body = {
        amount: amount,
        description: description || "PedePronto",
        payment: { installments: 1, type: "credit_card" }
      };
      if (idempotency_key) headers["X-Idempotency-Key"] = idempotency_key;
      const r = await axios.post(
        "https://api.mercadopago.com/point/integration-api/devices/" + device_id + "/payment-intents",
        body, { headers }
      );
      return res.json(r.data);

    } else if (action === "poll_intent") {
      // Verificar status de payment intent
      if (!intent_id) return res.status(400).json({ error: "intent_id obrigatorio" });
      const r = await axios.get(
        "https://api.mercadopago.com/point/integration-api/payment-intents/" + intent_id,
        { headers }
      );
      return res.json(r.data);

    } else {
      return res.status(400).json({ error: "action invalida: " + action });
    }

  } catch (e) {
    const status = e.response?.status || 500;
    const data = e.response?.data || { error: e.message };
    console.error("[mpProxy] Erro:", status, data);
    return res.status(status).json(data);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Cache de mapeamento phone_number_id -> estabUid */
let _phoneMap = null;
let _phoneMapTime = 0;

async function findEstabByPhoneId(phoneNumberId) {
  const now = Date.now();
  if (_phoneMap && now - _phoneMapTime < 120000) {
    return _phoneMap[phoneNumberId] || null;
  }
  // Buscar todos estabelecimentos com agente configurado
  await buildPhoneMap();
  return _phoneMap[phoneNumberId] || null;
}

async function findEstabWithAgent() {
  if (_phoneMap && Date.now() - _phoneMapTime < 120000) {
    return Object.values(_phoneMap)[0] || null;
  }
  await buildPhoneMap();
  return Object.values(_phoneMap)[0] || null;
}

async function buildPhoneMap() {
  _phoneMap = {};
  _phoneMapTime = Date.now();
  try {
    const db = admin.firestore();
    const estabs = await db.collection("estabelecimentos").listDocuments();
    for (const estabDoc of estabs) {
      const snap = await db.collection("estabelecimentos").doc(estabDoc.id).collection("dados").doc("principal").get();
      if (snap.exists) {
        const cfg = snap.data().cfg?.whatsapp_agent;
        if (cfg && cfg.phone_number_id) {
          _phoneMap[cfg.phone_number_id] = estabDoc.id;
        }
      }
    }
  } catch (e) {
    console.error("[buildPhoneMap] Erro:", e);
  }
}
