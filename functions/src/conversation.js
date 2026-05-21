/**
 * Maquina de estados para conversa WhatsApp
 * Estados: idle > menu > categoria > item > obs > carrinho > endereco > pagamento > confirmado
 */
const admin = require("firebase-admin");
const { loadConfig } = require("./config-loader");
const { createOrder, updateOrderPayment } = require("./order-creator");
const { createPixPayment, generateStaticPix } = require("./payment");
const wa = require("./whatsapp-api");

const SESSION_TTL = 2 * 60 * 60 * 1000; // 2 horas

/** Carrega ou cria sessao do cliente */
async function getSession(estabUid, phone) {
  const db = admin.firestore();
  const ref = db.collection("estabelecimentos").doc(estabUid).collection("whatsapp_sessions").doc(phone);
  const snap = await ref.get();
  if (snap.exists) {
    const s = snap.data();
    // Reset se sessao expirou
    if (Date.now() - new Date(s.updated_at).getTime() > SESSION_TTL) {
      return newSession(phone);
    }
    return s;
  }
  return newSession(phone);
}

function newSession(phone) {
  return {
    phone,
    state: "idle",
    cart: [],
    cliente_nome: "",
    endereco: "",
    bairro: "",
    complemento: "",
    current_category: null,
    current_item: null,
    current_obs_step: 0,
    order_id: null,
    payment_id: null,
    updated_at: new Date().toISOString(),
  };
}

async function saveSession(estabUid, phone, session) {
  session.updated_at = new Date().toISOString();
  const db = admin.firestore();
  await db.collection("estabelecimentos").doc(estabUid).collection("whatsapp_sessions").doc(phone).set(session);
}

/** Formata preco em reais */
function fmtR(v) { return "R$ " + (v || 0).toFixed(2).replace(".", ","); }

/**
 * Processa mensagem recebida
 * @returns {string[]} array de mensagens para enviar
 */
async function handleMessage(estabUid, agentCfg, phone, text, msgType) {
  const session = await getSession(estabUid, phone);
  const config = await loadConfig(estabUid);
  const replies = [];

  // Verificar horario de funcionamento
  if (agentCfg.horario_inicio && agentCfg.horario_fim && session.state === "idle") {
    const agora = new Date();
    const h = agora.getHours() * 100 + agora.getMinutes();
    const ini = parseInt(agentCfg.horario_inicio.replace(":", ""), 10);
    const fim = parseInt(agentCfg.horario_fim.replace(":", ""), 10);
    if (h < ini || h > fim) {
      replies.push(agentCfg.mensagem_fora_horario || `Estamos fechados no momento. Nosso horario e de ${agentCfg.horario_inicio} as ${agentCfg.horario_fim}.`);
      return replies;
    }
  }

  const input = (text || "").trim();
  const inputLower = input.toLowerCase();

  // Comandos globais
  if (inputLower === "cancelar" || inputLower === "sair" || inputLower === "0") {
    Object.assign(session, newSession(phone));
    replies.push("Pedido cancelado. Digite qualquer coisa para comecar novamente!");
    await saveSession(estabUid, phone, session);
    return replies;
  }

  // Guardar estabUid na sessao para handlers que precisam
  session._estabUid = estabUid;

  switch (session.state) {
    case "idle":
      await handleIdle(session, config, agentCfg, input, replies);
      break;
    case "menu":
      await handleMenu(session, config, input, replies);
      break;
    case "categoria":
      await handleCategoria(session, config, input, replies);
      break;
    case "obs":
      await handleObs(session, config, input, replies);
      break;
    case "carrinho":
      await handleCarrinho(session, config, agentCfg, input, replies);
      break;
    case "nome":
      await handleNome(session, input, replies);
      break;
    case "endereco":
      await handleEndereco(session, config, input, replies);
      break;
    case "confirmar":
      await handleConfirmar(session, config, agentCfg, estabUid, input, replies);
      break;
    case "pagamento":
      await handlePagamento(session, input, replies);
      break;
    default:
      Object.assign(session, newSession(phone));
      await handleIdle(session, config, agentCfg, input, replies);
  }

  await saveSession(estabUid, phone, session);
  return replies;
}

