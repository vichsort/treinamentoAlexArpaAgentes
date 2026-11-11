import assert from "node:assert/strict";
import test from "node:test";
import { diasAtras, noPeriodo } from "../src/periodos.js";

const agora = new Date(2026, 10, 11, 15, 0); // 11/11/2026 15h
const dia = (d, h = 12) => new Date(2026, 10, d, h).toISOString();

test("conta dias de calendário, não 24 horas", () => {
  assert.equal(diasAtras(dia(11, 1), agora), 0);
  assert.equal(diasAtras(dia(10, 23), agora), 1);
  assert.equal(diasAtras(dia(4), agora), 7);
});

test("cada período inclui só o que deve", () => {
  assert.ok(noPeriodo(dia(11), "hoje", agora));
  assert.ok(!noPeriodo(dia(10), "hoje", agora));
  assert.ok(noPeriodo(dia(10), "ontem", agora));
  assert.ok(!noPeriodo(dia(11), "ontem", agora));
  assert.ok(noPeriodo(dia(4), "7dias", agora));
  assert.ok(!noPeriodo(dia(3), "7dias", agora));
  assert.ok(noPeriodo(new Date(2026, 9, 12).toISOString(), "30dias", agora));
  assert.ok(!noPeriodo(new Date(2026, 9, 11).toISOString(), "30dias", agora));
  assert.ok(noPeriodo(new Date(2020, 0, 1).toISOString(), "todos", agora));
});
