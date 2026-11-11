---
tipo: "pr"
numero: 10
titulo: "Etapa 04: CI mínimo e conferência do build do PR gerado"
estado: "integrado"
url: "https://github.com/vichsort/treinamentoAlexArpaAgentes/pull/10"
data: "2026-11-11"
branch: "etapa-04-validacao"
areas: ["automação e agentes","documentação"]
arquivos: [".github/agents/desenvolvedor.agent.md",".github/agents/revisor.agent.md",".github/workflows/ai-agents.yml",".github/workflows/ci.yml","automacao/controlador.mjs","docs/automacao-atendimento/PROGRESSO.md"]
palavras_chave: ["build","github","agents","workflows","agent","automacao","conferencia","desenvolvedor"]
relacionados: []
---

# PR #10 — Etapa 04: CI mínimo e conferência do build do PR gerado

## O que mudou
- Novo `ci.yml`: `npm ci` + `npm run build` + `npm test` em PR e na main (leitura apenas, sem segredos).
- `ai-agents.yml`: novo job `registrar-build` confere origem do PR (bot, branch `ai/<requestId>`, mesmo repositório), build do commit atual e comenta o resultado; não executa o candidato.
- Agentes Desenvolvedor e Revisor: conferência única no app e parecer em uma frase.
- `PROGRESSO.md` atualizado.

Verificação local: `npm ci`, `npm run build`, `npm test` (22). Os workflows novos só rodam de verdade no GitHub; o CI roda neste PR.

## Arquivos alterados
- `.github/agents/desenvolvedor.agent.md` (+1 −1)
- `.github/agents/revisor.agent.md` (+1 −1)
- `.github/workflows/ai-agents.yml` (+25 −0)
- `.github/workflows/ci.yml` (+26 −0)
- `automacao/controlador.mjs` (+15 −0)
- `docs/automacao-atendimento/PROGRESSO.md` (+9 −0)

## Quando consultar
Antes de mexer em: automação e agentes, documentação. Se o pedido envolve build, github, agents, workflows, comece por aqui e confira o código atual: esta nota descreve o que mudou naquele momento.
