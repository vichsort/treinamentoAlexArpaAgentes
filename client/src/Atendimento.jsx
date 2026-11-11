import { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { Botao } from "./componentes/Botao.jsx";
import { Campo } from "./componentes/Campo.jsx";
import { Confirmar } from "./componentes/Confirmar.jsx";
import { Dialogo } from "./componentes/Dialogo.jsx";
import { Icone } from "./componentes/Icone.jsx";

const ATUALIZAR_A_CADA_MS = 5000;

const hora = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Caixa de texto da conversa: Enter envia, Shift+Enter quebra a linha. */
function Composer({ aoEnviar, desabilitado, aviso, placeholder }) {
  const [valor, setValor] = useState("");
  const campo = useRef(null);

  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [valor]);

  const enviar = () => {
    const conteudo = valor.trim();
    if (!conteudo || desabilitado) return;
    setValor("");
    aoEnviar(conteudo);
  };

  return (
    <div className="chat-composer">
      <div className="chat-composer-caixa">
        <textarea
          ref={campo}
          className="chat-composer-campo"
          rows={1}
          value={valor}
          maxLength={5000}
          disabled={desabilitado}
          placeholder={placeholder}
          aria-label="Mensagem para o atendimento"
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              enviar();
            }
          }}
        />
        <button type="button" className="chat-enviar" aria-label="Enviar mensagem" disabled={desabilitado || !valor.trim()} onClick={enviar}>
          <Icone nome="enviar" tamanho={18} />
        </button>
      </div>
      <p className="chat-composer-aviso">{aviso}</p>
    </div>
  );
}

function Mensagem({ mensagem }) {
  const doUsuario = mensagem.role === "user";
  return (
    <div className="chat-linha" data-autor={doUsuario ? "usuario" : "agente"}>
      {doUsuario ? null : (
        <span className="chat-avatar" aria-hidden="true"><Icone nome="chat" tamanho={16} /></span>
      )}
      <div className="chat-mensagem">
        {doUsuario ? null : <span className="chat-autor">Atendimento</span>}
        <p className="chat-texto">{mensagem.content}</p>
        <time className="chat-hora" dateTime={mensagem.createdAt}>{hora(mensagem.createdAt)}</time>
      </div>
    </div>
  );
}

