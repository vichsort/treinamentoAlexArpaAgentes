// Ponte com o GitHub para o atendimento nativo: cria a issue origin:app de um ticket.
// Credencial do backend (GITHUB_ISSUES_TOKEN) é diferente do COPILOT_AGENT_TOKEN, que só existe nas Actions.
const API = "https://api.github.com";

/** Lê a configuração do ambiente a cada chamada. Sem AGENT_RUNTIME=github-native, nada acontece. */
export function configGithub(env = process.env) {
  return {
    ativo: env.AGENT_RUNTIME === "github-native",
    ensaio: env.AGENT_DRY_RUN !== "false", // só "false" liga as chamadas reais
    repo: env.GITHUB_REPO ?? "",
    token: env.GITHUB_ISSUES_TOKEN ?? "",
  };
}

export const requestIdDe = (ticketId) => `app-${ticketId}`;
export const resultPathDe = (requestId) => `docs/automacao-atendimento/resultados/${requestId}.md`;

/** Resumo interno da issue. O marcador na primeira linha é o que o controlador das Actions lê. */
export function montarIssue({ ticket, descricao }) {
  const requestId = requestIdDe(ticket.id);
  const citado = descricao.split("\n").map((l) => `> ${l}`).join("\n");
  return {
    title: `[app] ${ticket.title}`,
    labels: ["origin:app"],
    body: [
      `<!-- fluxo-request id=${requestId} resultPath=${resultPathDe(requestId)} -->`,
      `**Origem:** app (ticket \`${ticket.id}\`)`,
      `**Dono:** ${ticket.dono_id ?? "anônimo"}`,
      "",
      "### Pedido do cliente",
      citado,
    ].join("\n"),
  };
}

async function github(config, metodo, caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      authorization: `Bearer ${config.token}`,
      ...(corpo ? { "content-type": "application/json" } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status}.`);
  return r.json();
}

/** Cria a issue, ou devolve a que já existe para o mesmo requestId (releitura antes de criar). */
export async function abrirIssue(config, issue, requestId) {
  const existentes = await github(config, "GET", `/repos/${config.repo}/issues?labels=origin:app&state=all&per_page=100`);
  const ja = existentes.find((i) => !i.pull_request && i.body?.includes(`fluxo-request id=${requestId} `));
  if (ja) return ja.number;
  return (await github(config, "POST", `/repos/${config.repo}/issues`, issue)).number;
}
