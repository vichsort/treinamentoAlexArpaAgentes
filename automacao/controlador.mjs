// Controlador do ai-agents.yml. Uso: node automacao/controlador.mjs <preparar|publicar|falha|aplicar|abrir-pr|build|entregar>
// Roda sempre a partir da main confiável. Título, corpo e comentários da issue e a resposta da IA são dados:
// só passam por validação em contrato.mjs e nunca viram comando de shell.
// O estado fica num comentário de controle do bot na própria issue; antes de agir, relê-o.
// Fases: iniciado → pr-pendente → pr-aberto → pr-verde → (aguardando-merge) → merged → concluido.
// Falha de build: build-falhou (uma rodada de correção no mesmo PR) → pendente-instrutor.
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
const MENSAGEM_ENTREGA = "A alteração foi integrada ao código principal. O app local precisa ser atualizado (git pull e reiniciar) para exibi-la.";
const RODADAS_MAX = 1;

// Evento de PR não traz a issue: ela vem do "ref. #n" no corpo do PR que o próprio controlador abriu.
let numero = Number(env.ISSUE);
if (!numero && env.PR_NUMBER) numero = Number(/ref\. #(\d+)/.exec((await gh("GET", `/pulls/${env.PR_NUMBER}`)).body ?? "")?.[1]);
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
  atual.estado = novo;
}

/** Marco real do trabalho: vira mensagem do N1 no app, uma vez só (ID estável). */
const anunciar = (estado, id, texto) => ({ ...estado, publicUpdates: [...(estado.publicUpdates ?? []).filter((u) => u.id !== id), { id, publicText: texto }] });
const comentar = (alvo, body) => gh("POST", `/issues/${alvo}/comments`, { body });
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
  const entrada = montarEntrada({ repo, issue, marcador });

  if (env.CORRIGIR === "true") {
    // Uma rodada automática de correção, no MESMO PR: leva o erro curto e o requestId, sem reiniciar o trabalho.
    if (!e?.pr || e.fase !== "build-falhou" || (e.rodadas ?? 0) >= RODADAS_MAX) { console.log("Sem correção a fazer (sem PR com build falho, ou rodada já usada)."); saida("skip", "true"); process.exit(0); }
    const fontes = {};
    for (const p of e.allowedFiles ?? []) {
      if (!caminhoPermitido(p)) continue;
      fontes[p] = Buffer.from((await gh("GET", `/contents/${p}?ref=ai/${e.requestId}`)).content, "base64").toString("utf8");
    }
    await gravarEstado(atual, anunciar({ ...e, fase: "corrigindo", rodadas: (e.rodadas ?? 0) + 1, run: env.GITHUB_RUN_ID, at: new Date().toISOString() }, "correcao", "A conferência encontrou um problema e estamos fazendo um ajuste."));
    writeFileSync(join(temp, "entrada.json"), JSON.stringify({ ...entrada, correcao: { erro: String(e.erroBuild ?? "build falhou").slice(0, 300), allowedFiles: e.allowedFiles ?? [] }, fontes }));
    saida("skip", "false");
    console.log(`Correção #${(e.rodadas ?? 0) + 1} preparada para ${e.requestId}.`);
    process.exit(0);
  }

  const retomar = env.RETOMAR === "true";
  // Não reinicia trabalho ativo nem repete etapa concluída; só retoma, de forma explícita, o que ficou incerto.
  if (e && !(retomar && ["iniciado", "incerto", "erro"].includes(e.fase))) {
    console.log(`Issue #${numero} em fase "${e.fase}": nada a repetir (só iniciado, incerto ou erro retomam, com retomar=true).`);
    saida("skip", "true"); process.exit(0);
  }
  await gravarEstado(atual, { requestId: marcador.requestId, resultPath: marcador.resultPath, fase: "iniciado", run: env.GITHUB_RUN_ID, pr: null, publicUpdates: [], at: new Date().toISOString() });
  writeFileSync(join(temp, "entrada.json"), JSON.stringify(entrada));
  saida("skip", "false");
  console.log(`Issue #${numero} preparada (${marcador.requestId}).`);
}

