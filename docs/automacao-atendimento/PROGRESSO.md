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
