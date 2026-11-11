import { Botao } from "./componentes/Botao.jsx";
import { Icone } from "./componentes/Icone.jsx";

/** Lateral com a lista de quadros e o atalho para criar um novo. */
export function BarraLateral({ tela, aoMudarTela, quadros, quadroId, aoSelecionar, aoNovoQuadro, aoRenomear, aoExcluir }) {
  const noQuadro = tela === "quadros";
  const marca = (
    <a className="marca" href="/" aria-label="Fluxo, voltar ao início" style={{ textDecoration: "none" }}>
      <span className="marca-simbolo" aria-hidden="true">
        <Icone nome="colunas" tamanho={18} />
      </span>
      <span className="marca-nome">Fluxo</span>
    </a>
  );

  // No atendimento a lateral vira o histórico de conversas (a tela encaixa a lista em #lateral-atendimento).
  if (tela === "atendimento") {
    return (
      <aside className="lateral lateral-chat" aria-label="Atendimento">
        {marca}
        <div id="lateral-atendimento" className="lateral-atendimento" />
        <button type="button" className="lateral-nav-item" onClick={() => aoMudarTela("quadros")}>
          <Icone nome="colunas" tamanho={18} />
          Voltar aos quadros
        </button>
      </aside>
    );
  }

  return (
    <aside className="lateral" aria-label="Quadros">
      {marca}

      <nav className="lateral-nav" aria-label="Áreas do sistema">
        <button type="button" className="lateral-nav-item" data-ativo={tela === "atendimento" ? "" : undefined} aria-current={tela === "atendimento" ? "page" : undefined} onClick={() => aoMudarTela("atendimento")}>
          <Icone nome="chat" tamanho={18} />
          Atendimento
        </button>
      </nav>

      <div className="lateral-topo">
        <h2 className="lateral-titulo">Quadros</h2>
        <Botao variante="fantasma" icone="mais" aria-label="Criar quadro" onClick={aoNovoQuadro} />
      </div>

      {quadros === null ? (
        <p className="lateral-vazio">Carregando quadros…</p>
      ) : quadros.length ? (
        <ul className="lateral-lista">
          {quadros.map((quadro) => (
            <li key={quadro.id}>
              <div className="lateral-item" data-ativo={noQuadro && quadro.id === quadroId ? "" : undefined}>
                <button
                  type="button"
                  className="lateral-escolha"
                  aria-current={noQuadro && quadro.id === quadroId ? "page" : undefined}
                  onClick={() => aoSelecionar(quadro.id)}
                >
                  {quadro.title}
                </button>
                <span className="lateral-acoes">
                  <Botao variante="fantasma" icone="lapis" aria-label={`Renomear quadro ${quadro.title}`} onClick={() => aoRenomear(quadro)} />
                  <Botao variante="fantasma" icone="lixeira" aria-label={`Excluir quadro ${quadro.title}`} onClick={() => aoExcluir(quadro)} />
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="lateral-vazio">Nenhum quadro ainda. Crie o primeiro para começar.</p>
      )}
    </aside>
  );
}
