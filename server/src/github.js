// Ponte com o GitHub para o atendimento por Actions: cria a issue origin:app de um ticket, dispara o
// workflow e lê o estado que o workflow deixa num comentário de controle. Credencial do backend
// (GITHUB_ISSUES_TOKEN) nunca é o GITHUB_TOKEN efêmero das Actions.
import { createHmac } from "node:crypto";

const API = "https://api.github.com";
export const WORKFLOW = "ai-agents.yml";
export const ESTADO = "<!-- ai-agents:state";
const BOT = "github-actions[bot]";

/** Lê a configuração do ambiente a cada chamada. Sem AGENT_RUNTIME=github-actions, nada acontece. */
export function configGithub(env = process.env) {
  return {
    ativo: env.AGENT_RUNTIME === "github-actions",
    ensaio: env.AGENT_DRY_RUN !== "false", // só "false" liga as chamadas reais
    repo: env.GITHUB_REPO ?? "",
    token: env.GITHUB_ISSUES_TOKEN ?? "",
    segredo: env.AGENT_LINK_SECRET ?? "", // o mesmo valor existe nos Secrets das Actions
  };
}

export const requestIdDe = (ticketId) => `app-${ticketId}`;
export const resultPathDe = (requestId) => `docs/automacao-atendimento/resultados/${requestId}.md`;
/** Assinatura que prova que a issue nasceu no backend: a label origin:app sozinha qualquer um aplica. */
export const assinar = (segredo, requestId, ticketId) =>
  createHmac("sha256", segredo).update(`${requestId}:${ticketId}`).digest("hex");

/** Resumo interno da issue. O marcador na primeira linha é o vínculo que o workflow valida. */
export function montarIssue({ ticket, descricao, segredo }) {
  const requestId = requestIdDe(ticket.id);
  const citado = descricao.split("\n").map((l) => `> ${l}`).join("\n");
  return {
    title: `[app] ${ticket.title}`,
    labels: ["origin:app"],
    body: [
      `<!-- fluxo-request id=${requestId} ticket=${ticket.id} resultPath=${resultPathDe(requestId)} sig=${assinar(segredo, requestId, ticket.id)} -->`,
      `**Origem:** app (ticket \`${ticket.id}\`)`,
      `**Dono:** ${ticket.dono_id ?? "anônimo"}`,
      "",
      "### Pedido do cliente",
      citado,
    ].join("\n"),
  };
}

export async function pedirGithub(token, metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      authorization: `Bearer ${token}`,
      ...(corpo ? { "content-type": "application/json" } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status} em ${metodo} ${caminho.split("?")[0]}.`);
  return r.status === 204 ? null : r.json();
}

/** Cria a issue, ou devolve a que já existe para o mesmo requestId (releitura antes de criar). */
export async function abrirIssue(config, issue, requestId) {
  const existentes = await pedirGithub(config.token, "GET", `/repos/${config.repo}/issues?labels=origin:app&state=all&per_page=100`);
  const ja = existentes.find((i) => !i.pull_request && i.body?.includes(`fluxo-request id=${requestId} `));
  if (ja) return ja.number;
  return (await pedirGithub(config.token, "POST", `/repos/${config.repo}/issues`, issue)).number;
}

/** Dispara o workflow de forma explícita: não depende de o GitHub emitir o evento da issue. */
export const dispararWorkflow = (config, issue) =>
  pedirGithub(config.token, "POST", `/repos/${config.repo}/actions/workflows/${WORKFLOW}/dispatches`, { ref: "main", inputs: { issue: String(issue) } });

/** JSON seguro dentro de um comentário HTML: `<` e `>` viram escapes, então "-->" nunca fecha o comentário. */
export const codificarEstado = (estado) =>
  `${ESTADO} ${JSON.stringify(estado).replace(/</g, "\u003c").replace(/>/g, "\u003e")} -->`;

/** Último comentário de controle escrito pelo bot das Actions. Comentário de cliente com o mesmo marcador é ignorado. */
export function estadoDosComentarios(comentarios) {
  for (const c of [...comentarios].reverse()) {
    if (c.user?.login !== BOT || !c.body?.startsWith(ESTADO)) continue;
    const m = /^<!-- ai-agents:state (\{.*\}) -->/.exec(c.body);
    try { if (m) return { estado: JSON.parse(m[1]), comentarioId: c.id }; } catch { /* comentário corrompido: ignora */ }
  }
  return null;
}

/** Consulta simples do backend ao GitHub: traz o estado mais recente da issue. */
export async function lerEstado(config, issue) {
  const comentarios = await pedirGithub(config.token, "GET", `/repos/${config.repo}/issues/${issue}/comments?per_page=100`);
  return estadoDosComentarios(comentarios)?.estado ?? null;
}
