---
tipo: "pr"
numero: 13
titulo: "N1 acompanha a issue em tempo real"
estado: "integrado"
url: "https://github.com/vichsort/treinamentoAlexArpaAgentes/pull/13"
data: "2026-11-11"
branch: "ajuste/n1-tempo-real"
areas: ["automação e agentes","cliente","visual","servidor"]
arquivos: ["automacao/controlador.mjs","client/src/Atendimento.jsx","client/src/api.js","client/src/estilos.css","server/src/tickets.js"]
palavras_chave: ["cada","aguardando","client","concluido","workflow","aprovacao","botao","controlador"]
relacionados: ["#12"]
---

# PR #13 — N1 acompanha a issue em tempo real

## O que mudou
Empilhado sobre o PR #12 (visual do chat); depois do merge dele, a base passa para a main.

**Problema:** o workflow só publicava o estado no fim e o app consultava a issue a cada 15 s, então as mensagens do N1 chegavam todas juntas.

- **Workflow:** cada marco real vira uma mensagem do N1 na hora, com ID estável (não duplica): início, resposta do coordenador, PR aberto, conferência ok/falhou, aguardando aprovação, pendência com a equipe, entrega.
- **Backend:** consulta a issue a cada 3 s por ticket enquanto a conversa está aberta e não concluída (antes 15 s); `GET /api/tickets/:id?sincronizar=1` força a leitura (mínimo 1 s). O ticket agora devolve `phase` e `issueNumber`.
- **Tela:** busca a cada 4 s só com a aba visível; botão **Atualizar** no topo e o texto "Issue #N · etapa" (Em análise, Conferindo a alteração, Aguardando aprovação, Concluído...).

Verificação: `npm test` (22) e `npm run build` ok. Simulei a issue evoluindo (início → PR → aguardando → concluído): as mensagens chegam uma a uma, duas buscas no intervalo não relêem o GitHub, o botão traz o marco na hora e, concluído, o app para de consultar. Conferi a barra do topo no Chrome. **Os novos marcos só aparecem de verdade depois do merge**, porque o workflow roda o controlador da main.

## Arquivos alterados
- `automacao/controlador.mjs` (+10 −8)
- `client/src/Atendimento.jsx` (+31 −1)
- `client/src/api.js` (+1 −1)
- `client/src/estilos.css` (+2 −0)
- `server/src/tickets.js` (+6 −6)

## Quando consultar
Antes de mexer em: automação e agentes, cliente, visual, servidor. Se o pedido envolve cada, aguardando, client, concluido, comece por aqui e confira o código atual: esta nota descreve o que mudou naquele momento.
