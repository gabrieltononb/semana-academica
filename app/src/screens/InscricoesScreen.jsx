import React, { useState, useEffect } from 'react';
import {
  listarAtividades,
  listarMinhasInscricoes,
  inscreverEmAtividade,
  cancelarInscricao,
  confirmarConvocacao,
} from '../services/inscricaoService.js';

export function InscricoesScreen({ usuarioId = 'p-carla' }) {
  const [atividades, setAtividades] = useState([]);
  const [minhasInscricoes, setMinhasInscricoes] = useState([]);
  const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('catalogo'); // 'catalogo' | 'minhas'
  const [tempoRestante, setTempoRestante] = useState({});

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const [atvs, inscs] = await Promise.all([
        listarAtividades(usuarioId).catch(() => []),
        listarMinhasInscricoes(usuarioId).catch(() => []),
      ]);
      setAtividades(atvs);
      setMinhasInscricoes(inscs);
      if (atvs.length > 0 && !atividadeSelecionada) {
        setAtividadeSelecionada(atvs[0]);
      } else if (atividadeSelecionada) {
        const atualizada = atvs.find((a) => a.id === atividadeSelecionada.id);
        if (atualizada) setAtividadeSelecionada(atualizada);
      }
    } catch (err) {
      setFeedback({
        tipo: 'erro',
        mensagem: err.mensagem || 'Falha ao carregar atividades e inscrições.',
      });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [usuarioId]);

  // Contagem regressiva em tempo real para convocações ativas
  useEffect(() => {
    const intervalo = setInterval(() => {
      const novosTempos = {};
      minhasInscricoes.forEach((ins) => {
        if (ins.status === 'convocada' && ins.convocadaAte) {
          const diffMs = new Date(ins.convocadaAte).getTime() - Date.now();
          if (diffMs <= 0) {
            novosTempos[ins.id] = 'Expirado';
          } else {
            const horas = Math.floor(diffMs / (1000 * 60 * 60));
            const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const segundos = Math.floor((diffMs % (1000 * 60)) / 1000);
            novosTempos[ins.id] = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
          }
        }
      });
      setTempoRestante(novosTempos);
    }, 1000);

    return () => clearInterval(intervalo);
  }, [minhasInscricoes]);

  const obterInscricaoAtiva = (atividadeId) => {
    return minhasInscricoes.find(
      (ins) =>
        ins.atividadeId === atividadeId &&
        ['confirmada', 'em_espera', 'convocada'].includes(ins.status)
    );
  };

  const handleInscrever = async (atividadeId) => {
    setFeedback(null);
    try {
      const inscricao = await inscreverEmAtividade(atividadeId, usuarioId);
      await carregarDados();
      if (inscricao.status === 'confirmada') {
        setFeedback({
          tipo: 'sucesso',
          mensagem: 'Inscrição confirmada com sucesso! Vaga garantida.',
        });
      } else if (inscricao.status === 'em_espera') {
        setFeedback({
          tipo: 'aviso',
          mensagem: `Atividade lotada! Você entrou na lista de espera na ${inscricao.posicaoNaEspera}ª posição.`,
        });
      }
    } catch (err) {
      setFeedback({
        tipo: 'erro',
        mensagem: err.mensagem || err.erro || 'Falha ao realizar inscrição.',
      });
    }
  };

  const handleCancelar = async (inscricaoId) => {
    setFeedback(null);
    try {
      await cancelarInscricao(inscricaoId, usuarioId);
      await carregarDados();
      setFeedback({
        tipo: 'info',
        mensagem: 'Inscrição cancelada com sucesso.',
      });
    } catch (err) {
      setFeedback({
        tipo: 'erro',
        mensagem: err.mensagem || err.erro || 'Falha ao cancelar inscrição.',
      });
    }
  };

  const handleConfirmarConvocacao = async (inscricaoId) => {
    setFeedback(null);
    try {
      await confirmarConvocacao(inscricaoId, usuarioId);
      await carregarDados();
      setFeedback({
        tipo: 'sucesso',
        mensagem: 'Convocação confirmada! Sua vaga está oficialmente garantida.',
      });
    } catch (err) {
      setFeedback({
        tipo: 'erro',
        mensagem: err.mensagem || err.erro || 'Falha ao confirmar convocação.',
      });
    }
  };

  return (
    <div className="inscricoes-container" data-testid="inscricoes-container">
      <div className="inscricoes-header">
        <h2>Inscrições & Gestão de Vagas (M2)</h2>
        <p className="subtitulo">
          Participante ativo: <strong>{usuarioId}</strong>
        </p>

        <div className="sub-nav-tabs">
          <button
            type="button"
            className={`btn-subtab ${abaAtiva === 'catalogo' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('catalogo')}
            data-testid="tab-catalogo"
          >
            📋 Catálogo de Atividades
          </button>
          <button
            type="button"
            className={`btn-subtab ${abaAtiva === 'minhas' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('minhas')}
            data-testid="tab-minhas-inscricoes"
          >
            🎟️ Minhas Inscrições
            {minhasInscricoes.filter((i) => ['confirmada', 'convocada'].includes(i.status)).length > 0 && (
              <span className="badge-contagem">
                {minhasInscricoes.filter((i) => ['confirmada', 'convocada'].includes(i.status)).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`feedback-banner feedback-${feedback.tipo}`} data-testid="feedback-inscricao">
          <span>{feedback.mensagem}</span>
          <button type="button" className="btn-fechar" onClick={() => setFeedback(null)}>
            ×
          </button>
        </div>
      )}

      {abaAtiva === 'catalogo' ? (
        <div className="catalogo-layout">
          <div className="atividades-lista">
            <h3>Atividades da Semana</h3>
            {carregando && <p className="carregando">Carregando atividades...</p>}
            {!carregando && atividades.length === 0 && (
              <p className="vazio">Nenhuma atividade disponível no momento.</p>
            )}
            <div className="cards-grid">
              {atividades.map((atv) => {
                const insAtiva = obterInscricaoAtiva(atv.id);
                const selecionada = atividadeSelecionada?.id === atv.id;
                return (
                  <div
                    key={atv.id}
                    className={`card-atividade ${selecionada ? 'selecionada' : ''}`}
                    onClick={() => setAtividadeSelecionada(atv)}
                    data-testid={`card-atividade-${atv.id}`}
                  >
                    <div className="card-cabecalho">
                      <span className={`tag-tipo tag-${atv.tipo}`}>{atv.tipo.toUpperCase()}</span>
                      <span className="vagas-badge">
                        {atv.vagasRestantes > 0 ? (
                          <span className="com-vagas">{atv.vagasRestantes} vagas</span>
                        ) : (
                          <span className="lotado">Lotado ({atv.emEspera} na espera)</span>
                        )}
                      </span>
                    </div>
                    <h4>{atv.titulo}</h4>
                    <p className="info-sala">📍 {atv.salaId} • Carga: {atv.cargaHorariaMinutos} min</p>

                    {insAtiva && (
                      <div className="status-inscrito-tag">
                        {insAtiva.status === 'confirmada' && '✅ Vaga Confirmada'}
                        {insAtiva.status === 'em_espera' && `⏳ Fila: ${insAtiva.posicaoNaEspera}º lugar`}
                        {insAtiva.status === 'convocada' && '📢 Convocado!'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {atividadeSelecionada && (
            <div className="detalhe-atividade" data-testid="detalhe-atividade">
              <h3>Detalhes da Atividade</h3>
              <div className="detalhe-conteudo">
                <h4>{atividadeSelecionada.titulo}</h4>
                <p>
                  <strong>Tipo:</strong> {atividadeSelecionada.tipo} | <strong>Sala:</strong>{' '}
                  {atividadeSelecionada.salaId}
                </p>
                <p>
                  <strong>Vagas Totais:</strong> {atividadeSelecionada.vagas} |{' '}
                  <strong>Ocupadas:</strong> {atividadeSelecionada.ocupadas} |{' '}
                  <strong>Fila de Espera:</strong> {atividadeSelecionada.emEspera}
                </p>

                <h5>Encontros Programados:</h5>
                <ul className="lista-encontros">
                  {(atividadeSelecionada.encontros || []).map((enc, idx) => (
                    <li key={enc.id || idx}>
                      📅 {new Date(enc.inicio).toLocaleDateString()} das{' '}
                      {new Date(enc.inicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} até{' '}
                      {new Date(enc.fim).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </li>
                  ))}
                </ul>

                <div className="acoes-detalhe">
                  {(() => {
                    const insAtiva = obterInscricaoAtiva(atividadeSelecionada.id);
                    if (insAtiva) {
                      return (
                        <div className="acao-inscrito">
                          <p className="aviso-ja-inscrito">
                            Você já possui inscrição ativa nesta atividade ({insAtiva.status}).
                          </p>
                          <button
                            type="button"
                            className="btn-cancelar-inscricao"
                            onClick={() => handleCancelar(insAtiva.id)}
                            data-testid="btn-cancelar-inscricao-detalhe"
                          >
                            Cancelar Inscrição
                          </button>
                        </div>
                      );
                    }
                    return (
                      <button
                        type="button"
                        className={`btn-inscrever ${atividadeSelecionada.vagasRestantes === 0 ? 'btn-espera' : 'btn-vaga'}`}
                        onClick={() => handleInscrever(atividadeSelecionada.id)}
                        data-testid="btn-inscrever"
                      >
                        {atividadeSelecionada.vagasRestantes > 0
                          ? 'Garantir Vaga'
                          : 'Entrar na Lista de Espera'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="minhas-inscricoes-layout" data-testid="secao-minhas-inscricoes">
          <h3>Inscrições Registradas</h3>
          {minhasInscricoes.length === 0 ? (
            <p className="vazio" data-testid="texto-sem-inscricoes">
              Você ainda não possui inscrições. Navegue pelo catálogo para se inscrever!
            </p>
          ) : (
            <div className="tabela-responsiva">
              <table className="tabela-inscricoes">
                <thead>
                  <tr>
                    <th>Atividade</th>
                    <th>Status</th>
                    <th>Posição na Espera</th>
                    <th>Prazo de Convocação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {minhasInscricoes.map((ins) => {
                    const atv = atividades.find((a) => a.id === ins.atividadeId);
                    const tempoRegressivo = tempoRestante[ins.id];
                    return (
                      <tr key={ins.id} data-testid={`linha-inscricao-${ins.id}`}>
                        <td>
                          <strong>{atv ? atv.titulo : ins.atividadeId}</strong>
                        </td>
                        <td>
                          <span className={`status-badge badge-${ins.status}`} data-testid={`badge-status-${ins.id}`}>
                            {ins.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          {ins.status === 'em_espera' ? (
                            <span className="posicao-fila" data-testid={`posicao-espera-${ins.id}`}>
                              {ins.posicaoNaEspera}º lugar
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {ins.status === 'convocada' ? (
                            <div className="box-convocacao" data-testid={`box-convocacao-${ins.id}`}>
                              <span className="relogio-regressivo">
                                ⏳ {tempoRegressivo || 'Calculando...'}
                              </span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <div className="botoes-acoes">
                            {ins.status === 'convocada' && (
                              <button
                                type="button"
                                className="btn-confirmar-vaga"
                                onClick={() => handleConfirmarConvocacao(ins.id)}
                                data-testid={`btn-confirmar-${ins.id}`}
                              >
                                Confirmar Vaga
                              </button>
                            )}
                            {['confirmada', 'em_espera', 'convocada'].includes(ins.status) && (
                              <button
                                type="button"
                                className="btn-cancelar-tabela"
                                onClick={() => handleCancelar(ins.id)}
                                data-testid={`btn-cancelar-${ins.id}`}
                              >
                                Cancelar
                              </button>
                            )}
                            {['cancelada', 'expirada'].includes(ins.status) && (
                              <span className="texto-inativo">Encerrada</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default InscricoesScreen;
