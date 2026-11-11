// Controlador do ai-agents.yml. Uso: node automacao/controlador.mjs <preparar|publicar|falha|aplicar|abrir-pr>
// Roda sempre a partir da main confiável. Título, corpo e comentários da issue e a resposta da IA são dados:
// só passam por validação em contrato.mjs e nunca viram comando de shell.
// O estado fica num comentário de controle do bot na própria issue; antes de agir, relê-o.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { codificarEstado, estadoDosComentarios, pedirGithub } from "../server/src/github.js";
import { caminhoPermitido, lerPedido, montarEntrada, origemValida, validarResultado } from "./contrato.mjs";

const env = process.env;
const temp = env.RUNNER_TEMP ?? ".";
const repo = env.GITHUB_REPOSITORY;
const gh = (metodo, caminho, corpo) => pedirGithub(env.GITHUB_TOKEN, metodo, `/repos/${repo}${caminho}`, corpo);
const saida = (chave, valor) => env.GITHUB_OUTPUT && appendFileSync(env.GITHUB_OUTPUT, `${chave}=${valor}\n`);
const sem = (t) => String(t).replace(/@/g, "@​"); // texto do modelo não notifica ninguém

const numero = Number(env.ISSUE);
if (!Number.isInteger(numero) || numero < 1) throw new Error("Informe a issue.");

async function estadoAtual() {
  const comentarios = await gh("GET", `/issues/${numero}/comments?per_page=100`);
  return estadoDosComentarios(comentarios) ?? { estado: null, comentarioId: null };
}

/** Grava o estado de controle: edita o comentário do bot, ou cria o primeiro. */
async function gravarEstado(atual, novo) {
  const corpo = `${codificarEstado(novo)}\nEstado de controle do atendimento automático. Não edite.`;
  if (atual.comentarioId) await gh("PATCH", `/issues/comments/${atual.comentarioId}`, { body: corpo });
  else atual.comentarioId = (await gh("POST", `/issues/${numero}/comments`, { body: corpo })).id;
}

const fase = process.argv[2];

if (fase === "preparar") {
  if (env.AGENT_RUNTIME !== "github-actions") { console.log("AGENT_RUNTIME diferente de github-actions: nada a fazer."); saida("skip", "true"); process.exit(0); }
  const issue = await gh("GET", `/issues/${numero}`);
  const marcador = lerPedido(issue);
  if (issue.pull_request || issue.state !== "open" || !origemValida(marcador, env.AGENT_LINK_SECRET)) {
    console.log(`Issue #${numero} sem vínculo válido do backend, ou fechada: ignorada.`);
    saida("skip", "true"); process.exit(0);
  }
  const atual = await estadoAtual();
  const e = atual.estado?.requestId === marcador.requestId ? atual.estado : null;
  const retomar = env.RETOMAR === "true";
  // Não reinicia trabalho ativo nem repete etapa concluída; só retoma, de forma explícita, o que ficou incerto.
  if (e && !(retomar && ["iniciado", "incerto", "erro"].includes(e.fase))) {
    console.log(`Issue #${numero} em fase "${e.fase}": nada a repetir (só iniciado, incerto ou erro retomam, com retomar=true).`);
    saida("skip", "true"); process.exit(0);
  }
  await gravarEstado(atual, { requestId: marcador.requestId, resultPath: marcador.resultPath, fase: "iniciado", run: env.GITHUB_RUN_ID, pr: null, publicUpdates: [], at: new Date().toISOString() });
  writeFileSync(join(temp, "entrada.json"), JSON.stringify(montarEntrada({ repo, issue, marcador })));
  saida("skip", "false");
  console.log(`Issue #${numero} preparada (${marcador.requestId}).`);
}