// ── HANDLERS ──

async function handleIdle(session, config, agentCfg, input, replies) {
  const nome = agentCfg.nome_restaurante || config.cfg.nome || "Baguetalho";
  const greeting = agentCfg.greeting || `Ola! Bem-vindo ao ${nome}! O que posso fazer por voce?`;
  replies.push(
    `${greeting}\n\n` +
    `1 - Ver Cardapio\n` +
    `2 - Fazer Pedido\n` +
    `3 - Acompanhar Pedido\n` +
    `4 - Horario de Funcionamento\n\n` +
    `Digite o numero da opcao desejada.`
  );
  session.state = "menu";
}

async function handleMenu(session, config, input, replies) {
  if (input === "1" || input.toLowerCase().includes("cardapio") || input.toLowerCase().includes("menu")) {
    // Mostrar categorias
    const cats = config.categorias.filter(c => config.produtos.some(p => p.cat_id === c.id));
    if (!cats.length) {
      replies.push("Nosso cardapio esta sendo atualizado. Tente novamente em alguns minutos!");
      return;
    }
    let msg = "Nosso Cardapio:\n\n";
    cats.forEach((c, i) => {
      const count = config.produtos.filter(p => p.cat_id === c.id).length;
      msg += `${i + 1} - ${c.emoji || ""} ${c.nome} (${count} itens)\n`;
    });
    msg += `\nDigite o numero da categoria para ver os itens.`;
    replies.push(msg);
    session.state = "categoria";
    session._cats = cats.map(c => c.id);

  } else if (input === "2" || input.toLowerCase().includes("pedido")) {
    // Ir direto para categorias (mesmo fluxo)
    const cats = config.categorias.filter(c => config.produtos.some(p => p.cat_id === c.id));
    let msg = "Escolha uma categoria:\n\n";
    cats.forEach((c, i) => {
      msg += `${i + 1} - ${c.emoji || ""} ${c.nome}\n`;
    });
    msg += `\nDigite o numero da categoria.`;
    replies.push(msg);
    session.state = "categoria";
    session._cats = cats.map(c => c.id);

  } else if (input === "3" || input.toLowerCase().includes("acompanhar")) {
    replies.push("Para acompanhar seu pedido, informe o numero (ex: #001).");
    // TODO: implementar busca de pedido
    session.state = "idle";

  } else if (input === "4" || input.toLowerCase().includes("horario")) {
    const cfg = config.cfg.whatsapp_agent || {};
    replies.push(
      `Horario de funcionamento:\n` +
      `${cfg.horario_inicio || "11:00"} as ${cfg.horario_fim || "23:00"}\n\n` +
      `Taxa de entrega: ${fmtR(cfg.taxa_entrega || 0)}\n` +
      `Tempo medio de entrega: ${cfg.tempo_medio || 45} minutos\n\n` +
      `Digite 1 para ver o cardapio ou 2 para fazer um pedido.`
    );

  } else {
    replies.push("Nao entendi. Digite:\n1 - Ver Cardapio\n2 - Fazer Pedido\n3 - Acompanhar Pedido\n4 - Horario");
  }
}

