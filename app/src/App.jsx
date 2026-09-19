import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.jsx';
import { OrganizacaoScreen } from './screens/OrganizacaoScreen.jsx';
import { ParticipanteScreen } from './screens/ParticipanteScreen.jsx';
import { useNetworkStatus } from './hooks/useNetworkStatus.js';
import { useOfflineSync } from './hooks/useOfflineSync.js';
import './App.css';

export function App() {
  const [telaAtiva, setTelaAtiva] = useState('organizacao');
  const [usuarioOrg, setUsuarioOrg] = useState('org-ana');
  const [usuarioPart, setUsuarioPart] = useState('p-carla');

  const {
    isOnline,
    isSimulatedOffline,
    toggleSimulatedOffline,
  } = useNetworkStatus();

  const { totalPendentes } = useOfflineSync(isOnline);

  const usuarioAtual = telaAtiva === 'organizacao' ? usuarioOrg : usuarioPart;
  const handleMudarUsuario = (novoUsuario) => {
    if (telaAtiva === 'organizacao') {
      setUsuarioOrg(novoUsuario);
    } else {
      setUsuarioPart(novoUsuario);
    }
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
        {telaAtiva === 'organizacao' ? (
          <OrganizacaoScreen usuarioId={usuarioOrg} encontroIdPadrao="enc_1" />
        ) : (
          <ParticipanteScreen
            usuarioId={usuarioPart}
            encontroIdPadrao="enc_1"
            isOnline={isOnline}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Semana Acadêmica 2026 — Controle de Frequência e Presença por QR Code (M3)</p>
      </footer>
    </div>
  );
}

export default App;
