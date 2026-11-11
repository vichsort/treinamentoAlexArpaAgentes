---
tipo: "pr"
numero: 16
titulo: "Resposta do atendimento só vem do agente de verdade"
estado: "integrado"
url: "https://github.com/vichsort/treinamentoAlexArpaAgentes/pull/16"
data: "2026-11-11"
branch: "ajuste/resposta-real-do-agente"
areas: ["automação e agentes","servidor"]
arquivos: ["automacao/controlador.mjs","server/src/tickets.js"]
palavras_chave: ["agente","abrir","atendimento","chat","mensagem","pedido","resposta","workflow"]
relacionados: []
---

# PR #16 — Resposta do atendimento só vem do agente de verdade

## O que mudou
Ao abrir um ticket o app gravava na hora "Recebemos o seu ticket…" e o workflow publicava "Seu pedido chegou à equipe…" antes de qualquer análise. Eram textos fixos, não de um agente.

- App: não grava mais resposta de agente ao abrir o ticket (o chat mostra o indicador de digitando até chegar algo).
- Workflow: removida a mensagem fixa de início; a fase "iniciado" continua aparecendo no topo do chat.
- A primeira mensagem do atendimento agora é a redigida pelo N1 (IA) após analisar o pedido.

Mantidos os avisos de marco (PR aberto, conferência, aguardando aprovação, entrega), que descrevem eventos reais do processo. `npm test` ok (22).

## Arquivos alterados
- `automacao/controlador.mjs` (+1 −1)
- `server/src/tickets.js` (+3 −6)

## Quando consultar
Antes de mexer em: automação e agentes, servidor. Se o pedido envolve agente, abrir, atendimento, chat, comece por aqui e confira o código atual: esta nota descreve o que mudou naquele momento.