async function handleCategoria(session, config, input, replies) {
  const cats = (session._cats || []).map(id => config.categorias.find(c => c.id === id)).filter(Boolean);
  const idx = parseInt(input, 10) - 1;

  // Tentar match por nome tambem
  let cat = null;
  if (idx >= 0 && idx < cats.length) {
    cat = cats[idx];
  } else {
    cat = cats.find(c => c.nome.toLowerCase().includes(input.toLowerCase()));
  }

  if (!cat) {
    replies.push("Categoria nao encontrada. Digite o numero da categoria desejada.");
    return;
  }

  session.current_category = cat.id;
  const prods = config.produtos.filter(p => p.cat_id === cat.id);

  let msg = `${cat.emoji || ""} *${cat.nome}*:\n\n`;
  prods.forEach((p, i) => {
    msg += `${i + 1} - ${p.ico || ""} ${p.nome} - ${fmtR(p.preco)}`;
    if (p.desc) msg += `\n   _${p.desc}_`;
    msg += `\n`;
  });

  // Mostrar carrinho se tem itens
  if (session.cart.length > 0) {
    const totalCart = session.cart.reduce((s, i) => s + i.preco * i.qty, 0);
    msg += `\n Seu carrinho: ${session.cart.length} item(ns) - ${fmtR(totalCart)}`;
    msg += `\nDigite *F* para finalizar pedido.`;
  }

  msg += `\nDigite o numero do item para adicionar ao pedido.`;
  msg += `\nDigite *V* para voltar as categorias.`;
  replies.push(msg);
  session.state = "categoria";
  session._prods = prods.map(p => p.id);
  session._inCategory = true;
}

// Sobrescrever handleCategoria para diferenciar listagem vs selecao
const _origHandleCategoria = handleCategoria;
handleCategoria = async function(session, config, input, replies) {
  if (!session._inCategory) {
    return _origHandleCategoria(session, config, input, replies);
  }

  const inputUp = input.toUpperCase();
  if (inputUp === "V" || inputUp === "VOLTAR") {
    session._inCategory = false;
    const cats = config.categorias.filter(c => config.produtos.some(p => p.cat_id === c.id));
    let msg = "Categorias:\n\n";
    cats.forEach((c, i) => msg += `${i + 1} - ${c.emoji || ""} ${c.nome}\n`);
    msg += `\nDigite o numero da categoria.`;
    replies.push(msg);
    session._cats = cats.map(c => c.id);
    return;
  }

  if (inputUp === "F" || inputUp === "FINALIZAR") {
    if (!session.cart.length) {
      replies.push("Seu carrinho esta vazio! Adicione itens antes de finalizar.");
      return;
    }
    session.state = "carrinho";
    showCart(session, config, replies);
    return;
  }

  // Selecionar produto
  const prods = (session._prods || []).map(id => config.produtos.find(p => p.id === id)).filter(Boolean);
  const idx = parseInt(input, 10) - 1;
  let prod = null;
  if (idx >= 0 && idx < prods.length) {
    prod = prods[idx];
  } else {
    prod = prods.find(p => p.nome.toLowerCase().includes(input.toLowerCase()));
  }

  if (!prod) {
    replies.push("Item nao encontrado. Digite o numero do item desejado.");
    return;
  }

  // Verificar se tem grupos de observacao
  const obsGrupos = (prod.obs_grupos || []).map(gid =>
    config.obs_grupos.find(g => g.id === gid)
  ).filter(Boolean);

  session.current_item = {
    prod_id: prod.id,
    nome: prod.nome,
    preco: prod.preco,
    qty: 1,
    dest: (prod.dest || ["coz"])[0],
    tempo: prod.tempo || 15,
    ico: prod.ico || "",
    categoria: config.categorias.find(c => c.id === prod.cat_id)?.nome || "",
    obs: "",
    obs_extras: [],
  };

  if (obsGrupos.length > 0) {
    session._obsGrupos = obsGrupos;
    session.current_obs_step = 0;
    session.state = "obs";
    showObsStep(session, replies);
  } else {
    // Sem observacoes, adiciona direto
    session.cart.push(session.current_item);
    session.current_item = null;
    const totalCart = session.cart.reduce((s, i) => s + i.preco * i.qty, 0);
    replies.push(
      `${prod.ico || ""} *${prod.nome}* adicionado! ${fmtR(prod.preco)}\n\n` +
      `Carrinho: ${session.cart.length} item(ns) - ${fmtR(totalCart)}\n\n` +
      `Continue escolhendo ou digite *F* para finalizar.`
    );
  }
};

