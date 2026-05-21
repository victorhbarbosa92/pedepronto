/**
 * Cria pedidos no Firestore no formato exato do POS (PedePronto)
 * Usa transacao atomica para garantir numero de pedido unico
 */
const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");

/**
 * Cria um pedido delivery no Firestore
 * @param {string} estabUid - UID do estabelecimento
 * @param {object} orderData - { cliente_nome, telefone, endereco, itens, total, taxa_entrega, forma_pag }
 * @returns {object} pedido criado com num
 */
async function createOrder(estabUid, orderData) {
  const db = admin.firestore();
  const docRef = db.collection("estabelecimentos").doc(estabUid).collection("dados").doc("principal");

  // Transacao atomica: ler seq, incrementar, e adicionar pedido
  const pedido = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) throw new Error("Estabelecimento nao encontrado");
    const data = snap.data();
    const pedidos = data.pedidos || [];

    // Gerar numero sequencial
    let seq = 1;
    // Pegar o maior numero existente para evitar colisao
    pedidos.forEach(p => {
      const n = parseInt((p.num || "").replace("#", ""), 10);
      if (!isNaN(n) && n >= seq) seq = n + 1;
    });

    const now = new Date().toISOString();
    const ped = {
      id: uuidv4(),
      num: "#" + String(seq).padStart(3, "0"),
      tipo: "delivery",
      mesa_id: null,
      mesa_label: "Delivery",
      cliente_nome: orderData.cliente_nome || "Cliente WhatsApp",
      telefone: orderData.telefone || "",
      status: "aberto",
      created: now,
      itens: (orderData.itens || []).map(item => ({
        prod_id: item.prod_id || "",
        nome: item.nome || "",
        preco: item.preco || 0,
        qty: item.qty || 1,
        obs: item.obs || "",
        obs_livre: item.obs_livre || "",
        obs_extras: item.obs_extras || [],
        dest: item.dest || "coz",
        tempo: item.tempo || 15,
        ico: item.ico || "",
        categoria: item.categoria || "",
        concluido: false,
      })),
      total_bruto: orderData.total || 0,
      desconto: 0,
      taxa_servico: orderData.taxa_entrega || 0,
      taxa_valor: orderData.taxa_entrega || 0,
      total: (orderData.total || 0) + (orderData.taxa_entrega || 0),
      consumo: "viagem",
      endereco: orderData.endereco || "",
      del_pagamento: orderData.forma_pag || "pix",
      del_troco_para: "",
      operador: "WhatsApp Bot",
      _origem: "whatsapp",
      _wp_phone: orderData.telefone || "",
      _wp_payment_id: orderData.payment_id || null,
      prev_coz: null,
      prev_bar: null,
      entregue: false,
    };

    pedidos.push(ped);

    // Atualizar Firestore com novo pedido + savedAt para triggerar sync
    tx.update(docRef, {
      pedidos,
      _savedAt: now,
      _dev_id: "whatsapp-bot",
    });

    return ped;
  });

  return pedido;
}

/**
 * Atualiza status de pagamento de um pedido
 */
async function updateOrderPayment(estabUid, orderId, status) {
  const db = admin.firestore();
  const docRef = db.collection("estabelecimentos").doc(estabUid).collection("dados").doc("principal");

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) return;
    const data = snap.data();
    const pedidos = data.pedidos || [];
    const ped = pedidos.find(p => p.id === orderId);
    if (!ped) return;

    if (status === "approved") {
      ped.status = "preparo";
      ped._pago_whatsapp = true;
      ped._pago_whatsapp_em = new Date().toISOString();
    }

    tx.update(docRef, {
      pedidos,
      _savedAt: new Date().toISOString(),
      _dev_id: "whatsapp-bot",
    });
  });
}

module.exports = { createOrder, updateOrderPayment };
