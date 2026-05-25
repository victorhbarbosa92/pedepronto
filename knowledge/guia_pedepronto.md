# PedePronto PDV — Guia Completo do Sistema

## O que e o PedePronto?
Sistema PDV (Ponto de Venda) completo para bares, restaurantes e lanchonetes brasileiros.
Funciona como PWA (Progressive Web App) — roda no navegador, funciona offline, pode ser instalado no celular.

## Modulos Principais

### 1. Inicio (Dashboard)
- Visao geral: pedidos em aberto, faturamento do dia, ticket medio
- Botoes rapidos: Mesas, Balcao, Delivery, Producao
- Coach IA: briefing diario de marketing com dicas personalizadas
- Status do caixa (aberto/fechado)

### 2. Mesas
- Mapa visual de mesas com status (livre/ocupada/pedindo)
- Abrir comanda por mesa
- Transferir mesa, juntar mesas
- Adicionar itens do cardapio a comanda
- Fechar mesa (pagamento)

### 3. Balcao
- Pedidos rapidos sem mesa
- Busca de cliente (CRM auto-capture)
- Numeracao automatica (ex: #001, #002)
- Ideal para lanches rapidos, cafes

### 4. Delivery
- Pedidos com endereco de entrega
- Campos: nome, telefone, endereco, complemento
- Taxa de entrega configuravel
- Integracao com WhatsApp para envio de via

### 5. Producao (KDS - Kitchen Display System)
- Tela para cozinha e bar separados
- Pedidos aparecem em tempo real
- Clicar no item marca como "pronto"
- Quando todos os itens prontos, pedido vai para entrega

### 6. Cardapio
- Cadastro de produtos (nome, preco, categoria, descricao, foto)
- Gerenciamento de categorias
- Ativar/desativar produtos
- Ordenacao customizada
- Produtos com variantes/adicionais

### 7. Clientes (CRM)
- Auto-capture: cliente e cadastrado automaticamente ao fazer pedido
- Scoring: pontuacao baseada em frequencia + valor + recencia
- Segmentacao: VIP (200+pts), Frequente (100+), Regular (50+), Novo
- Historico de pedidos por cliente
- Campos: nome, telefone, email, aniversario, endereco
- Exportar lista de clientes

### 8. Caixa
- Abertura com valor inicial
- Sangrias e suprimentos
- Fechamento com resumo por forma de pagamento
- Formas: Dinheiro, PIX, Debito, Credito, VR/VA
- Historico de caixas anteriores

### 9. Dados / Relatorios
- KPIs do dia: faturamento, ticket medio, pedidos por tipo
- Vendas por categoria (grafico de barras)
- Formas de pagamento
- Mesas ocupadas vs disponiveis
- Comparativo com dias anteriores

### 10. Funcionarios
- Convite por link (compartilhar via WhatsApp)
- Cargos: Dono, Gerente, Caixa, Garcom, Cozinheiro
- Permissoes por cargo (PDV, caixa, cardapio, dados, config)
- Login independente por funcionario

### 11. Agente IA (Coach)
- Briefing diario de marketing automatico
- Sugestao de combos baseada em top sellers
- Campanhas de WhatsApp prontas
- Analise de tendencias
- Chat livre: pergunte qualquer coisa sobre o negocio ou o sistema
- Memoria: salva interacoes no Firestore para contexto futuro

### 12. Configuracoes
- Nome e dados do estabelecimento
- Tema (claro/escuro)
- Impressora termica (58mm/80mm, Bluetooth/USB)
- Maquininha (Stone, PagSeguro, Rede)
- CRM & Fidelidade (cashback, recompensas)
- Totem digital
- PWA / instalacao

## Fluxo Tipico de Uso Diario

1. Abrir o app
2. Abrir caixa (informar troco inicial)
3. Receber pedidos (mesa/balcao/delivery)
4. Cozinha prepara (tela Producao)
5. Entregar e fechar pedido (pagamento)
6. Ver briefing do Coach IA
7. Fechar caixa no fim do turno

## Dicas de Marketing (para o Coach IA usar)

### Estrategias de Upsell
- Sugerir sobremesa apos prato principal
- Combo: prato + bebida com desconto
- Programa de fidelidade: a cada X pedidos, ganhe Y

### Retencao de Clientes
- Enviar mensagem para inativos (30+ dias)
- Campanha de aniversario (desconto no dia)
- Happy hour em dias fracos

### Aumento de Ticket Medio
- Combos bem precificados (20-30% desconto vs individual)
- Adicionais (queijo extra, bacon, etc)
- Programa de pontos com recompensas atrativas

## Termos do Sistema
- **Comanda**: lista de itens de um pedido/mesa
- **KDS**: Kitchen Display System (tela da cozinha)
- **Sangria**: retirada de dinheiro do caixa durante o turno
- **Suprimento**: entrada de dinheiro no caixa durante o turno
- **Via**: comprovante do pedido enviado ao cliente
- **CRM**: Customer Relationship Management (gestao de clientes)
- **Coach IA**: assistente de marketing com inteligencia artificial
- **Totem**: tela de autoatendimento para o cliente fazer pedido
