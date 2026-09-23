import { useState, useEffect } from 'react';
import { getAtividade } from '../api.js';

export default function DetalheAtividade({ atividadeId, onVoltar }) {
  const [atividade, setAtividade] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setError(null);

    getAtividade(atividadeId)
      .then((data) => {
        if (ativo) {
          setAtividade(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (ativo) {
          setError({
            erro: err.erro || 'ERRO_DESCONHECIDO',
            mensagem: err.mensagem || err.message,
          });
          setLoading(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, [atividadeId]);

  if (loading) {
    return <p>Carregando detalhes...</p>;
  }

  if (error) {
    return (
      <div>
        <div role="alert">
          <p>Erro: {error.erro}</p>
          <p>{error.mensagem}</p>
        </div>
        {onVoltar && (
          <button type="button" onClick={onVoltar}>
            Voltar
          </button>
        )}
      </div>
    );
  }

  if (!atividade) {
    return null;
  }

  return (
    <div>
      {onVoltar && (
        <button type="button" onClick={onVoltar}>
          Voltar
        </button>
      )}

      <h2>{atividade.titulo}</h2>
      <p>Tipo: {atividade.tipo}</p>
      <p>Sala: {atividade.salaId}</p>
      <p>Situação: {atividade.situacao}</p>
      <p>Carga horária: {atividade.cargaHorariaMinutos} minutos</p>

      <section>
        <h3>Vagas</h3>
        <p>Total de vagas: {atividade.vagas}</p>
        <p>Ocupadas: {atividade.ocupadas}</p>
        <p>Vagas restantes: {atividade.vagasRestantes}</p>
        <p>Em espera: {atividade.emEspera}</p>
      </section>

      <section>
        <h3>Encontros</h3>
        <ul>
          {atividade.encontros?.map((enc) => (
            <li key={enc.id || enc.inicio}>
              Início: {enc.inicio} — Fim: {enc.fim}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
