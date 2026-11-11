// Gera a base de conhecimento (docs/knowledge) a partir do GitHub.
// Uso: node automacao/conhecimento.mjs pr <n> | issue <n> | tudo      (GITHUB_TOKEN e GITHUB_REPOSITORY no ambiente)
// Só lê metadados e texto de PRs/issues como dado; nunca baixa nem executa o código do PR.
import { entradaDeIssue, entradaDePR, gravarEntrada, reescreverIndice } from "./conhecimento-lib.mjs";

const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env;
if (!token || !repo) throw new Error("Defina GITHUB_TOKEN e GITHUB_REPOSITORY.");

const gh = async (caminho, tentativa = 1) => {
  const r = await fetch(`https://api.github.com/repos/${repo}${caminho}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "fluxo-conhecimento" },
    signal: AbortSignal.timeout(30_000),
  });
  // Falha do lado do GitHub (5xx) costuma passar sozinha: até 3 tentativas, depois desiste de forma explícita.
  if (r.status >= 500 && tentativa < 3) { await new Promise((ok) => setTimeout(ok, 2_000 * tentativa)); return gh(caminho, tentativa + 1); }
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status} em ${caminho}`);
  return r.json();
};
const todos = async (caminho) => {
  const saida = [];
  for (let p = 1; p <= 10; p++) {
    const lote = await gh(`${caminho}${caminho.includes("?") ? "&" : "?"}per_page=100&page=${p}`);
    saida.push(...lote);
    if (lote.length < 100) break;
  }
  return saida;
};

const doPR = async (numero) => {
  const pr = await gh(`/pulls/${numero}`);
  if (!pr.merged_at) { console.log(`PR #${numero} fechado sem merge: nada a registrar.`); return; }
  console.log("gravado:", gravarEntrada(entradaDePR(pr, await todos(`/pulls/${numero}/files`))));
};

const doIssue = async (numero) => {
  const issue = await gh(`/issues/${numero}`);
  if (issue.pull_request) return;
  if (issue.state !== "closed") { console.log(`Issue #${numero} ainda aberta.`); return; }
  // O estado do atendimento só vale se vier do bot das Actions (comentário de cliente com o mesmo marcador é ignorado).
  const comentarios = (await todos(`/issues/${numero}/comments`)).filter((c) => c.user?.login === "github-actions[bot]");
  let estado = null;
  for (const c of comentarios) {
    const m = /^<!-- ai-agents:state (\{.*\}) -->/.exec(c.body ?? "");
    if (m) try { estado = JSON.parse(m[1]); } catch { /* comentário malformado: ignora */ }
  }
  console.log("gravado:", gravarEntrada(entradaDeIssue(issue, estado)));
};

const [modo, numero] = process.argv.slice(2);
if (modo === "pr" && numero) await doPR(Number(numero));
else if (modo === "issue" && numero) await doIssue(Number(numero));
else if (modo === "tudo") {
  for (const pr of (await todos("/pulls?state=closed")).filter((p) => p.merged_at)) await doPR(pr.number);
  for (const i of (await todos("/issues?state=closed")).filter((x) => !x.pull_request)) await doIssue(i.number);
} else throw new Error("Uso: conhecimento.mjs pr <n> | issue <n> | tudo");
reescreverIndice();