function showObsStep(session, replies) {
  const grupo = session._obsGrupos[session.current_obs_step];
  if (!grupo) return;
  const normOp = op => typeof op === "string" ? { nome: op, preco: 0 } : op;
  const opcoes = (grupo.opcoes || []).map(normOp);
  let msg = `*${grupo.nome}*${grupo.multi ? " (pode escolher varias)" : ""}:\n\n`;
  opcoes.forEach((op, i) => {
    msg += `${i + 1} - ${op.nome}`;
    if (op.preco > 0) msg += ` (+${fmtR(op.preco)})`;
    msg += `\n`;
  });
  msg += `\nDigite o numero da opcao${grupo.multi ? " (ou varios separados por virgula)" : ""}.`;
  msg += `\nDigite *P* para pular.`;
  replies.push(msg);
}

async function handleObs(session, config, input, replies) {
  const grupo = session._obsGrupos[session.current_obs_step];
  if (!grupo) {
    session.state = "categoria";
    session._inCategory = true;
    return;
  }

  const normOp = op => typeof op === "string" ? { nome: op, preco: 0 } : op;
  const opcoes = (grupo.opcoes || []).map(normOp);

  if (input.toUpperCase() !== "P") {
    // Parse selecao (pode ser "1,3" para multi)
    const sels = input.split(/[,\s]+/).map(s => parseInt(s, 10) - 1).filter(i => i >= 0 && i < opcoes.length);
    if (sels.length > 0) {
      const selected = sels.map(i => opcoes[i]);
      const obsText = selected.map(o => o.nome).join(", ");
      const obsPreco = selected.reduce((s, o) => s + (o.preco || 0), 0);

      if (session.current_item.obs) session.current_item.obs += " | ";
      session.current_item.obs += `${grupo.nome}: ${obsText}`;
      session.current_item.obs_extras.push(...selected.map(o => ({ grupo: grupo.nome, nome: o.nome, preco: o.preco || 0 })));
      session.current_item.preco += obsPreco;
    }
  }

  // Proximo grupo de obs ou finalizar item
  session.current_obs_step++;
  if (session.current_obs_step < session._obsGrupos.length) {
    showObsStep(session, replies);
  } else {
    // Adicionar ao carrinho
    session.cart.push(session.current_item);
    const totalCart = session.cart.reduce((s, i) => s + i.preco * i.qty, 0);
    replies.push(
      `${session.current_item.ico || ""} *${session.current_item.nome}* adicionado!\n` +
      (session.current_item.obs ? `_${session.current_item.obs}_\n` : "") +
      `${fmtR(session.current_item.preco)}\n\n` +
      `Carrinho: ${session.cart.length} item(ns) - ${fmtR(totalCart)}\n\n` +
      `Continue escolhendo ou digite *F* para finalizar.`
    );
    session.current_item = null;
    session._obsGrupos = null;
    session.current_obs_step = 0;
    session.state = "categoria";
    session._inCategory = true;
  }
}

function showCart(session, config, replies) {
  const taxa = config.cfg.whatsapp_agent?.taxa_entrega || 0;
  const subtotal = session.cart.reduce((s, i) => s + i.preco * i.qty, 0);
  const total = subtotal + taxa;

  let msg = "*Seu Pedido:*\n\n";
  session.cart.forEach((item, i) => {
    msg += `${i + 1}. ${item.qty}x ${item.nome} - ${fmtR(item.preco * item.qty)}`;
    if (item.obs) msg += `\n   _${item.obs}_`;
    msg += `\n`;
  });
  msg += `\nSubtotal: ${fmtR(subtotal)}`;
  if (taxa > 0) msg += `\nTaxa de entrega: ${fmtR(taxa)}`;
  msg += `\n*Total: ${fmtR(total)}*`;
  msg += `\n\n1 - Confirmar pedido`;
  msg += `\n2 - Adicionar mais itens`;
  msg += `\n3 - Remover item`;
  msg += `\n0 - Cancelar pedido`;
  replies.push(msg);
}