if (fase === "publicar") {
  const entrada = JSON.parse(readFileSync(join(temp, "entrada.json"), "utf8"));
  const bruto = JSON.parse(readFileSync(join(temp, "resultado-bruto.json"), "utf8"));
  const atual = await estadoAtual();
  let r;
  try {
    r = validarResultado(bruto, entrada);
  } catch (e) {
    await gravarEstado(atual, { ...atual.estado, fase: "erro", motivo: sem(e.message).slice(0, 200) });
    await gh("POST", `/issues/${numero}/comments`, { body: `Resultado do coordenador rejeitado na validação: ${sem(e.message)}` });
    throw e;
  }
  const resumo = [`**Resumo interno** (${r.requestId}) — resultado: \`${r.outcome}\`; agentes: ${r.agents.join(", ") || "nenhum"}.`, ...r.updates.map((u) => `- **${u.agent}:** ${sem(u.internalText)}`)];
  if (r.allowedFiles.length) resumo.push("", "Arquivos: " + r.allowedFiles.map((f) => `\`${f}\``).join(", "), "Critérios: " + r.criteria.map((c) => sem(c.description)).join("; "));
  await gh("POST", `/issues/${numero}/comments`, { body: resumo.join("\n") });
  const codigo = r.outcome === "code";
  await gravarEstado(atual, {
    requestId: r.requestId, resultPath: atual.estado.resultPath, run: env.GITHUB_RUN_ID, pr: null, at: new Date().toISOString(),
    fase: r.outcome === "working" ? "iniciado" : codigo ? "pr-pendente" : "concluido",
    outcome: r.outcome, publicText: r.publicText, publicUpdates: r.updates.map((u) => ({ id: u.id, publicText: u.publicText })),
  });
  writeFileSync(join(temp, "resultado-validado.json"), JSON.stringify(r));
  saida("outcome", r.outcome);
  console.log(`Resultado publicado: ${r.outcome}.`);
}

if (fase === "falha") {
  // Timeout ou erro de rede: o provedor pode ter cobrado. Registra a incerteza; quem decide retomar é uma pessoa.
  const atual = await estadoAtual();
  await gravarEstado(atual, { ...atual.estado, fase: "incerto", at: new Date().toISOString() });
  await gh("POST", `/issues/${numero}/comments`, { body: "A execução falhou antes de terminar e o estado ficou incerto. Nada foi repetido. Para retomar, rode o workflow `ai-agents` com `retomar=true`." });
}

if (fase === "aplicar") {
  const r = JSON.parse(readFileSync(env.RESULTADO, "utf8"));
  const atual = await estadoAtual();
  if (atual.estado?.requestId !== r.requestId || atual.estado.fase !== "pr-pendente") { console.log("Estado não pede PR: nada a aplicar."); saida("skip", "true"); process.exit(0); }
  const validado = validarResultado(r, { requestId: atual.estado.requestId });
  if (validado.outcome !== "code") throw new Error("Só code gera PR.");
  for (const e of validado.edits) {
    if (!caminhoPermitido(e.path)) throw new Error("Caminho fora do escopo.");
    mkdirSync(dirname(e.path), { recursive: true });
    writeFileSync(e.path, e.content);
  }
  const relatorio = atual.estado.resultPath;
  mkdirSync(dirname(relatorio), { recursive: true });
  writeFileSync(relatorio, `# Relatório ${validado.requestId}\n\n\`\`\`json\n${JSON.stringify({ ...validado, edits: undefined }, null, 2)}\n\`\`\`\n`);
  saida("skip", "false");
  saida("ramo", `ai/${validado.requestId}`);
}

if (fase === "abrir-pr") {
  const atual = await estadoAtual();
  const issue = await gh("GET", `/issues/${numero}`);
  const pr = await gh("POST", "/pulls", {
    title: String(issue.title).slice(0, 120), head: env.RAMO, base: "main",
    body: `Pedido ${atual.estado.requestId} (ref. #${numero}). Gerado pelo atendimento automático; sem merge automático. Revise antes de aceitar.`,
  });
  await gravarEstado(atual, { ...atual.estado, fase: "concluido", pr: pr.number });
  console.log(`PR #${pr.number} aberto.`);
}

if (fase === "build") {
  // Aceita o PR de código só se: veio do bot na branch do requestId (mesmo repositório), o build é do commit atual
  // e passou. O candidato nunca roda aqui: o build acontece no job "construir", sem segredos.
  const { estado } = await estadoAtual();
  if (!estado?.pr) { console.log("Estado sem PR: nada a registrar."); process.exit(0); }
  const pr = await gh("GET", `/pulls/${estado.pr}`);
  const origemOk = pr.user?.login === "github-actions[bot]" && pr.head.ref === `ai/${estado.requestId}` && pr.head.repo?.full_name === repo;
  const atual = origemOk && pr.head.sha === env.SHA_BUILD;
  const passou = env.RESULTADO_BUILD === "success";
  const veredito = !origemOk ? "origem do PR não confere" : !atual ? "build é de um commit antigo" : passou ? "build passou" : "build falhou: devolver ao Desenvolvedor";
  await gh("POST", `/issues/${estado.pr}/comments`, { body: `Conferência automática (${estado.requestId}): ${veredito}. Commit \`${String(env.SHA_BUILD).slice(0, 7)}\`. Sem merge automático.` });
  if (origemOk && atual && !passou) await gravarEstado({ comentarioId: (await estadoAtual()).comentarioId }, { ...estado, fase: "build-falhou" });
  console.log(veredito);
}
