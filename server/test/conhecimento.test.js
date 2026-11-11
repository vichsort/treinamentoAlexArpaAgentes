import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { areasDe, buscar, entradaDeIssue, entradaDePR, gravarEntrada, lerEntrada, limpar, reescreverIndice, slug } from "../../automacao/conhecimento-lib.mjs";

const pr = (n, title, body, arquivos = ["client/src/App.jsx"]) => ({
  pr: { number: n, title, body, merged_at: "2026-11-11T10:00:00Z", html_url: `https://x/pull/${n}`, head: { ref: "ajuste/x" } },
  arquivos: arquivos.map((filename) => ({ filename, additions: 3, deletions: 1 })),
});

test("limpar remove marcadores, credenciais e lixo de encoding", () => {
  const t = limpar("ok\n<!-- fluxo-request {\"sig\":1} -->\nAI_API_KEY=abc\ncaf�", 500);
  assert.ok(!t.includes("fluxo-request"));
  assert.ok(!t.includes("AI_API_KEY"));
  assert.ok(!t.includes("�"));
});

test("slug e áreas", () => {
  assert.equal(slug("Tema claro/escuro: botão!"), "tema-claro-escuro-botao");
  assert.deepEqual(areasDe(["server/src/db.js", "client/src/estilos.css", ".github/workflows/x.yml"]), ["banco de dados", "visual", "automação e agentes"]);
});

test("entrada de PR tem frontmatter legível e sobrevive a ida e volta", () => {
  const e = entradaDePR(...Object.values(pr(15, "Tema escuro global", "Botão de tema no cabeçalho. Veja #14.")));
  assert.match(e.caminho, /^prs\/pr-0015-tema-escuro-global\.md$/);
  const lida = lerEntrada(e.texto);
  assert.equal(lida.meta.numero, 15);
  assert.deepEqual(lida.meta.relacionados, ["#14"]);
  assert.deepEqual(lida.meta.arquivos, ["client/src/App.jsx"]);
  assert.match(lida.corpo, /## Arquivos alterados/);
});

test("issue do app guarda só o pedido e o andamento público", () => {
  const corpo = "**Origem:** app (ticket `abc`)\n\n### Pedido do cliente\n> Preciso de um botão de tema\n<!-- fluxo-request {\"sig\":\"x\"} -->";
  const e = entradaDeIssue({ number: 14, title: "[app] Tema", body: corpo, closed_at: "2026-11-11T12:00:00Z", labels: [{ name: "origin:app" }], state_reason: "completed", html_url: "https://x/issues/14" }, { fase: "concluido", pr: 15, publicUpdates: [{ id: "u1", publicText: "Já temos o botão." }] });
  const lida = lerEntrada(e.texto);
  assert.equal(lida.meta.origem, "app");
  assert.equal(lida.meta.pr, 15);
  assert.ok(!e.texto.includes("fluxo-request") && !e.texto.includes("ticket `abc`"));
  assert.match(e.texto, /Preciso de um botão de tema/);
  assert.match(e.texto, /Já temos o botão\./);
});

test("gravar troca a entrada antiga do mesmo número, gera índice e a busca acha o mais parecido", () => {
  const raiz = mkdtempSync(join(tmpdir(), "conhecimento-"));
  gravarEntrada(entradaDePR(...Object.values(pr(15, "Tema escuro", "Botão de tema escuro no cabeçalho"))), raiz);
  gravarEntrada(entradaDePR(...Object.values(pr(15, "Tema escuro global", "Botão de tema escuro no cabeçalho"))), raiz);
  gravarEntrada(entradaDePR(...Object.values(pr(16, "Resposta real do agente", "Remove a resposta automática do atendimento", ["server/src/tickets.js"]))), raiz);
  assert.equal(readdirSync(join(raiz, "prs")).length, 2);
  reescreverIndice(raiz);
  assert.match(readFileSync(join(raiz, "INDEX.md"), "utf8"), /PR #16/);
  assert.equal(buscar("quero o tema escuro no sistema", 1, raiz)[0].meta.numero, 15);
  assert.equal(buscar("resposta automática do atendimento", 1, raiz)[0].meta.numero, 16);
  assert.deepEqual(buscar("zzzz qqqq", 3, raiz), []);
});
