const CHAVE = "fluxo-tema";

const guardado = () => {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === "claro" || v === "escuro" ? v : null;
  } catch {
    return null;
  }
};

/** Tema ativo: a escolha salva ou, sem escolha, a preferência do sistema. */
export const temaAtual = () => guardado() ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "escuro" : "claro");

export function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", tema === "escuro" ? "#0f1722" : "#EDF3FA");
}

export function salvarTema(tema) {
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
  aplicarTema(tema);
}
