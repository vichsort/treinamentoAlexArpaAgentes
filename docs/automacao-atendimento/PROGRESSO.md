# Progresso: automação de atendimento

## Etapa 00: preparar o projeto e o acesso

- **Cópia local:** `C:\App-Fluxo-Tarefas-V1` (reutilizada, sem novo clone)
- **URL da minha cópia (remote `treinamento`):** https://github.com/vichsort/treinamentoAlexArpaAgentes
- **Original do professor (remote `origin`, intocado):** https://github.com/bittencourtthulio/App-Fluxo-Tarefas-V1.git
- **Node:** v24.22.0 (o projeto exige >= 22.13.0); npm 11.19.1
- **Instalar dependências:** `npm install`
- **Abrir o app:** `npm run dev` (interface http://127.0.0.1:5173, API http://127.0.0.1:3001/api)
- **Build:** `npm run build` → concluído com sucesso (vite, `dist/`)
- **Dados locais:** SQLite em `server/dados` preservado (ignorado pelo git)
- **Actions:** habilitadas no repositório da cópia (`allowed_actions: all`); visibilidade pública, não alterada

## Pendências

- **GitHub Copilot cloud agent:** não confirmado; o token do `gh` não tem escopo para ler o plano da conta, então falta verificar em github.com/settings/copilot se há plano pago.
- **Secret `COPILOT_AGENT_TOKEN`:** ainda não criado. Deve ficar nas Actions, separado de qualquer credencial local do backend. Nenhum valor foi registrado aqui.

## Etapa 04: validar código e regressão

- **CI mínimo:** `.github/workflows/ci.yml` roda em PR e na `main`: `npm ci` (lockfile), `npm run build` e `npm test`, só com permissão de leitura e sem segredos. Antes não havia CI.
- **Build do código gerado:** no `ai-agents.yml`, o job `construir` compila o commit do PR sem segredos. O novo job `registrar-build` (main confiável, `GITHUB_TOKEN`) confere a origem do PR (bot, branch `ai/<requestId>`, mesmo repositório), que o build é do commit atual e comenta o resultado no PR. Não executa o candidato.
- **Critério:** `{id, description}`; sem teste novo nem prova independente.
- **Agentes:** Desenvolvedor confere o comportamento uma vez no app (e avisa se não conseguiu abrir); Revisor registra em uma frase se o diff atende.
- **Executado localmente:** `npm ci`, `npm run build` e `npm test` (22 testes) com sucesso.
- **Conferência no app:** esta etapa não muda a interface, então não há conferência visual.