if (fase === "publicar") {
  const entrada = JSON.parse(readFileSync(join(temp, "entrada.json"), "utf8"));
  const bruto = JSON.parse(readFileSync(join(temp, "resultado-bruto.json"), "utf8"));
  const atual = await estadoAtual();
  const anterior = atual.estado;
  const correcao = Boolean(entrada.correcao);
  let r;
  try {
    r = validarResultado(bruto, entrada);
    // Correção só pode mexer onde o PR já mexeu.
    if (correcao && (r.outcome !== "code" || !r.allowedFiles.every((f) => entrada.correcao.allowedFiles.includes(f)))) throw new Error("A correção deve ser code e ficar nos arquivos do PR.");
  } catch (e) {
    await gravarEstado(atual, { ...anterior, fase: "erro", motivo: sem(e.message).slice(0, 200) });
    await comentar(numero, `Resultado do coordenador rejeitado na validação: ${sem(e.message)}`);
    throw e;
  }
  const resumo = [`**Resumo interno** (${r.requestId}${correcao ? ", correção" : ""}) — resultado: \`${r.outcome}\`; agentes: ${r.agents.join(", ") || "nenhum"}.`, ...r.updates.map((u) => `- **${u.agent}:** ${sem(u.internalText)}`)];
  if (r.allowedFiles.length) resumo.push("", "Arquivos: " + r.allowedFiles.map((f) => `\`${f}\``).join(", "), "Critérios: " + r.criteria.map((c) => sem(c.description)).join("; "));
  await comentar(numero, resumo.join("\n"));
  const prefixo = correcao ? "r1-" : "";
  await gravarEstado(atual, {
    ...(correcao ? anterior : {}),
    requestId: r.requestId, resultPath: anterior.resultPath, run: env.GITHUB_RUN_ID, pr: correcao ? anterior.pr : null, at: new Date().toISOString(),
    fase: r.outcome === "working" ? "iniciado" : r.outcome === "code" ? "pr-pendente" : "concluido",
    outcome: r.outcome, publicText: correcao ? anterior.publicText : r.publicText,
    allowedFiles: r.allowedFiles,
    publicUpdates: [...(anterior.publicUpdates ?? []), ...r.updates.map((u) => ({ id: `${prefixo}${u.id}`.slice(0, 40), publicText: u.publicText }))],
  });
  writeFileSync(join(temp, "resultado-validado.json"), JSON.stringify(r));
  saida("outcome", r.outcome);
  // Dúvida respondida (ou comercial) fecha o caso. Esclarecimento pendente (waiting-customer) e human-review mantêm a issue aberta.
  if (r.outcome === "answered" || r.outcome === "commercial") {
    await gh("PATCH", `/issues/${numero}`, { state: "closed", state_reason: "completed" });
    console.log("Resposta publicada e issue fechada.");
  }
  console.log(`Resultado publicado: ${r.outcome}.`);
}

if (fase === "falha") {
  // Timeout ou erro de rede: o provedor pode ter cobrado. Registra a incerteza; quem decide retomar é uma pessoa.
  const atual = await estadoAtual();
  await gravarEstado(atual, { ...atual.estado, fase: "incerto", at: new Date().toISOString() });
  await comentar(numero, "A execução falhou antes de terminar e o estado ficou incerto. Nada foi repetido. Para retomar, rode o workflow `ai-agents` com `retomar=true`.");
}

