// Tickets de atendimento: cada ticket é uma conversa (mensagens com role user | agent).
// Mensagens com role "agent" só entram pelo estado publicado pelo workflow (importarEstado): o app nunca simula resposta.
import { randomUUID } from "node:crypto";
import { invalido, naoEncontrado, texto } from "./http.js";
import { transacao } from "./db.js";
import { usuarioDaSessao } from "./auth.js";
import { abrirIssue, configGithub, dispararWorkflow, lerEstado, montarIssue, requestIdDe } from "./github.js";

const STATUS = ["open", "closed"];
const saidaMensagem = (m) => ({ id: m.id, ticketId: m.ticket_id, role: m.role, content: m.content, createdAt: m.criado_em });
const saidaTicket = (t) => ({ id: t.id, title: t.title, status: t.status, createdAt: t.criado_em, updatedAt: t.atualizado_em, phase: t.fase ?? null, issueNumber: t.issue_number ?? null });
const FASES_FINAIS = new Set(["concluido"]);
const MAX_PUBLICO = 600;

const gravarMensagem = (db, ticketId, role, content, agora) => {
  const m = { id: randomUUID(), ticket_id: ticketId, role, content, criado_em: agora };
  db.prepare("INSERT INTO ticket_mensagem (id, ticket_id, role, content, criado_em) VALUES (?, ?, ?, ?, ?)")
    .run(m.id, m.ticket_id, m.role, m.content, m.criado_em);
  db.prepare("UPDATE ticket SET atualizado_em = ? WHERE id = ?").run(agora, ticketId);
  return m;
};

/** Traz o estado publicado pelo workflow para o app: cada mensagem pública entra uma única vez (ids em msgs_ids). */
export function importarEstado(db, ticket, estado) {
  if (!estado || estado.requestId !== ticket.request_id) return 0;
  const ja = new Set(JSON.parse(ticket.msgs_ids ?? "[]"));
  const candidatas = [...(Array.isArray(estado.publicUpdates) ? estado.publicUpdates : []), { id: "final", publicText: estado.publicText }];
  const novas = candidatas.filter((u) => /^[a-z0-9-]{1,40}$/.test(u?.id ?? "") && !ja.has(u.id)
    && typeof u.publicText === "string" && u.publicText.trim() && u.publicText.length <= MAX_PUBLICO);
  transacao(db, () => {
    novas.forEach((u) => { gravarMensagem(db, ticket.id, "agent", u.publicText.trim(), new Date().toISOString()); ja.add(u.id); });
    db.prepare("UPDATE ticket SET fase = ?, pr_number = ?, run_id = ?, msgs_ids = ? WHERE id = ?")
      .run(String(estado.fase ?? ticket.fase).slice(0, 30), Number.isInteger(estado.pr) ? estado.pr : ticket.pr_number, estado.run ? String(estado.run).slice(0, 30) : ticket.run_id, JSON.stringify([...ja]), ticket.id);
  });
  return novas.length;
}

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
  const inserirMensagem = (...args) => gravarMensagem(db, ...args);
  const ultimaConsulta = new Map();

  /** Abre a issue origin:app do ticket, guarda o número e dispara o workflow. Em ensaio (AGENT_DRY_RUN) não chama o GitHub. Falha nunca repete às cegas: o ticket fica em "erro-issue". */
  const encaminhar = async (ticket, descricao, gh) => {
    const gravar = (fase, issue = null) => db.prepare("UPDATE ticket SET fase = ?, issue_number = ? WHERE id = ?").run(fase, issue, ticket.id);
    if (gh.ensaio) return gravar("ensaio");
    try {
      if (!gh.segredo) throw new Error("AGENT_LINK_SECRET não definido.");
      const numero = await abrirIssue(gh, montarIssue({ ticket, descricao, segredo: gh.segredo }), requestIdDe(ticket.id));
      gravar("issue-aberta", numero);
      // O evento da issue pode não chegar a disparar o workflow; o dispatch explícito garante o início.
      await dispararWorkflow(gh, numero).catch((e) => console.error("Dispatch falhou (rode o workflow à mão):", e.message));
    } catch (e) {
      console.error("Falha ao abrir a issue:", e.message);
      gravar("erro-issue");
    }
  };

  /** Consulta simples ao GitHub (a cada 3 s por ticket; o botão Atualizar força, no mínimo 1 s) até o workflow chegar a uma fase final. */
  const reconciliar = async (ticket, forcar = false) => {
    const gh = configGithub();
    if (!gh.ativo || gh.ensaio || !ticket.issue_number || FASES_FINAIS.has(ticket.fase)) return;
    if (Date.now() - (ultimaConsulta.get(ticket.id) ?? 0) < (forcar ? 1_000 : 3_000)) return;
    ultimaConsulta.set(ticket.id, Date.now());
    try { importarEstado(db, ticket, await lerEstado(gh, ticket.issue_number)); }
    catch (e) { console.error("Reconciliação falhou:", e.message); }
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
      // Sem resposta pronta: a primeira mensagem do atendimento só entra quando o agente N1 analisa o pedido (pela issue).
      return [doUsuario];
    });
    if (nativo) await encaminhar(ticket, content, gh);
    return { ticket: saidaTicket(ticket), messages: mensagens.map(saidaMensagem) };
  });

  app.get("/api/tickets/:id", async ({ params, req, url }) => {
    await reconciliar(buscar(params.id, req), url.searchParams.get("sincronizar") === "1");
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