async function handleCarrinho(session, config, agentCfg, input, replies) {
  if (input === "1" || input.toLowerCase().includes("confirmar")) {
    session.state = "nome";
    replies.push("Qual o seu *nome*?");
  } else if (input === "2" || input.toLowerCase().includes("adicionar")) {
    session.state = "categoria";
    session._inCategory = false;
    const cats = config.categorias.filter(c => config.produtos.some(p => p.cat_id === c.id));
    let msg = "Categorias:\n\n";
    cats.forEach((c, i) => msg += `${i + 1} - ${c.emoji || ""} ${c.nome}\n`);
    replies.push(msg);
    session._cats = cats.map(c => c.id);
  } else if (input === "3" || input.toLowerCase().includes("remover")) {
    let msg = "Qual item deseja remover?\n\n";
    session.cart.forEach((item, i) => msg += `${i + 1} - ${item.nome}\n`);
    replies.push(msg);
    session.state = "remover";
  } else {
    replies.push("Digite 1 para confirmar, 2 para adicionar mais, 3 para remover item, ou 0 para cancelar.");
  }
}

async function handleNome(session, input, replies) {
  session.cliente_nome = input.trim();
  session.state = "endereco";
  replies.push(
    `Obrigado, *${session.cliente_nome}*!\n\n` +
    `Agora informe o *endereco completo* para entrega:\n` +
    `(Rua, numero, bairro, complemento)`
  );
}

async function handleEndereco(session, config, input, replies) {
  session.endereco = input.trim();
  session.state = "confirmar";

  const taxa = config?.cfg?.whatsapp_agent?.taxa_entrega || 0;
  const subtotal = session.cart.reduce((s, i) => s + i.preco * i.qty, 0);
  const total = subtotal + taxa;

  let msg = "*Confirme seu pedido:*\n\n";
  msg += `*Cliente:* ${session.cliente_nome}\n`;
  msg += `*Endereco:* ${session.endereco}\n`;
  msg += `*Telefone:* ${session.phone}\n\n`;
  session.cart.forEach(item => {
    msg += `- ${item.qty}x ${item.nome} ${fmtR(item.preco * item.qty)}`;
    if (item.obs) msg += ` _(${item.obs})_`;
    msg += `\n`;
  });
  msg += `\n*Total: ${fmtR(total)}*`;
  msg += `\n\nPagamento via *PIX*`;
  msg += `\n\n1 - Confirmar e gerar PIX`;
  msg += `\n2 - Corrigir dados`;
  msg += `\n0 - Cancelar`;
  replies.push(msg);
}

