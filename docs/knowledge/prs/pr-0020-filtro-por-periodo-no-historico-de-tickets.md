---
tipo: "pr"
numero: 20
titulo: "Filtro por período no histórico de tickets"
estado: "integrado"
url: "https://github.com/vichsort/treinamentoAlexArpaAgentes/pull/20"
data: "2026-11-11"
branch: "ajuste/filtro-periodo-tickets"
areas: ["cliente","visual"]
arquivos: ["client/src/Atendimento.jsx","client/src/estilos.css","client/src/periodos.js","client/test/periodos.test.js"]
palavras_chave: ["client","periodos","dias","tickets","historico","hoje","ontem","opcoes"]
relacionados: ["#18"]
---

# PR #20 — Filtro por período no histórico de tickets

## O que mudou
Pedido da issue #18 ("Crie opções para filtrar por períodos dos tickets"), que o workflow não implementou porque roda em ensaio (sem chave de IA).

- Opções acima do histórico: Todos, Hoje, Ontem, 7 dias e 30 dias (filtra pela última atualização do ticket, em dias de calendário). Mantém o agrupamento por data; sem resultado mostra "Nenhum ticket neste período.".
- Lógica isolada em `client/src/periodos.js`, com testes (29 passando). Build ok.
- Conferido no Chrome: 9 tickets em Todos, 8 em Hoje, 1 em Ontem.

Closes #18

## Arquivos alterados
- `client/src/Atendimento.jsx` (+12 −6)
- `client/src/estilos.css` (+6 −0)
- `client/src/periodos.js` (+24 −0)
- `client/test/periodos.test.js` (+24 −0)

## Quando consultar
Antes de mexer em: cliente, visual. Se o pedido envolve client, periodos, dias, tickets, comece por aqui e confira o código atual: esta nota descreve o que mudou naquele momento.
