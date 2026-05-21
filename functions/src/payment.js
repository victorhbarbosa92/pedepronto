/**
 * Integracao PIX via Mercado Pago
 * Documentacao: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-configuration/integrate-with-pix
 */
const axios = require("axios");
const MP_API = "https://api.mercadopago.com";

/**
 * Cria pagamento PIX dinamico
 * @returns {{ payment_id, qr_code, qr_code_base64, ticket_url }}
 */
async function createPixPayment(accessToken, amount, description, externalRef, payerEmail) {
  try {
    const res = await axios.post(`${MP_API}/v1/payments`, {
      transaction_amount: amount,
      description: description || "Pedido Baguetalho",
      payment_method_id: "pix",
      payer: {
        email: payerEmail || "cliente@baguetalho.com",
      },
      external_reference: externalRef,
      notification_url: null, // sera configurado via webhook global do MP
    }, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": externalRef,
      },
    });

    const data = res.data;
    return {
      payment_id: data.id,
      status: data.status,
      qr_code: data.point_of_interaction?.transaction_data?.qr_code || "",
      qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64 || "",
      ticket_url: data.point_of_interaction?.transaction_data?.ticket_url || "",
    };
  } catch (e) {
    console.error("[MercadoPago] Erro ao criar PIX:", e.response?.data || e.message);
    throw e;
  }
}

/**
 * Consulta status de um pagamento
 * @returns {{ status, status_detail }}
 */
async function checkPaymentStatus(accessToken, paymentId) {
  try {
    const res = await axios.get(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return {
      status: res.data.status,
      status_detail: res.data.status_detail,
      external_reference: res.data.external_reference,
    };
  } catch (e) {
    console.error("[MercadoPago] Erro ao consultar pagamento:", e.response?.data || e.message);
    throw e;
  }
}

/**
 * Gera PIX estatico (fallback sem Mercado Pago)
 * Baseado na funcao _pixEmv() do index.html
 */
function generateStaticPix(chavePix, nome, cidade, valor, txid) {
  const f = (id, val) => id + String(val.length).padStart(2, "0") + val;
  const amt = valor.toFixed(2);
  const merchant = f("00", "BR.GOV.BCB.PIX") + f("01", chavePix);
  let emv = f("00", "01") + f("26", merchant) + f("52", "0000") + f("53", "986") +
    f("54", amt) + f("58", "BR") + f("59", nome.substring(0, 25)) + f("60", cidade.substring(0, 15));
  if (txid) emv += f("62", f("05", txid));
  emv += "6304";
  // CRC16-CCITT
  let crc = 0xFFFF;
  for (let i = 0; i < emv.length; i++) {
    crc ^= emv.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xFFFF;
  }
  return emv + crc.toString(16).toUpperCase().padStart(4, "0");
}

module.exports = { createPixPayment, checkPaymentStatus, generateStaticPix };
