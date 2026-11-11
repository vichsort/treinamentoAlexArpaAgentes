---
tipo: "pr"
numero: 11
titulo: "Etapa 05: entrega da resposta, merge opcional e retomadas"
estado: "integrado"
url: "https://github.com/vichsort/treinamentoAlexArpaAgentes/pull/11"
data: "2026-11-11"
branch: "etapa-05-entrega"
areas: ["automação e agentes","documentação"]
arquivos: [".github/workflows/ai-agents.yml","automacao/chamar-ia.mjs","automacao/contrato.mjs","automacao/controlador.mjs","docs/automacao-atendimento/PROGRESSO.md"]
palavras_chave: ["merge","automacao","entrega","build","github","auto","branch","depois"]
relacionados: ["#10"]
---

# PR #11 — Etapa 05: entrega da resposta, merge opcional e retomadas

## O que mudou
Empilhado sobre o PR #10 (Etapa 04); depois do merge dele, esta base passa para a main.

- Build verde do commit atual → `AUTO_MERGE=false` deixa o PR para demonstração; `true` integra (squash, sha travado, sem bypass das regras da branch).
- Merge confirmado → mensagem do N1 com ID estável `entrega`, issue fechada, fase `concluido`. PR usa `ref. #n`, não fecha a issue sozinho.
- Dúvida respondida fecha a issue; esclarecimento pendente e human-review mantêm aberta.
- Build falho → uma rodada de correção no mesmo PR; depois disso, `pendente-instrutor`.
- Retomada: `workflow_dispatch` com `retomar=true` repete só resposta/fechamento; merge manual também dispara a entrega.

Verificação: `npm test` (22) e `npm run build` ok; entrega simulada com GitHub falso (merge manual, auto-merge, branch protegida, falha ao fechar + retomada, mensagem única no app). Os jobs só rodam de verdade no GitHub.

## Arquivos alterados
- `.github/workflows/ai-agents.yml` (+41 −5)
- `automacao/chamar-ia.mjs` (+6 −4)
- `automacao/contrato.mjs` (+1 −0)
- `automacao/controlador.mjs` (+123 −19)
- `docs/automacao-atendimento/PROGRESSO.md` (+8 −0)

## Quando consultar
Antes de mexer em: automação e agentes, documentação. Se o pedido envolve merge, automacao, entrega, build, comece por aqui e confira o código atual: esta nota descreve o que mudou naquele momento.
