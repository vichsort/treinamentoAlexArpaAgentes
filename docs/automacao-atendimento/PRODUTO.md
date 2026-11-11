# Produto: Fluxo

Fluxo é um quadro de tarefas (estilo Trello) que roda no navegador, com API Node e banco SQLite local.

## O que o app faz

- **Quadros:** um por projeto. Criar, renomear e excluir pela barra lateral. Excluir apaga as listas e os cartões do quadro.
- **Listas:** colunas de um quadro, para as etapas do trabalho. Criar, renomear e excluir. Excluir apaga os cartões da lista.
- **Cartões:** título (até 200 caracteres) e descrição opcional (até 2000 pela tela). Criar, editar e excluir.
- **Mover cartões:** arrastando para outra lista ou posição, ou pelo menu do cartão em "Mover para".
- **Atendimento:** área na barra lateral onde o usuário abre tickets com título e descrição e conversa por mensagens. Tickets podem ser encerrados, reabertos e excluídos.

## Como usar

1. Abra o app (`npm run dev`, em http://127.0.0.1:5173) e entre em "Quadros" (`/quadro`).
2. Crie um quadro pelo botão "+" da barra lateral.
3. Crie listas dentro do quadro e adicione cartões em cada uma.
4. Para editar ou excluir, use o menu do cartão. Para mover, arraste ou use "Mover para".
5. Para pedir ajuda, clique em "Atendimento" na barra lateral e use "Novo ticket".

## O que o app não tem hoje

Tela de login, prazo ou data em cartões, etiquetas, anexos, compartilhamento entre pessoas e aplicativo de celular. Quem perguntar por isso recebe a resposta de que não existe ainda, sem promessa de data.
