import React from 'react';

export function OfflineQueueDrawer({
  fila = [],
  isOnline = true,
  isSincronizando = false,
  onSincronizar,
  onLimparFila,
}) {
  return (
    <div className="offline-queue-card" data-testid="offline-queue-card">
      <div className="queue-header">
        <div className="queue-title">
          <h4>Fila de Leituras Offline</h4>
          <span className="badge-count" data-testid="badge-pendentes-count">
            {fila.length} pendente(s)
          </span>
        </div>

        <div className="queue-actions">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onSincronizar}
            disabled={fila.length === 0 || !isOnline || isSincronizando}
            data-testid="btn-sincronizar-fila"
          >
            {isSincronizando ? 'Sincronizando...' : '🔄 Sincronizar Agora'}
          </button>
        </div>
      </div>

      {!isOnline && (
        <div className="offline-notice" data-testid="offline-sync-notice">
          ⚠️ <strong>Dispositivo Offline:</strong> Novas leituras são gravadas com a hora exata
          local (<code>lidoEm</code>) e serão sincronizadas automaticamente assim que a conexão for
          restabelecida.
        </div>
      )}

      {fila.length === 0 ? (
        <p className="empty-queue-msg" data-testid="empty-queue-msg">
          Nenhuma leitura pendente na fila local.
        </p>
      ) : (
        <ul className="queue-list" data-testid="queue-list">
          {fila.map((item) => (
            <li key={item.idFila} className="queue-item" data-testid={`queue-item-${item.idFila}`}>
              <div className="queue-item-main">
                <span className="queue-code">Código: <strong>{item.codigo}</strong></span>
                <span className="queue-participant">Participante: {item.participanteId}</span>
              </div>
              <div className="queue-item-sub">
                <span className="queue-lido-em">
                  Lido em: <strong>{new Date(item.lidoEm).toLocaleTimeString()}</strong> ({item.lidoEm})
                </span>
                <span className="queue-encontro">Encontro: {item.encontroId}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
