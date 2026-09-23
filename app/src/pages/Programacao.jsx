import { useState, useEffect } from 'react';
import { getAtividades } from '../api.js';

export default function Programacao({ onSelectAtividade }) {
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dia, setDia] = useState('');
  const [tipo, setTipo] = useState('');

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    setError(null);

    getAtividades({ dia, tipo })
      .then((data) => {
        if (ativo) {
          setAtividades(data);
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
  }, [dia, tipo]);

  return (
    <div>
      <h2>Programação da Semana Acadêmica</h2>

      <div>
        <label htmlFor="filtro-dia">Filtrar por dia</label>
        <input
          id="filtro-dia"
          aria-label="Filtrar por dia"
          type="date"
          value={dia}
          onChange={(e) => setDia(e.target.value)}
        />

        <label htmlFor="filtro-tipo">Filtrar por tipo</label>
        <select
          id="filtro-tipo"
          aria-label="Filtrar por tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="">Todos</option>
          <option value="palestra">Palestra</option>
          <option value="minicurso">Minicurso</option>
        </select>
      </div>

      {loading && <p>Carregando programação...</p>}

      {error && (
        <div role="alert">
          <p>Erro: {error.erro}</p>
          <p>{error.mensagem}</p>
        </div>
      )}

      {!loading && !error && atividades.length === 0 && (
        <p>Nenhuma atividade encontrada.</p>
      )}

      {!loading && !error && (
        <ul>
          {atividades.map((atv) => (
            <li key={atv.id}>
              <h3>{atv.titulo}</h3>
              <p>Tipo: {atv.tipo}</p>
              <p>Sala: {atv.salaId}</p>
              <p>Situação: {atv.situacao}</p>
              <p>Vagas restantes: {atv.vagasRestantes}</p>
              {onSelectAtividade && (
                <button type="button" onClick={() => onSelectAtividade(atv.id)}>
                  Ver detalhes
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
