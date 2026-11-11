// Regras puras do atendimento por Actions: origem, entrada do coordenador e validação do resultado.
// Tudo que vem do modelo é dado não confiável: só passa o que estas funções aceitam, fora do modelo.
import { timingSafeEqual } from "node:crypto";
import { assinar, resultPathDe } from "../server/src/github.js";

export const DESFECHOS = ["working", "code", "answered", "waiting-customer", "commercial", "human-review"];
export const AGENTES = ["coordenador", "n1", "comercial", "po", "desenvolvedor", "revisor"];
// Caminhos de produto da POLITICA-DE-AUTONOMIA. Fora daqui (workflows, banco, login, credenciais) o fluxo bloqueia.
const PERMITIDOS = [
  /^client\/src\/(TelaQuadro|Lista|Cartao)\.jsx$/,
  /^client\/src\/(ordem\.js|estilos\.css)$/,
  /^client\/src\/componentes\/[A-Za-z]+\.jsx$/,
  /^server\/src\/quadros\.js$/,
  /^client\/test\/ordem\.test\.js$/,
  /^server\/test\/quadros\.test\.js$/,
];
const MAX_EDICOES = 5;
const MAX_ARQUIVO = 100_000;
const MAX_PUBLICO = 600;
const SEGREDOS = /(sk-[\w-]{8,}|gh[pousr]_\w{10,}|github_pat_|api[_-]?key|authorization|bearer\s|AI_API_KEY|AGENT_LINK_SECRET|password|senha)/i;
const MARCADOR = /<!-- fluxo-request id=(app-[0-9a-f-]{36}) ticket=([0-9a-f-]{36}) resultPath=(\S+) sig=([0-9a-f]{64}) -->/;

export const caminhoPermitido = (p) => typeof p === "string" && !p.includes("..") && !p.includes("\\") && PERMITIDOS.some((re) => re.test(p));

/** Marcador do backend + pedido do cliente (texto citado) da issue. */
export function lerPedido(issue) {
  const m = MARCADOR.exec(issue.body ?? "");
  if (!m) return null;
  const pedido = (issue.body.split("### Pedido do cliente")[1] ?? "").trim().split("\n").map((l) => l.replace(/^> ?/, "")).join("\n").slice(0, 3000);
  return { requestId: m[1], ticketId: m[2], resultPath: m[3], sig: m[4], pedido };
}

/** A origem só vale se a assinatura bater com o segredo do backend e o resultPath for o esperado. */
export function origemValida(marcador, segredo) {
  if (!marcador || !segredo) return false;
  const esperada = Buffer.from(assinar(segredo, marcador.requestId, marcador.ticketId), "hex");
  const recebida = Buffer.from(marcador.sig, "hex");
  return marcador.requestId === `app-${marcador.ticketId}`
    && marcador.resultPath === resultPathDe(marcador.requestId)
    && esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}

/** Entrada do coordenador: só o necessário; o pedido do cliente vai como dado. */
export function montarEntrada({ repo, issue, marcador }) {
  return {
    requestId: marcador.requestId, resultPath: marcador.resultPath, repo, issue: issue.number,
    titulo: String(issue.title ?? "").slice(0, 200), pedido: marcador.pedido,
  };
}

/** Ensaio: resultado fictício do coordenador, sem consumir a API da IA. */
export const simularCoordenador = (entrada) => ({
  requestId: entrada.requestId, outcome: "answered",
  publicText: "(ensaio) Recebemos o seu pedido. Este é um resultado simulado, sem chamada à IA.",
  agents: ["n1"], allowedFiles: [], criteria: [], edits: [],
  updates: [{ id: "u1", agent: "n1", internalText: "Ensaio: resultado simulado.", publicText: "(ensaio) Estamos analisando o seu pedido." }],
});

const textoPublico = (t) => {
  const s = typeof t === "string" ? t.trim() : "";
  if (!s || s.length > MAX_PUBLICO) throw new Error("publicText vazio ou longo demais.");
  if (SEGREDOS.test(s)) throw new Error("publicText parece conter credencial ou instrução interna.");
  return s;
};

/** Devolve o resultado normalizado ou lança. Nunca confia no que o modelo disse sobre si mesmo. */
export function validarResultado(r, entrada) {
  if (!r || typeof r !== "object") throw new Error("Resultado não é um objeto.");
  if (r.requestId !== entrada.requestId) throw new Error("requestId diferente do pedido.");
  if (!DESFECHOS.includes(r.outcome)) throw new Error("outcome inválido.");
  const agents = Array.isArray(r.agents) ? r.agents : [];
  if (!agents.every((a) => AGENTES.includes(a))) throw new Error("agents contém nome desconhecido.");
  const updates = (Array.isArray(r.updates) ? r.updates : []).slice(0, 10).map((u) => {
    if (!/^[a-z0-9-]{1,40}$/.test(u?.id ?? "") || !AGENTES.includes(u.agent)) throw new Error("update inválido.");
    return { id: u.id, agent: u.agent, internalText: String(u.internalText ?? "").slice(0, 1500), publicText: textoPublico(u.publicText) };
  });
  if (new Set(updates.map((u) => u.id)).size !== updates.length) throw new Error("ids de update repetidos.");
  const base = { requestId: r.requestId, outcome: r.outcome, publicText: textoPublico(r.publicText), agents, updates };
  const allowedFiles = Array.isArray(r.allowedFiles) ? r.allowedFiles : [];
  const criteria = Array.isArray(r.criteria) ? r.criteria : [];
  const edits = Array.isArray(r.edits) ? r.edits : [];
  if (r.outcome !== "code") {
    if (allowedFiles.length || criteria.length || edits.length) throw new Error("Sem código, allowedFiles, criteria e edits ficam vazios.");
    return { ...base, allowedFiles: [], criteria: [], edits: [] };
  }
  if (!allowedFiles.length || allowedFiles.length > MAX_EDICOES || !allowedFiles.every(caminhoPermitido)) throw new Error("allowedFiles fora do escopo de produto.");
  if (!criteria.length || !criteria.every((c) => typeof c?.id === "string" && typeof c?.description === "string" && c.description.trim())) throw new Error("code exige critério com id e description.");
  if (!edits.length || edits.length > MAX_EDICOES) throw new Error("code exige de 1 a 5 edições.");
  for (const e of edits) {
    if (!allowedFiles.includes(e?.path) || typeof e.content !== "string" || e.content.length > MAX_ARQUIVO) throw new Error("edição fora de allowedFiles ou grande demais.");
  }
  return {
    ...base, allowedFiles,
    criteria: criteria.map((c) => ({ id: String(c.id).slice(0, 40), description: c.description.trim().slice(0, 300) })),
    edits: edits.map((e) => ({ path: e.path, content: e.content })),
  };
}