async function handleConfirmar(session, config, agentCfg, estabUid, input, replies) {
  if (input === "2" || input.toLowerCase().includes("corrigir")) {
    session.state = "nome";
    replies.push("Qual o seu *nome*?");
    return;
  }

  if (input !== "1" && !input.toLowerCase().includes("confirmar")) {
    replies.push("Digite 1 para confirmar ou 2 para corrigir os dados.");
    return;
  }

  const taxa = agentCfg.taxa_entrega || 0;
  const subtotal = session.cart.reduce((s, i) => s + i.preco * i.qty, 0);
  const total = subtotal + taxa;

  // Criar pedido no Firestore
  try {
    const pedido = await createOrder(estabUid, {
      cliente_nome: session.cliente_nome,
      telefone: session.phone,
      endereco: session.endereco,
      itens: session.cart,
      total: subtotal,
      taxa_entrega: taxa,
      forma_pag: "pix",
    });

    session.order_id = pedido.id;
    session.order_num = pedido.num;

    // Gerar PIX
    const mpToken = agentCfg.mp_access_token;
    if (mpToken) {
      // PIX dinamico via Mercado Pago (com confirmacao automatica)
      try {
        const pix = await createPixPayment(mpToken, pedido.total, `Pedido ${pedido.num} - Baguetalho`, pedido.id);
        session.payment_id = pix.payment_id;

        let msg = `Pedido *${pedido.num}* criado!\n\n`;
        msg += `*Pagamento via PIX:*\n\n`;
        msg += `Copie o codigo abaixo:\n\n`;
        msg += `\`${pix.qr_code}\`\n\n`;
        msg += `*Valor: ${fmtR(pedido.total)}*\n\n`;
        msg += `Apos o pagamento, confirmaremos automaticamente!\n`;
        msg += `Tempo estimado de entrega: ${agentCfg.tempo_medio || 45} minutos.`;
        replies.push(msg);

        // Atualizar pedido com payment_id
        await updateOrderPayment(estabUid, pedido.id, "pending");
      } catch (e) {
        // Fallback: PIX estatico
        const chavePix = agentCfg.chave_pix || config.cfg.pix_chave || "";
        if (chavePix) {
          const pixCode = generateStaticPix(chavePix, agentCfg.nome_restaurante || "Baguetalho", "Cidade", pedido.total, pedido.id.substring(0, 25));
          let msg = `Pedido *${pedido.num}* criado!\n\n`;
          msg += `*PIX Copia e Cola:*\n\n\`${pixCode}\`\n\n`;
          msg += `*Valor: ${fmtR(pedido.total)}*\n\n`;
          msg += `Apos pagar, envie o comprovante aqui para confirmarmos.`;
          replies.push(msg);
        } else {
          replies.push(`Pedido *${pedido.num}* criado! Total: ${fmtR(pedido.total)}\n\nEntre em contato para combinar o pagamento.`);
        }
      }
    } else {
      // Sem Mercado Pago — PIX estatico ou mensagem simples
      const chavePix = agentCfg.chave_pix || config.cfg.pix_chave || "";
      if (chavePix) {
        const pixCode = generateStaticPix(chavePix, agentCfg.nome_restaurante || "Baguetalho", "Cidade", pedido.total, pedido.id.substring(0, 25));
        let msg = `Pedido *${pedido.num}* criado!\n\n`;
        msg += `*PIX Copia e Cola:*\n\n\`${pixCode}\`\n\n`;
        msg += `*Valor: ${fmtR(pedido.total)}*\n\n`;
        msg += `Apos pagar, envie o comprovante aqui para confirmarmos.`;
        replies.push(msg);
      } else {
        replies.push(`Pedido *${pedido.num}* criado! Total: ${fmtR(pedido.total)}\n\nForma de pagamento sera combinada na entrega.`);
      }
    }

    session.state = "pagamento";

  } catch (e) {
    console.error("[Conversation] Erro ao criar pedido:", e);
    replies.push("Ocorreu um erro ao criar seu pedido. Por favor, tente novamente ou ligue para o restaurante.");
    session.state = "idle";
  }
}

async function handlePagamento(session, input, replies) {
  if (input.toLowerCase().includes("comprovante") || input === "pago" || input === "paguei") {
    replies.push(
      `Obrigado! Vamos verificar seu pagamento.\n` +
      `Se confirmado, voce recebera uma notificacao em instantes.\n\n` +
      `Pedido: *${session.order_num || ""}*\n` +
      `Obrigado pela preferencia!`
    );
    // Reset sessao
    Object.assign(session, newSession(session.phone));
  } else {
    replies.push(
      `Aguardando pagamento do pedido *${session.order_num || ""}*.\n\n` +
      `Ja pagou? Envie "paguei" ou o comprovante.\n` +
      `Para cancelar, digite 0.`
    );
  }
}

module.exports = { handleMessage, getSession, saveSession, newSession };
