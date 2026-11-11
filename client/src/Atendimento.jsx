import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "./api.js";
import { Botao } from "./componentes/Botao.jsx";
import { Campo } from "./componentes/Campo.jsx";
import { Confirmar } from "./componentes/Confirmar.jsx";
import { Dialogo } from "./componentes/Dialogo.jsx";
import { Icone } from "./componentes/Icone.jsx";

const ATUALIZAR_A_CADA_MS = 5000;

const hora = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Agrupa o histórico como o ChatGPT: Hoje, Ontem, Últimos 7 dias, Mais antigos. */
function agruparPorData(tickets) {
  const inicioDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const hoje = inicioDoDia(new Date());
  const grupos = [["Hoje", []], ["Ontem", []], ["Últimos 7 dias", []], ["Mais antigos", []]];
  for (const t of tickets) {
    const dias = Math.round((hoje - inicioDoDia(new Date(t.updatedAt))) / 86_400_000);
    grupos[dias <= 0 ? 0 : dias === 1 ? 1 : dias <= 7 ? 2 : 3][1].push(t);
  }
  return grupos.filter(([, lista]) => lista.length);
}

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
    <div className="chat-linha" data-autor={doUsuario ? "usuario" : "agente"} title={hora(mensagem.createdAt)}>
      {doUsuario ? null : (
        <span className="chat-avatar" role="img" aria-label="Atendimento"><Icone nome="chat" tamanho={16} /></span>
      )}
      <div className="chat-mensagem">
        <p className="chat-texto">{mensagem.content}</p>
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
  const [slot, setSlot] = useState(null);
  const fim = useRef(null);

  // O histórico mora na barra lateral do app (como no ChatGPT): a lateral expõe o ponto de encaixe.
  useEffect(() => { setSlot(document.getElementById("lateral-atendimento")); }, []);

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
      {slot ? createPortal(
        <nav className="chat-historico" aria-label="Seus tickets">
          <button type="button" className="chat-novo" onClick={() => setNovoAberto(true)}>
            <Icone nome="mais" tamanho={18} />
            Novo Ticket
          </button>
          {tickets === null ? (
            <p className="lateral-vazio">Carregando tickets…</p>
          ) : tickets.length ? (
            agruparPorData(tickets).map(([rotulo, lista]) => (
              <div key={rotulo} className="chat-grupo">
                <h2 className="chat-historico-titulo">{rotulo}</h2>
                <ul className="chat-historico-lista">
                  {lista.map((t) => (
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
              </div>
            ))
          ) : (
            <p className="lateral-vazio">Nenhum ticket ainda.</p>
          )}
        </nav>,
        slot,
      ) : null}

      <div className="chat-principal">
        <header className="chat-topo">
          <h1 className="chat-titulo">{ticket ? ticket.title : "Atendimento"}</h1>
          {ticket ? (
            encerrado ? (
              <Botao variante="fantasma" icone="atualizar" onClick={() => void mudarStatus("open")}>Reabrir</Botao>
            ) : (
              <Botao variante="fantasma" onClick={() => void mudarStatus("closed")}>Encerrar ticket</Botao>
            )
          ) : null}
        </header>

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
              {aguardando ? (
                <div className="chat-linha" data-autor="agente" role="status" aria-label="Aguardando resposta do atendimento">
                  <span className="chat-avatar" aria-hidden="true"><Icone nome="chat" tamanho={16} /></span>
                  <div className="chat-mensagem"><span className="chat-digitando" aria-hidden="true"><i /><i /><i /></span></div>
                </div>
              ) : null}
              {encerrado ? <p className="chat-espera">Ticket encerrado. Reabra para continuar a conversa.</p> : null}
              <div ref={fim} />
            </div>
          </div>
        ) : (
          <div className="chat-boas-vindas">
            <h1>Como podemos ajudar?</h1>
            {/* Visual de caixa de mensagem; abre o formulário de título e descrição. */}
            <div className="chat-composer-caixa chat-composer-falso" onClick={() => setNovoAberto(true)}>
              <span className="chat-composer-campo">Descreva o seu problema ou dúvida…</span>
              <Botao variante="primario" icone="mais" onClick={(e) => { e.stopPropagation(); setNovoAberto(true); }}>Abrir Ticket</Botao>
            </div>
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
