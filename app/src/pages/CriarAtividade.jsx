import { useState } from 'react';
import { criarAtividade } from '../api.js';

export default function CriarAtividade({ usuario = 'org-ana', onSuccess }) {
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('palestra');
  const [salaId, setSalaId] = useState('auditorio');
  const [vagas, setVagas] = useState('');
  const [encontros, setEncontros] = useState([{ inicio: '', fim: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sucesso, setSucesso] = useState(null);

  const adicionarEncontro = () => {
    setEncontros([...encontros, { inicio: '', fim: '' }]);
  };

  const removerEncontro = (index) => {
    setEncontros(encontros.filter((_, i) => i !== index));
  };

  const atualizarEncontro = (index, campo, valor) => {
    const novos = [...encontros];
    novos[index][campo] = valor;
    setEncontros(novos);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSucesso(null);

    const payload = {
      titulo,
      tipo,
      salaId,
      vagas: Number(vagas),
      encontros: encontros.map((enc) => ({
        inicio: enc.inicio,
        fim: enc.fim,
      })),
    };

    try {
      const atividadeCriada = await criarAtividade(payload, usuario);
      setSucesso('Atividade cadastrada com sucesso!');
      onSuccess?.(atividadeCriada);
    } catch (err) {
      setError({
        erro: err.erro || 'ERRO_DESCONHECIDO',
        mensagem: err.mensagem || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Criar Nova Atividade</h2>

      {error && (
        <div role="alert">
          <p>Erro: {error.erro}</p>
          <p>{error.mensagem}</p>
        </div>
      )}

      {sucesso && <p role="status">{sucesso}</p>}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="titulo">Título</label>
          <input
            id="titulo"
            name="titulo"
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="tipo">Tipo</label>
          <select
            id="tipo"
            name="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="palestra">Palestra</option>
            <option value="minicurso">Minicurso</option>
          </select>
        </div>

        <div>
          <label htmlFor="salaId">Sala</label>
          <select
            id="salaId"
            name="salaId"
            value={salaId}
            onChange={(e) => setSalaId(e.target.value)}
          >
            <option value="auditorio">Auditório Central</option>
            <option value="sala-101">Sala 101</option>
            <option value="sala-102">Sala 102</option>
            <option value="lab-3">Laboratório 3</option>
          </select>
        </div>

        <div>
          <label htmlFor="vagas">Vagas</label>
          <input
            id="vagas"
            name="vagas"
            type="number"
            value={vagas}
            onChange={(e) => setVagas(e.target.value)}
            required
          />
        </div>

        <fieldset>
          <legend>Encontros</legend>
          {encontros.map((enc, idx) => (
            <div key={idx}>
              <h4>Encontro {idx + 1}</h4>
              <div>
                <label htmlFor={`inicio-${idx}`}>Início do encontro {idx + 1}</label>
                <input
                  id={`inicio-${idx}`}
                  type="text"
                  placeholder="2026-10-19T14:00:00-03:00"
                  value={enc.inicio}
                  onChange={(e) => atualizarEncontro(idx, 'inicio', e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor={`fim-${idx}`}>Fim do encontro {idx + 1}</label>
                <input
                  id={`fim-${idx}`}
                  type="text"
                  placeholder="2026-10-19T17:00:00-03:00"
                  value={enc.fim}
                  onChange={(e) => atualizarEncontro(idx, 'fim', e.target.value)}
                  required
                />
              </div>

              {encontros.length > 1 && (
                <button
                  type="button"
                  onClick={() => removerEncontro(idx)}
                >
                  Remover encontro {idx + 1}
                </button>
              )}
            </div>
          ))}

          <button type="button" onClick={adicionarEncontro}>
            Adicionar Encontro
          </button>
        </fieldset>

        <button type="submit" disabled={loading}>
          {loading ? 'Cadastrando...' : 'Cadastrar Atividade'}
        </button>
      </form>
    </div>
  );
}
