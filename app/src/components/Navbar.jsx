import React from 'react';

export function Navbar({
  telaAtiva,
  aoMudarTela,
  usuarioId,
  aoMudarUsuario,
  isOnline,
  isSimulatedOffline,
  aoAlternarModoOffline,
  totalPendentes = 0,
}) {
  return (
    <header className="app-navbar" data-testid="app-navbar">
      <div className="navbar-brand">
        <span className="brand-logo">🎓</span>
        <div className="brand-titles">
          <h1>Semana Acadêmica 2026</h1>
          <h2>Módulo M3 — Presença por QR</h2>
        </div>
      </div>

      <nav className="navbar-navigation">
        <button
          type="button"
          className={`nav-tab ${telaAtiva === 'organizacao' ? 'active' : ''}`}
          onClick={() => aoMudarTela('organizacao')}
          data-testid="tab-organizacao"
        >
          🏢 Tela da Organização
        </button>
        <button
          type="button"
          className={`nav-tab ${telaAtiva === 'participante' ? 'active' : ''}`}
          onClick={() => aoMudarTela('participante')}
          data-testid="tab-participante"
        >
          📱 Presença por QR (M3)
          {totalPendentes > 0 && (
            <span className="nav-badge" data-testid="nav-badge-pendentes">
              {totalPendentes}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`nav-tab ${telaAtiva === 'inscricoes' ? 'active' : ''}`}
          onClick={() => aoMudarTela('inscricoes')}
          data-testid="tab-inscricoes"
        >
          📝 Inscrições e Vagas (M2)
        </button>
      </nav>

      <div className="navbar-user-network">
        <div className="network-indicator" data-testid="network-indicator">
          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
          <span className="status-text" data-testid="status-conexao-texto">
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <button
            type="button"
            className={`btn-simular-rede ${isSimulatedOffline ? 'active' : ''}`}
            onClick={aoAlternarModoOffline}
            data-testid="btn-toggle-offline"
            title="Alternar simulação de conectividade para testes"
          >
            {isSimulatedOffline ? 'Restabelecer Rede' : 'Simular Offline'}
          </button>
        </div>

        <div className="user-selector">
          <label htmlFor="select-usuario">Perfil ({telaAtiva === 'organizacao' ? 'Org' : 'Part'}):</label>
          <select
            id="select-usuario"
            value={usuarioId}
            onChange={(e) => aoMudarUsuario(e.target.value)}
            data-testid="select-usuario"
          >
            {telaAtiva === 'organizacao' ? (
              <>
                <option value="org-ana">Ana (org-ana)</option>
                <option value="org-bruno">Bruno (org-bruno)</option>
              </>
            ) : (
              <>
                <option value="p-carla">Carla (p-carla)</option>
                <option value="p-diego">Diego (p-diego)</option>
                <option value="p-elisa">Elisa (p-elisa)</option>
              </>
            )}
          </select>
        </div>
      </div>
    </header>
  );
}