export function Atendimento() {
  const [tickets, setTickets] = useState(null);
  const [ticketId, setTicketId] = useState(null);
  const [conversa, setConversa] = useState(null);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [excluir, setExcluir] = useState(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const fim = useRef(null);

  const carregarLista = async () => {
    const dados = await api.tickets.listar();
    setTickets(dados?.tickets ?? []);
  };
  const carregarConversa = async (id) => {
    const dados = await api.tickets.detalhe(id);
    setConversa((atual) => (atual && atual.ticket.id !== id ? atual : dados));
  };

  // Lista e conversa aberta se atualizam sozinhas: é por aqui que as respostas dos agentes vão chegar.
  useEffect(() => {
    let vivo = true;
    const atualizar = async () => {
      try {
        const lista = await api.tickets.listar();
        if (!vivo) return;
        setTickets(lista?.tickets ?? []);
        if (ticketId) {
          const dados = await api.tickets.detalhe(ticketId);
          if (vivo) setConversa(dados);
        } else {
          setConversa(null);
        }
        if (vivo) setErro(null);
      } catch (e) {
        if (!vivo) return;
        setErro(e.message);
        setTickets((atual) => atual ?? []);
      }
    };
    setConversa((atual) => (atual?.ticket.id === ticketId ? atual : null));
    void atualizar();
    const relogio = setInterval(atualizar, ATUALIZAR_A_CADA_MS);
    return () => { vivo = false; clearInterval(relogio); };
  }, [ticketId]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [conversa?.messages.length, ticketId]);

  const executar = async (acao) => {
    try {
      setErro(null);
      await acao();
    } catch (e) {
      setErro(e.message);
    }
  };

  const abrir = (titulo, descricao) =>
    executar(async () => {
      setEnviando(true);
      try {
        const r = await api.tickets.abrir(titulo, descricao);
        setConversa({ ticket: r.ticket, messages: r.messages });
        setTicketId(r.ticket.id);
        setNovoAberto(false);
        await carregarLista();
      } finally {
        setEnviando(false);
      }
    });

  const enviar = (conteudo) =>
    executar(async () => {
      setEnviando(true);
      try {
        await api.tickets.enviar(ticketId, conteudo);
        await carregarConversa(ticketId);
        await carregarLista();
      } finally {
        setEnviando(false);
      }
    });

  const mudarStatus = (status) =>
    executar(async () => {
      await api.tickets.mudarStatus(ticketId, status);
      await carregarConversa(ticketId);
      await carregarLista();
    });

  const confirmarExclusao = () =>
    executar(async () => {
      const alvo = excluir;
      await api.tickets.excluir(alvo.id);
      setExcluir(null);
      if (alvo.id === ticketId) setTicketId(null);
      await carregarLista();
    });

  const ticket = conversa?.ticket;
  const mensagens = conversa?.messages ?? [];
  const aguardando = ticket?.status === "open" && mensagens.length > 0 && mensagens[mensagens.length - 1].role === "user";
  const encerrado = ticket?.status === "closed";

  return (
    <section className="atendimento" aria-label="Atendimento">
      <aside className="chat-historico" aria-label="Seus tickets">
        <Botao className="chat-novo" icone="mais" onClick={() => setNovoAberto(true)}>Novo Ticket</Botao>
        <h2 className="chat-historico-titulo">Seus tickets</h2>
        {tickets === null ? (
          <p className="lateral-vazio">Carregando tickets…</p>
        ) : tickets.length ? (
          <ul className="chat-historico-lista">
            {tickets.map((t) => (
              <li key={t.id}>
                <div className="chat-historico-item" data-ativo={t.id === ticketId ? "" : undefined}>
                  <button type="button" className="chat-historico-escolha" aria-current={t.id === ticketId ? "page" : undefined} onClick={() => setTicketId(t.id)}>
                    <span className="chat-historico-nome">{t.title}</span>
                    {t.status === "closed" ? <span className="chat-selo">Encerrado</span> : null}
                  </button>
                  <Botao variante="fantasma" icone="lixeira" className="chat-historico-excluir" aria-label={`Excluir ticket ${t.title}`} onClick={() => setExcluir(t)} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="lateral-vazio">Nenhum ticket ainda.</p>
        )}
      </aside>

      <div className="chat-principal">
        {ticket ? (
          <header className="chat-topo">
            <h1 className="chat-titulo">{ticket.title}</h1>
            {encerrado ? (
              <Botao icone="atualizar" onClick={() => void mudarStatus("open")}>Reabrir</Botao>
            ) : (
              <Botao onClick={() => void mudarStatus("closed")}>Encerrar ticket</Botao>
            )}
          </header>
        ) : null}

        {erro ? (
          <div className="aviso chat-aviso" role="alert">
            <span className="aviso-texto"><Icone nome="alerta" tamanho={18} /><span>{erro}</span></span>
          </div>
        ) : null}

        {ticketId && !conversa ? (
          <div className="chat-mensagens"><p className="carregando-line chat-faixa" role="status">Carregando conversa…</p></div>
        ) : ticket ? (
          <div className="chat-mensagens">
            <div className="chat-faixa">
              {mensagens.map((m) => <Mensagem key={m.id} mensagem={m} />)}
              {aguardando ? <p className="chat-espera" role="status">Aguardando resposta do atendimento…</p> : null}
              {encerrado ? <p className="chat-espera">Ticket encerrado. Reabra para continuar a conversa.</p> : null}
              <div ref={fim} />
            </div>
          </div>
        ) : (
          <div className="chat-boas-vindas">
            <span className="chat-boas-vindas-simbolo" aria-hidden="true"><Icone nome="chat" tamanho={26} /></span>
            <h1>Como podemos ajudar?</h1>
            <p>Abra um ticket com um título e a descrição do assunto. A conversa fica salva aqui.</p>
            <Botao variante="primario" icone="mais" onClick={() => setNovoAberto(true)}>Abrir Ticket</Botao>
          </div>
        )}

        {ticketId ? (
          <Composer
            key={ticketId}
            aoEnviar={enviar}
            desabilitado={enviando || encerrado || !conversa}
            placeholder="Escreva sua mensagem…"
            aviso="Enter envia · Shift+Enter quebra a linha"
          />
        ) : null}
      </div>

      <Dialogo aberto={novoAberto} titulo="Novo Ticket" descricao="Dê um título ao assunto e descreva o que você precisa." aoFechar={() => setNovoAberto(false)}>
        {novoAberto ? (
          <form
            className="formulario"
            onSubmit={(e) => {
              e.preventDefault();
              const dados = new FormData(e.currentTarget);
              const titulo = String(dados.get("title") ?? "").trim();
              const descricao = String(dados.get("description") ?? "").trim();
              if (titulo && descricao) void abrir(titulo, descricao);
            }}
          >
            <Campo rotulo="Título" name="title" maxLength={120} required autoFocus placeholder="Ex.: Não consigo mover cartões entre listas" />
            <Campo rotulo="Descrição" name="description" multilinha rows={6} maxLength={5000} required placeholder="O que aconteceu, o que você esperava e como reproduzir" />
            <div className="acoes">
              <Botao onClick={() => setNovoAberto(false)}>Cancelar</Botao>
              <Botao variante="primario" type="submit" disabled={enviando}>Abrir ticket</Botao>
            </div>
          </form>
        ) : null}
      </Dialogo>

      {excluir ? (
        <Confirmar
          aberto
          titulo="Excluir ticket"
          descricao={`Excluir "${excluir.title}" apaga toda a conversa. Não dá para desfazer.`}
          rotuloConfirmar="Excluir ticket"
          aoConfirmar={() => void confirmarExclusao()}
          aoFechar={() => setExcluir(null)}
        />
      ) : null}
    </section>
  );
}
