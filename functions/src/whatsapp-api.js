/**
 * WhatsApp Cloud API wrapper
 * Documentacao: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
const axios = require("axios");
const BASE = "https://graph.facebook.com/v19.0";

async function sendRequest(phoneNumberId, accessToken, to, payload) {
  const url = `${BASE}/${phoneNumberId}/messages`;
  try {
    const res = await axios.post(url, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      ...payload,
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    return res.data;
  } catch (e) {
    console.error("[WhatsApp API] Erro:", e.response?.data || e.message);
    throw e;
  }
}

/** Envia mensagem de texto simples */
async function sendText(phoneNumberId, accessToken, to, text) {
  return sendRequest(phoneNumberId, accessToken, to, {
    type: "text",
    text: { preview_url: false, body: text },
  });
}

/** Envia imagem (URL publica) */
async function sendImage(phoneNumberId, accessToken, to, imageUrl, caption) {
  return sendRequest(phoneNumberId, accessToken, to, {
    type: "image",
    image: { link: imageUrl, caption: caption || "" },
  });
}

/** Envia mensagem com botoes interativos (max 3 botoes) */
async function sendButtons(phoneNumberId, accessToken, to, bodyText, buttons) {
  return sendRequest(phoneNumberId, accessToken, to, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((b, i) => ({
          type: "reply",
          reply: { id: b.id || `btn_${i}`, title: b.title.substring(0, 20) },
        })),
      },
    },
  });
}

/** Envia lista interativa com secoes */
async function sendList(phoneNumberId, accessToken, to, bodyText, buttonLabel, sections) {
  return sendRequest(phoneNumberId, accessToken, to, {
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: bodyText },
      action: {
        button: buttonLabel.substring(0, 20),
        sections: sections.map(s => ({
          title: s.title.substring(0, 24),
          rows: s.rows.slice(0, 10).map(r => ({
            id: r.id,
            title: r.title.substring(0, 24),
            description: (r.description || "").substring(0, 72),
          })),
        })),
      },
    },
  });
}

/** Marca mensagem como lida */
async function markRead(phoneNumberId, accessToken, messageId) {
  const url = `${BASE}/${phoneNumberId}/messages`;
  try {
    await axios.post(url, {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    });
  } catch (e) { /* silencioso */ }
}

module.exports = { sendText, sendImage, sendButtons, sendList, markRead };
