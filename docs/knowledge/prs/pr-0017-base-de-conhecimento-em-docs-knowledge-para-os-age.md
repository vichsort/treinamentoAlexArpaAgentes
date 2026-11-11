---
tipo: "pr"
numero: 17
titulo: "Base de conhecimento em docs/knowledge para os agentes"
estado: "integrado"
url: "https://github.com/vichsort/treinamentoAlexArpaAgentes/pull/17"
data: "2026-11-11"
branch: "ajuste/base-de-conhecimento"
areas: ["automação e agentes","documentação","servidor"]
arquivos: [".github/agents/banco-de-dados.agent.md",".github/agents/comercial.agent.md",".github/agents/coordenador.agent.md",".github/agents/desenvolvedor.agent.md",".github/agents/n1.agent.md",".github/agents/po.agent.md",".github/agents/revisor.agent.md",".github/workflows/conhecimento.yml","automacao/chamar-ia.mjs","automacao/conhecimento-lib.mjs","automacao/conhecimento.mjs","docs/knowledge/INDEX.md","docs/knowledge/README.md","docs/knowledge/issues/issue-0004-app-falta-de-caf.md","docs/knowledge/issues/issue-0014-app-sugestao-de-poder-escolher-entre-metodo-escuro.md","docs/knowledge/prs/pr-0007-troca-o-rotulo-do-botao-para-novo-ticket.md","docs/knowledge/prs/pr-0009-troca-o-rotulo-do-botao-para-abrir-ticket.md","docs/knowledge/prs/pr-0010-etapa-04-ci-minimo-e-conferencia-do-build-do-pr-ge.md","docs/knowledge/prs/pr-0011-etapa-05-entrega-da-resposta-merge-opcional-e-reto.md","docs/knowledge/prs/pr-0012-atendimento-com-visual-de-chat-no-estilo-do-chatgp.md","docs/knowledge/prs/pr-0013-n1-acompanha-a-issue-em-tempo-real.md","docs/knowledge/prs/pr-0015-tema-claro-escuro-global-com-botao-no-cabecalho.md","docs/knowledge/prs/pr-0016-resposta-do-atendimento-so-vem-do-agente-de-verdad.md","server/test/conhecimento.test.js"]
palavras_chave: ["docs","knowledge","conhecimento","github","agents","agent","automacao","issues"]
relacionados: ["#7","#9","#13","#15","#16","#4","#14"]
---

# PR #17 — Base de conhecimento em docs/knowledge para os agentes

## O que mudou
Cada PR integrado e cada issue fechada passa a gerar uma entrada de conhecimento (Markdown com frontmatter) dentro do projeto, e os agentes consultam essa base antes de trabalhar.

- **Estrutura:** `docs/knowledge/` com `README.md` (regras), `INDEX.md` (índice gerado), `prs/` e `issues/`. Frontmatter: tipo, número, título, data, áreas, arquivos, palavras-chave, relacionados (PR) e origem, fase final, PR relacionado (issue).
- **Geração:** `automacao/conhecimento.mjs` (+ `conhecimento-lib.mjs`) lê PR/issue pela API, filtra credenciais e marcadores de controle e regrava a entrada sem duplicar. Workflow `conhecimento.yml` roda ao integrar PR ou fechar issue e grava na main (usa `pull_request_target` sem executar código do PR).
- **Consulta:** o passo de IA (`chamar-ia.mjs`) recebe o índice e as 3 entradas mais parecidas com o pedido como referência histórica (não instrução); os 7 agentes (`.github/agents`) foram instruídos a consultar antes de trabalhar.
- **Retroativo:** já geradas as 8 PRs integrados (#7, #9–#13, #15, #16) e as 2 issues fechadas (#4, #14).
- Testes novos (`server/test/conhecimento.test.js`): 27 passando; build ok.

Limites: o texto das entradas vem do que está na descrição do PR/issue (não é resumo por IA); se a main ganhar proteção de branch, o bot precisará de permissão para gravar.

## Arquivos alterados
- `.github/agents/banco-de-dados.agent.md` (+2 −0)
- `.github/agents/comercial.agent.md` (+2 −0)
- `.github/agents/coordenador.agent.md` (+2 −0)
- `.github/agents/desenvolvedor.agent.md` (+2 −0)
- `.github/agents/n1.agent.md` (+2 −0)
- `.github/agents/po.agent.md` (+2 −0)
- `.github/agents/revisor.agent.md` (+2 −0)
- `.github/workflows/conhecimento.yml` (+48 −0)
- `automacao/chamar-ia.mjs` (+8 −0)
- `automacao/conhecimento-lib.mjs` (+160 −0)
- `automacao/conhecimento.mjs` (+56 −0)
- `docs/knowledge/INDEX.md` (+16 −0)
- `docs/knowledge/README.md` (+37 −0)
- `docs/knowledge/issues/issue-0004-app-falta-de-caf.md` (+28 −0)
- `docs/knowledge/issues/issue-0014-app-sugestao-de-poder-escolher-entre-metodo-escuro.md` (+28 −0)
- `docs/knowledge/prs/pr-0007-troca-o-rotulo-do-botao-para-novo-ticket.md` (+28 −0)
- `docs/knowledge/prs/pr-0009-troca-o-rotulo-do-botao-para-abrir-ticket.md` (+26 −0)
- `docs/knowledge/prs/pr-0010-etapa-04-ci-minimo-e-conferencia-do-build-do-pr-ge.md` (+34 −0)
- `docs/knowledge/prs/pr-0011-etapa-05-entrega-da-resposta-merge-opcional-e-reto.md` (+36 −0)
- `docs/knowledge/prs/pr-0012-atendimento-com-visual-de-chat-no-estilo-do-chatgp.md` (+31 −0)
- `docs/knowledge/prs/pr-0013-n1-acompanha-a-issue-em-tempo-real.md` (+36 −0)
- `docs/knowledge/prs/pr-0015-tema-claro-escuro-global-com-botao-no-cabecalho.md` (+36 −0)
- `docs/knowledge/prs/pr-0016-resposta-do-atendimento-so-vem-do-agente-de-verdad.md` (+31 −0)
- `server/test/conhecimento.test.js` (+57 −0)

## Quando consultar
Antes de mexer em: automação e agentes, documentação, servidor. Se o pedido envolve docs, knowledge, conhecimento, github, comece por aqui e confira o código atual: esta nota descreve o que mudou naquele momento.
