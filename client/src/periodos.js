/** Períodos do filtro de tickets, contados em dias de calendário (virou o dia, "hoje" muda). */
export const PERIODOS = [
  { id: "todos", rotulo: "Todos" },
  { id: "hoje", rotulo: "Hoje" },
  { id: "ontem", rotulo: "Ontem" },
  { id: "7dias", rotulo: "7 dias" },
  { id: "30dias", rotulo: "30 dias" },
];

const inicioDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Quantos dias de calendário separam a data de "agora" (0 = hoje, 1 = ontem). */
export const diasAtras = (iso, agora = new Date()) => Math.round((inicioDoDia(agora) - inicioDoDia(new Date(iso))) / 86_400_000);

export function noPeriodo(iso, periodo, agora = new Date()) {
  const dias = diasAtras(iso, agora);
  switch (periodo) {
    case "hoje": return dias <= 0;
    case "ontem": return dias === 1;
    case "7dias": return dias <= 7;
    case "30dias": return dias <= 30;
    default: return true;
  }
}
