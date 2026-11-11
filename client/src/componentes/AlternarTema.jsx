import { useState } from "react";
import { Botao } from "./Botao.jsx";
import { salvarTema, temaAtual } from "../tema.js";

/** Botão global que alterna entre o tema claro e o escuro. */
export function AlternarTema() {
  const [tema, setTema] = useState(temaAtual);
  const escuro = tema === "escuro";
  const alternar = () => {
    const proximo = escuro ? "claro" : "escuro";
    salvarTema(proximo);
    setTema(proximo);
  };
  return (
    <Botao
      variante="fantasma"
      icone={escuro ? "sol" : "lua"}
      aria-label={escuro ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
      onClick={alternar}
    />
  );
}