if (fase === "aplicar") {
  const r = JSON.parse(readFileSync(env.RESULTADO, "utf8"));
  const atual = await estadoAtual();
  if (atual.estado?.requestId !== r.requestId || atual.estado.fase !== "pr-pendente") { console.log("Estado não pede PR: nada a aplicar."); saida("skip", "true"); process.exit(0); }
  const validado = validarResultado(r, { requestId: atual.estado.requestId });
  if (validado.outcome !== "code") throw new Error("Só code gera PR.");
  const ramo = `ai/${validado.requestId}`;
  saida("ramo", ramo);
  if (atual.estado.pr) {
    // Correção: novo commit no MESMO PR, pela API de conteúdo (nada de checkout da branch gerada).
    for (const e of validado.edits) {
      if (!caminhoPermitido(e.path)) throw new Error("Caminho fora do escopo.");
      const existente = await gh("GET", `/contents/${e.path}?ref=${ramo}`).catch(() => null);
      await gh("PUT", `/contents/${e.path}`, { message: `Correção automática (${validado.requestId})`, content: Buffer.from(e.content).toString("base64"), branch: ramo, sha: existente?.sha });
    }
    await gravarEstado(atual, { ...atual.estado, fase: "pr-aberto" });
    saida("skip", "false"); saida("corrigido", "true");
    process.exit(0);
  }
  for (const e of validado.edits) {
    if (!caminhoPermitido(e.path)) throw new Error("Caminho fora do escopo.");
    mkdirSync(dirname(e.path), { recursive: true });
    writeFileSync(e.path, e.content);
  }
  const relatorio = atual.estado.resultPath;
  mkdirSync(dirname(relatorio), { recursive: true });
  writeFileSync(relatorio, `# Relatório ${validado.requestId}\n\n\`\`\`json\n${JSON.stringify({ ...validado, edits: undefined }, null, 2)}\n\`\`\`\n`);
  saida("skip", "false");
}

if (fase === "abrir-pr") {
  const atual = await estadoAtual();
  const issue = await gh("GET", `/issues/${numero}`);
  // "ref. #n", nunca "closes": a issue só fecha depois de a resposta ser entregue.
  const pr = await gh("POST", "/pulls", {
    title: String(issue.title).slice(0, 120), head: env.RAMO, base: "main",
    body: `Pedido ${atual.estado.requestId} (ref. #${numero}). Gerado pelo atendimento automático. Revise antes de aceitar.`,
  });
  await gravarEstado(atual, anunciar({ ...atual.estado, fase: "pr-aberto", pr: pr.number }, "pr-aberto", "Preparamos uma proposta de alteração e estamos conferindo se tudo funciona."));
  console.log(`PR #${pr.number} aberto.`);
}

if (fase === "build") {
  // Aceita o PR de código só se: veio do bot na branch do requestId (mesmo repositório), o build é do commit atual
  // e passou. O candidato nunca roda aqui: o build acontece no job "construir", sem segredos.
  const atualEstado = await estadoAtual();
  const estado = atualEstado.estado;
  if (!estado?.pr) { console.log("Estado sem PR: nada a registrar."); process.exit(0); }
  const pr = await gh("GET", `/pulls/${estado.pr}`);
  const origemOk = pr.user?.login === "github-actions[bot]" && pr.head.ref === `ai/${estado.requestId}` && pr.head.repo?.full_name === repo;
  const atual = origemOk && pr.head.sha === env.SHA_BUILD;
  const passou = env.RESULTADO_BUILD === "success";
  const veredito = !origemOk ? "origem do PR não confere" : !atual ? "build é de um commit antigo" : passou ? "build passou" : "build falhou";
  await comentar(estado.pr, `Conferência automática (${estado.requestId}): ${veredito}. Commit \`${String(env.SHA_BUILD).slice(0, 7)}\`.`);
  console.log(veredito);
  if (!origemOk || !atual) process.exit(0);
  if (passou) {
    await gravarEstado(atualEstado, anunciar({ ...estado, fase: "pr-verde" }, "build-ok", "A conferência automática da alteração passou."));
  } else if ((estado.rodadas ?? 0) < RODADAS_MAX) {
    // Erro curto: só o passo que falhou, sem log.
    const jobs = await gh("GET", `/actions/runs/${env.GITHUB_RUN_ID}/jobs`).catch(() => ({ jobs: [] }));
    const passo = jobs.jobs.find((j) => j.name === "construir")?.steps?.find((s) => s.conclusion === "failure")?.name ?? "build";
    await gravarEstado(atualEstado, anunciar({ ...estado, fase: "build-falhou", erroBuild: `falha no passo "${passo}"` }, "build-falhou", "A conferência encontrou um erro. Vamos tentar corrigir automaticamente."));
    // dispatch com GITHUB_TOKEN é a exceção que inicia outro workflow
    await gh("POST", "/actions/workflows/ai-agents.yml/dispatches", { ref: "main", inputs: { issue: String(numero), corrigir: "true" } });
    console.log("Correção automática solicitada (rodada 1).");
  } else {
    await gravarEstado(atualEstado, anunciar({ ...estado, fase: "pendente-instrutor" }, "pendente", "Não conseguimos concluir sozinhos. A equipe vai analisar o seu pedido."));
    await comentar(numero, `O build continua falhando depois da rodada de correção (requestId ${estado.requestId}). Pendência para o instrutor decidir; nada será repetido sozinho.`);
  }
}

