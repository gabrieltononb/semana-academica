import React, { useState, useEffect, useCallback } from 'react';
import { useQrCodeRotation } from '../hooks/useQrCodeRotation.js';
import { QrCodeDisplay } from '../components/QrCodeDisplay.jsx';
import { ManualAttendanceModal } from '../components/ManualAttendanceModal.jsx';
import { listarPresencas } from '../services/presencaService.js';

export function OrganizacaoScreen({
  usuarioId = 'org-ana',
  encontroIdPadrao = 'enc_1',
}) {
  const [encontroId, setEncontroId] = useState(encontroIdPadrao);
  const [modalManualAberto, setModalManualAberto] = useState(false);
  const [presencas, setPresencas] = useState([]);
  const [carregandoPresencas, setCarregandoPresencas] = useState(false);
  const [erroPresencas, setErroPresencas] = useState(null);

  const {
    codigo,
    segundosRestantes,
    trocaEm,
    carregando: carregandoCodigo,
    erro: erroCodigo,
    recarregar,
  } = useQrCodeRotation(encontroId, usuarioId);

  const carregarListaPresencas = useCallback(async () => {
    if (!encontroId) return;
    setCarregandoPresencas(true);
    setErroPresencas(null);
    try {
      const lista = await listarPresencas(encontroId, usuarioId);
      setPresencas(lista || []);
    } catch (err) {
      setErroPresencas(err.mensagem || 'Falha ao carregar presenças do encontro');
    } finally {
      setCarregandoPresencas(false);
    }
  }, [encontroId, usuarioId]);

  useEffect(() => {
    carregarListaPresencas();
  }, [carregarListaPresencas]);

  const totalManuais = presencas.filter((p) => p.origem === 'manual').length;
  const totalQrOnline = presencas.filter((p) => p.origem === 'qr').length;
  const totalQrOffline = presencas.filter((p) => p.origem === 'qr_offline').length;

  return (
    <div className="screen-container organizacao-screen" data-testid="organizacao-screen">
      <div className="screen-header">
        <div className="encontro-controls">
          <label htmlFor="input-encontro-id">Identificador do Encontro:</label>
          <input
            id="input-encontro-id"
            type="text"
            value={encontroId}
            onChange={(e) => setEncontroId(e.target.value)}
            data-testid="input-encontro-id"
            className="input-encontro"
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={recarregar}
            data-testid="btn-recarregar-codigo"
          >
            🔄 Atualizar Código
          </button>
        </div>

        <div className="screen-top-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalManualAberto(true)}
            data-testid="btn-abrir-manual"
          >
            ✍️ Lançamento Manual com Justificativa
          </button>
        </div>
      </div>

      {erroCodigo && (
        <div className="alert alert-warning" data-testid="erro-codigo-aviso">
          <strong>Aviso:</strong> {erroCodigo.mensagem}
          {erroCodigo.erro === 'FORA_DA_JANELA' && (
            <span> (O código só fica disponível entre 15 min antes e 30 min após o início do encontro)</span>
          )}
          <button
            type="button"
            className="btn-retry"
            onClick={recarregar}
            data-testid="btn-retry-codigo"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      <div className="org-grid">
        <section className="org-qr-section">
          <QrCodeDisplay
            codigo={codigo}
            segundosRestantes={segundosRestantes}
            trocaEm={trocaEm}
            carregando={carregandoCodigo}
            encontroId={encontroId}
          />
        </section>

        <section className="org-presencas-section">
          <div className="card presencas-card">
            <div className="card-header">
              <div className="card-title-group">
                <h3>Presenças do Encontro</h3>
                <span className="badge-total" data-testid="badge-total-presencas">
                  Total: {presencas.length}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={carregarListaPresencas}
                disabled={carregandoPresencas}
                data-testid="btn-atualizar-lista"
              >
                {carregandoPresencas ? 'Carregando...' : '🔄 Atualizar'}
              </button>
            </div>

            <div className="presencas-metrics">
              <div className="metric-chip">
                <span>QR Online:</span>
                <strong>{totalQrOnline}</strong>
              </div>
              <div className="metric-chip">
                <span>QR Offline:</span>
                <strong>{totalQrOffline}</strong>
              </div>
              <div className="metric-chip">
                <span>Manual:</span>
                <strong data-testid="total-manuais">{totalManuais}</strong>
              </div>
            </div>

            {presencas.length === 0 ? (
              <p className="empty-state" data-testid="empty-presencas">
                Nenhuma presença registrada até o momento.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="presencas-table" data-testid="tabela-presencas">
                  <thead>
                    <tr>
                      <th>Participante</th>
                      <th>Origem</th>
                      <th>Lido Em</th>
                      <th>Registrada Em</th>
                      <th>Justificativa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presencas.map((p) => (
                      <tr key={p.id} data-testid={`linha-presenca-${p.id}`}>
                        <td className="font-mono"><strong>{p.participanteId}</strong></td>
                        <td>
                          <span className={`origem-badge origem-${p.origem}`}>
                            {p.origem}
                          </span>
                        </td>
                        <td>{p.lidoEm ? new Date(p.lidoEm).toLocaleTimeString() : '-'}</td>
                        <td>{new Date(p.registradaEm).toLocaleTimeString()}</td>
                        <td className="justificativa-cell">{p.justificativa || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      <ManualAttendanceModal
        encontroId={encontroId}
        usuarioId={usuarioId}
        aberto={modalManualAberto}
        aoFechar={() => setModalManualAberto(false)}
        aoSalvarSucesso={() => {
          carregarListaPresencas();
        }}
      />
    </div>
  );
}
