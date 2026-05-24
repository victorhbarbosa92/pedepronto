/**
 * PedePronto — Mercado Pago Point Proxy (Cloudflare Worker)
 * Evita CORS: browser -> worker -> api.mercadopago.com
 * Free tier: 100k requests/dia
 */

const MP_BASE = 'https://api.mercadopago.com/point/integration-api';
const ALLOWED = ['https://pedepronto-40790.web.app', 'https://pedepronto-40790.firebaseapp.com', 'http://localhost:5500', 'http://127.0.0.1:5500'];

function cors(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED.find(a => origin.startsWith(a)) || ALLOWED[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(request) });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST only' }), {
        status: 405, headers: { ...cors(request), 'Content-Type': 'application/json' }
      });
    }

    try {
      const body = await request.json();
      const { action, token, device_id, intent_id, amount, description, idempotency_key } = body;

      if (!token) {
        return jsonResp({ error: 'token obrigatorio' }, 400, request);
      }

      const headers = {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      };

      let url, method = 'GET', fetchBody = null;

      switch (action) {
        case 'devices':
          url = MP_BASE + '/devices';
          break;

        case 'device_status':
          if (!device_id) return jsonResp({ error: 'device_id obrigatorio' }, 400, request);
          url = MP_BASE + '/devices/' + device_id;
          break;

        case 'create_intent':
          if (!device_id || !amount) return jsonResp({ error: 'device_id e amount obrigatorios' }, 400, request);
          url = MP_BASE + '/devices/' + device_id + '/payment-intents';
          method = 'POST';
          fetchBody = JSON.stringify({
            amount: amount,
            description: description || 'PedePronto',
            payment: { installments: 1, type: 'credit_card' }
          });
          if (idempotency_key) headers['X-Idempotency-Key'] = idempotency_key;
          break;

        case 'poll_intent':
          if (!intent_id) return jsonResp({ error: 'intent_id obrigatorio' }, 400, request);
          url = MP_BASE + '/payment-intents/' + intent_id;
          break;

        default:
          return jsonResp({ error: 'action invalida: ' + action }, 400, request);
      }

      const mpResp = await fetch(url, {
        method,
        headers,
        body: fetchBody,
      });

      const data = await mpResp.json();

      return new Response(JSON.stringify(data), {
        status: mpResp.status,
        headers: { ...cors(request), 'Content-Type': 'application/json' }
      });

    } catch (e) {
      return jsonResp({ error: e.message }, 500, request);
    }
  }
};

function jsonResp(data, status, request) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...cors(request), 'Content-Type': 'application/json' }
  });
}
