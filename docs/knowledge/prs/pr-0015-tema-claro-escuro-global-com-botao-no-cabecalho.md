---
tipo: "pr"
numero: 15
titulo: "Tema claro/escuro global com botão no cabeçalho"
estado: "integrado"
url: "https://github.com/vichsort/treinamentoAlexArpaAgentes/pull/15"
data: "2026-11-11"
branch: "ajuste/tema-claro-escuro"
areas: ["cliente","visual"]
arquivos: ["client/index.html","client/src/App.jsx","client/src/Landing.jsx","client/src/componentes/AlternarTema.jsx","client/src/componentes/Icone.jsx","client/src/estilos.css","client/src/tema.js"]
palavras_chave: ["client","tema","escuro","cabecalho","landing","botao","chat","componentes"]
relacionados: []
---

# PR #15 — Tema claro/escuro global com botão no cabeçalho

## O que mudou
Não havia suporte a tema escuro nem opção para escolher.

- Botão de alternar (sol/lua) no cabeçalho global do app (todas as telas: quadros e atendimento) e no cabeçalho da landing.
- Escolha salva no navegador (`fluxo-tema`); sem escolha, segue a preferência do sistema. Script no `index.html` aplica o tema antes da primeira pintura (sem piscar).
- Tema escuro redefine só os tokens de cor (`:root[data-tema="escuro"]`); cores fixas do chat e dos botões viraram tokens.

Verificado no Chrome: alterna na landing, mantém no app e no chat, persiste após recarregar. `npm test` e `npm run build` ok.

## Arquivos alterados
- `client/index.html` (+9 −0)
- `client/src/App.jsx` (+4 −0)
- `client/src/Landing.jsx` (+2 −1)
- `client/src/componentes/AlternarTema.jsx` (+23 −0)
- `client/src/componentes/Icone.jsx` (+7 −0)
- `client/src/estilos.css` (+52 −12)
- `client/src/tema.js` (+27 −0)

## Quando consultar
Antes de mexer em: cliente, visual. Se o pedido envolve client, tema, escuro, cabecalho, comece por aqui e confira o código atual: esta nota descreve o que mudou naquele momento.
