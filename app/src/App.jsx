import { useState } from 'react';
import Programacao from './pages/Programacao.jsx';
import DetalheAtividade from './pages/DetalheAtividade.jsx';
import CriarAtividade from './pages/CriarAtividade.jsx';

export default function App() {
  const [tela, setTela] = useState('programacao');
  const [atividadeSelecionadaId, setAtividadeSelecionadaId] = useState(null);

  const irParaDetalhes = (id) => {
    setAtividadeSelecionadaId(id);
    setTela('detalhes');
  };

  const voltarParaProgramacao = () => {
    setAtividadeSelecionadaId(null);
    setTela('programacao');
  };

  return (
    <main>
      <header>
        <h1>Semana Acadêmica 2026</h1>
        <nav>
          <button type="button" onClick={voltarParaProgramacao}>
            Programação
          </button>
          <button type="button" onClick={() => setTela('criar')}>
            Nova Atividade (Organização)
          </button>
        </nav>
      </header>

      {tela === 'programacao' && (
        <Programacao onSelectAtividade={irParaDetalhes} />
      )}

      {tela === 'detalhes' && atividadeSelecionadaId && (
        <DetalheAtividade
          atividadeId={atividadeSelecionadaId}
          onVoltar={voltarParaProgramacao}
        />
      )}

      {tela === 'criar' && (
        <CriarAtividade
          usuario="org-ana"
          onSuccess={(novaAtv) => irParaDetalhes(novaAtv.id)}
        />
      )}
    </main>
  );
}
