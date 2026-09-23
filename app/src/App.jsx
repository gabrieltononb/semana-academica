import React, { useState } from 'react';
import { Navbar } from './components/Navbar.jsx';
import Programacao from './pages/Programacao.jsx';
import DetalheAtividade from './pages/DetalheAtividade.jsx';
import CriarAtividade from './pages/CriarAtividade.jsx';
import { OrganizacaoScreen } from './screens/OrganizacaoScreen.jsx';
import { ParticipanteScreen } from './screens/ParticipanteScreen.jsx';
import { InscricoesScreen } from './screens/InscricoesScreen.jsx';
import { useNetworkStatus } from './hooks/useNetworkStatus.js';
import { useOfflineSync } from './hooks/useOfflineSync.js';
import './App.css';

export function App() {
  const [telaAtiva, setTelaAtiva] = useState('programacao');
  const [atividadeSelecionadaId, setAtividadeSelecionadaId] = useState(null);
  const [usuarioOrg, setUsuarioOrg] = useState('org-ana');
  const [usuarioPart, setUsuarioPart] = useState('p-carla');

  const {
    isOnline,
    isSimulatedOffline,
    toggleSimulatedOffline,
  } = useNetworkStatus();

  const { totalPendentes } = useOfflineSync(isOnline);

  const usuarioAtual = (telaAtiva === 'organizacao' || telaAtiva === 'criar') ? usuarioOrg : usuarioPart;
  const handleMudarUsuario = (novoUsuario) => {
    if (telaAtiva === 'organizacao' || telaAtiva === 'criar') {
      setUsuarioOrg(novoUsuario);
    } else {
      setUsuarioPart(novoUsuario);
    }
  };

  const irParaDetalhes = (id) => {
    setAtividadeSelecionadaId(id);
    setTelaAtiva('detalhes');
  };

  const voltarParaProgramacao = () => {
    setAtividadeSelecionadaId(null);
    setTelaAtiva('programacao');
  };

  return (
    <div className="app-layout">
      <Navbar
        telaAtiva={telaAtiva}
        aoMudarTela={setTelaAtiva}
        usuarioId={usuarioAtual}
        aoMudarUsuario={handleMudarUsuario}
        isOnline={isOnline}
        isSimulatedOffline={isSimulatedOffline}
        aoAlternarModoOffline={toggleSimulatedOffline}
        totalPendentes={totalPendentes}
      />

      <main className="app-main">
        {telaAtiva === 'programacao' && (
          <Programacao onSelectAtividade={irParaDetalhes} />
        )}
        {telaAtiva === 'detalhes' && atividadeSelecionadaId && (
          <DetalheAtividade
            atividadeId={atividadeSelecionadaId}
            onVoltar={voltarParaProgramacao}
          />
        )}
        {telaAtiva === 'criar' && (
          <CriarAtividade
            usuario={usuarioOrg}
            onSuccess={(novaAtv) => irParaDetalhes(novaAtv.id)}
          />
        )}
        {telaAtiva === 'organizacao' && (
          <OrganizacaoScreen usuarioId={usuarioOrg} encontroIdPadrao="enc_1" />
        )}
        {telaAtiva === 'participante' && (
          <ParticipanteScreen
            usuarioId={usuarioPart}
            encontroIdPadrao="enc_1"
            isOnline={isOnline}
          />
        )}
        {telaAtiva === 'inscricoes' && (
          <InscricoesScreen usuarioId={usuarioPart} />
        )}
      </main>

      <footer className="app-footer">
        <p>Semana Acadêmica 2026</p>
      </footer>
    </div>
  );
}

export default App;