if (fase === "entregar") {
  // Entrega idempotente: cada passo relê o estado e a mensagem tem ID estável ("entrega"). Serve para o merge
  // feito aqui (AUTO_MERGE=true), para o merge manual (evento de PR) e para retomar depois de uma falha.
  const atualEstado = await estadoAtual();
  const estado = atualEstado.estado;
  if (!estado?.pr || estado.fase === "concluido") { console.log("Nada a entregar."); process.exit(0); }
  let pr = await gh("GET", `/pulls/${estado.pr}`);
  if (pr.user?.login !== "github-actions[bot]" || pr.head.ref !== `ai/${estado.requestId}`) { console.log("PR não é do fluxo: ignorado."); process.exit(0); }
  if (!pr.merged) {
    if (estado.fase !== "pr-verde" && estado.fase !== "aguardando-merge") { console.log(`Fase "${estado.fase}": aguardando build verde.`); process.exit(0); }
    if (env.AUTO_MERGE !== "true") {
      if (estado.fase !== "aguardando-merge") {
        await gravarEstado(atualEstado, anunciar({ ...estado, fase: "aguardando-merge" }, "aguardando", "A alteração está pronta e aguarda a aprovação da equipe."));
        await comentar(estado.pr, "Build verde e revisão registrada. AUTO_MERGE=false: PR disponível para demonstração; o merge é manual.");
      }
      console.log("PR aguardando merge manual."); process.exit(0);
    }
    // Respeita as regras da branch: se estiverem bloqueando, a API recusa e nada é forçado.
    try {
      await gh("PUT", `/pulls/${estado.pr}/merge`, { merge_method: "squash", sha: pr.head.sha });
    } catch (e) {
      await comentar(estado.pr, `Merge automático não realizado (${sem(e.message)}). As regras da branch foram respeitadas; o merge fica para o instrutor.`);
      await gravarEstado(atualEstado, { ...estado, fase: "aguardando-merge" });
      process.exit(0);
    }
    pr = await gh("GET", `/pulls/${estado.pr}`);
    if (!pr.merged) { console.log("Merge não confirmado."); process.exit(0); }
  }
  // Merge confirmado na main: resposta do N1 (ID estável), depois fecha a issue, depois marca concluído.
  const updates = (estado.publicUpdates ?? []).filter((u) => u.id !== "entrega");
  await gravarEstado(atualEstado, { ...estado, fase: "merged", publicUpdates: [...updates, { id: "entrega", publicText: MENSAGEM_ENTREGA }] });
  if ((await gh("GET", `/issues/${numero}`)).state === "open") {
    await gh("PATCH", `/issues/${numero}`, { state: "closed", state_reason: "completed" });
    await comentar(numero, `Entregue: PR #${estado.pr} integrado na main. Issue fechada.`);
  }
  await gravarEstado(atualEstado, { ...atualEstado.estado, fase: "concluido" });
  console.log("Entrega concluída.");
}
