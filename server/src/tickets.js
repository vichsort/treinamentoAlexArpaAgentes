// Tickets de atendimento: cada ticket é uma conversa (mensagens com role user | agent).
// Agentes autônomos responderão pela mesma API, gravando mensagens com role "agent" (ainda não implementado).
import { randomUUID } from "node:crypto";
import { invalido, naoEncontrado, texto } from "./http.js";
import { transacao } from "./db.js";
import { usuarioDaSessao } from "./auth.js";
import { abrirIssue, configGithub, montarIssue, requestIdDe } from "./github.js";

const STATUS = ["open", "closed"];
const saidaMensagem = (m) => ({ id: m.id, ticketId: m.ticket_id, role: m.role, content: m.content, createdAt: m.criado_em });
const saidaTicket = (t) => ({ id: t.id, title: t.title, status: t.status, createdAt: t.criado_em, updatedAt: t.atualizado_em });
const tituloDe = (conteudo) => {
  const linha = conteudo.split("\n")[0].trim();
  return linha.length > 60 ? `${linha.slice(0, 57).trimEnd()}…` : linha;
};

export function rotasDeTickets(app, db) {
  // Ticket com dono só é visível para o dono; sem dono (uso anônimo), qualquer um vê.
  const doDono = (t, req) => !t.dono_id || usuarioDaSessao(db, req)?.id === t.dono_id;
  const buscar = (id, req) => {
    const t = db.prepare("SELECT * FROM ticket WHERE id = ?").get(id);
    if (!t || !doDono(t, req)) throw naoEncontrado("Ticket");
    return t;
  };
  const inserirMensagem = (ticketId, role, content, agora) => {
    const m = { id: randomUUID(), ticket_id: ticketId, role, content, criado_em: agora };
    db.prepare("INSERT INTO ticket_mensagem (id, ticket_id, role, content, criado_em) VALUES (?, ?, ?, ?, ?)")
      .run(m.id, m.ticket_id, m.role, m.content, m.criado_em);
    db.prepare("UPDATE ticket SET atualizado_em = ? WHERE id = ?").run(agora, ticketId);
    return m;
  };

  /** Abre a issue origin:app do ticket e guarda o número. Em ensaio (AGENT_DRY_RUN) não chama o GitHub. Falha nunca reabre às cegas: o ticket fica na fase "erro-issue". */
  const encaminhar = async (ticket, descricao, gh) => {
    const gravar = (fase, issue = null) => db.prepare("UPDATE ticket SET fase = ?, issue_number = ? WHERE id = ?").run(fase, issue, ticket.id);
    if (gh.ensaio) return gravar("ensaio");
    try {
      gravar("issue-aberta", await abrirIssue(gh, montarIssue({ ticket, descricao }), requestIdDe(ticket.id)));
    } catch (e) {
      console.error("Falha ao abrir a issue:", e.message);
      gravar("erro-issue");
    }
  };

  app.get("/api/tickets", ({ req }) => ({
    tickets: db.prepare("SELECT * FROM ticket ORDER BY atualizado_em DESC, rowid DESC").all().filter((t) => doDono(t, req)).map(saidaTicket),
  }));

  // Abre um ticket já com a primeira mensagem do usuário; o título nasce dela, salvo `title` explícito.
  app.post("/api/tickets", async ({ corpo, req }) => {
    const content = texto(corpo, "message", { max: 5000 });
    const title = texto(corpo, "title", { max: 120, opcional: true }) ?? tituloDe(content);
    const agora = new Date().toISOString();
    const id = randomUUID();
    const gh = configGithub();
    const nativo = gh.ativo;
    const ticket = { id, title, status: "open", criado_em: agora, atualizado_em: agora, dono_id: usuarioDaSessao(db, req)?.id ?? null };
    const mensagens = transacao(db, () => {
      db.prepare("INSERT INTO ticket (id, title, status, criado_em, atualizado_em, dono_id, request_id, fase) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(ticket.id, ticket.title, ticket.status, ticket.criado_em, ticket.atualizado_em, ticket.dono_id, nativo ? requestIdDe(id) : null, nativo ? "recebido" : null);
      const doUsuario = inserirMensagem(ticket.id, "user", content, agora);
      // N1: resposta curta do atendimento; o trabalho de verdade segue pela issue.
      const n1 = nativo
        ? inserirMensagem(ticket.id, "agent", "Recebemos o seu ticket e já o encaminhamos para a nossa equipe. A resposta aparece aqui.", new Date().toISOString())
        : null;
      return n1 ? [doUsuario, n1] : [doUsuario];
    });
    if (nativo) await encaminhar(ticket, content, gh);
    return { ticket: saidaTicket(ticket), messages: mensagens.map(saidaMensagem) };
  });

  app.get("/api/tickets/:id", ({ params, req }) => {
    const ticket = buscar(params.id, req);
    const messages = db.prepare("SELECT * FROM ticket_mensagem WHERE ticket_id = ? ORDER BY criado_em, rowid").all(ticket.id).map(saidaMensagem);
    return { ticket: saidaTicket(ticket), messages };
  });

  app.patch("/api/tickets/:id", ({ params, corpo, req }) => {
    const ticket = buscar(params.id, req);
    const title = texto(corpo, "title", { max: 120, opcional: true }) ?? ticket.title;
    const status = corpo.status ?? ticket.status;
    if (!STATUS.includes(status)) throw invalido("status deve ser open ou closed.");
    db.prepare("UPDATE ticket SET title = ?, status = ? WHERE id = ?").run(title, status, ticket.id);
    return { ticket: saidaTicket(buscar(ticket.id, req)) };
  });

  app.delete("/api/tickets/:id", ({ params, req }) => {
    const ticket = buscar(params.id, req);
    db.prepare("DELETE FROM ticket WHERE id = ?").run(ticket.id); // mensagens caem em cascata
    return { ok: true };
  });

  app.post("/api/tickets/:id/messages", ({ params, corpo, req }) => {
    const ticket = buscar(params.id, req);
    if (ticket.status === "closed") throw invalido("Este ticket está encerrado. Reabra para enviar mensagens.");
    const content = texto(corpo, "content", { max: 5000 });
    const mensagem = inserirMensagem(ticket.id, "user", content, new Date().toISOString());
    return { message: saidaMensagem(mensagem) };
  });
}
