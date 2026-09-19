import React, { useState } from 'react';
import { CameraScanner } from '../components/CameraScanner.jsx';
import { OfflineQueueDrawer } from '../components/OfflineQueueDrawer.jsx';
import { registrarPresenca } from '../services/presencaService.js';
import { enfileirarLeitura } from '../services/offlineQueueService.js';
import { useOfflineSync } from '../hooks/useOfflineSync.js';

export function ParticipanteScreen({
  usuarioId = 'p-carla',
  encontroIdPadrao = 'enc_1',
  isOnline = true,
}) {
  const [encontroId, setEncontroId] = useState(encontroIdPadrao);
  const [codigoDigitado, setCodigoDigitado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [presencasConfirmadas, setPresencasConfirmadas] = useState([]);

  const {
    fila,
    totalPendentes,
    isSincronizando,
    sincronizar,
    atualizarFila,
  } = useOfflineSync(isOnline);

  const processarCodigo = async (codigoBruto) => {
    const codigo = (codigoBruto || '').trim().toUpperCase();
    if (!codigo || codigo.length !== 6) {
      setFeedback({
        tipo: 'erro',
        titulo: 'Código Inválido',
        mensagem: 'O código do encontro deve conter exatamente 6 caracteres.',
      });
      return;
    }

    setEnviando(true);
    setFeedback(null);

    // Se estiver offline, salva diretamente na fila local
    if (!isOnline) {
      const lidoEm = new Date().toISOString();
      const item = enfileirarLeitura({
        encontroId,
        participanteId: usuarioId,
        codigo,
        lidoEm,
      });

      atualizarFila();
      setFeedback({
        tipo: 'offline',
        titulo: 'Presença Salva Localmente (Offline)',
        mensagem: `Sua leitura foi armazenada com o horário de leitura registrado (${new Date(lidoEm).toLocaleTimeString()}). A presença será sincronizada automaticamente assim que a conexão for restabelecida.`,
        lidoEm,
        item,
      });
      setCodigoDigitado('');
      setEnviando(false);
      return;
    }

    // Se estiver online, tenta enviar imediatamente à API
    try {
      const res = await registrarPresenca(encontroId, { codigo }, usuarioId);

      if (res.status === 201) {
        setFeedback({
          tipo: 'sucesso',
          titulo: 'Presença Confirmada!',
          mensagem: `Presença registrada com sucesso às ${new Date(res.presenca.registradaEm).toLocaleTimeString()}.`,
          presenca: res.presenca,
        });
        setPresencasConfirmadas((prev) => [res.presenca, ...prev]);
      } else if (res.status === 200) {
        setFeedback({
          tipo: 'idempotente',
          titulo: 'Presença Já Registrada',
          mensagem: `Você já possui presença confirmada neste encontro (registro mantido).`,
          presenca: res.presenca,
        });
      }

      setCodigoDigitado('');
    } catch (err) {
      if (err.isNetworkError) {
        // Falha de rede inesperada: faz fallback transparente para a fila offline!
        const lidoEm = new Date().toISOString();
        const item = enfileirarLeitura({
          encontroId,
          participanteId: usuarioId,
          codigo,
          lidoEm,
        });
        atualizarFila();

        setFeedback({
          tipo: 'offline',
          titulo: 'Falha de Conexão — Salvo Offline',
          mensagem: `Não foi possível contatar o servidor. Sua presença foi salva localmente com lidoEm: ${new Date(lidoEm).toLocaleTimeString()} e será enviada quando reconectar.`,
          lidoEm,
          item,
        });
        setCodigoDigitado('');
      } else {
        // Rejeições de regra da API (422, 403, 404)
        let mensagem = err.mensagem || 'Falha ao registrar presença';
        if (err.erro === 'CODIGO_INVALIDO') {
          mensagem = 'Código QR inválido ou expirado. Verifique a tela da sala.';
        } else if (err.erro === 'FORA_DA_JANELA') {
          mensagem = 'Registro de presença fora do horário permitido pelo encontro.';
        } else if (err.erro === 'NAO_INSCRITO') {
          mensagem = 'Inscrição confirmada não encontrada para este participante.';
        } else if (err.erro === 'SINCRONIZACAO_TARDIA') {
          mensagem = 'Sincronização rejeitada: recebida mais de 2 horas após o término.';
        }

        setFeedback({
          tipo: 'erro',
          titulo: 'Registro Recusado',
          mensagem,
          codigoErro: err.erro,
        });
      }
    } finally {
      setEnviando(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    processarCodigo(codigoDigitado);
  };

  return (
    <div className="screen-container participante-screen" data-testid="participante-screen">
      <div className="participante-header">
        <div className="participante-info">
          <h2>Credenciamento de Presença</h2>
          <p>
            Participante: <strong>{usuarioId}</strong>
          </p>
        </div>

        <div className="encontro-controls">
          <label htmlFor="participante-encontro-id">Encontro:</label>
          <input
            id="participante-encontro-id"
            type="text"
            value={encontroId}
            onChange={(e) => setEncontroId(e.target.value)}
            data-testid="input-participante-encontro"
            className="input-encontro"
          />
        </div>
      </div>

      {feedback && (
        <div
          className={`alert alert-${
            feedback.tipo === 'sucesso'
              ? 'success'
              : feedback.tipo === 'idempotente'
              ? 'info'
              : feedback.tipo === 'offline'
              ? 'warning'
              : 'danger'
          }`}
          data-testid="participante-feedback"
        >
          <h4>{feedback.titulo}</h4>
          <p>{feedback.mensagem}</p>
          {feedback.lidoEm && (
            <small>
              Timestamp local gravado (<code>lidoEm</code>): {feedback.lidoEm}
            </small>
          )}
        </div>
      )}

      <div className="participante-grid">
        <section className="scanner-section">
          <CameraScanner onScan={processarCodigo} ativo={!enviando} />
        </section>

        <section className="input-manual-section">
          <div className="card">
            <h3>Digitação Alternativa do Código</h3>
            <p className="section-help">
              Caso não consiga ler pela câmera, digite os 6 caracteres exibidos na tela da sala.
            </p>

            <form onSubmit={handleManualSubmit} className="form-codigo-digitado">
              <div className="form-group">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Ex: K7M2QX"
                  value={codigoDigitado}
                  onChange={(e) => setCodigoDigitado(e.target.value.toUpperCase())}
                  disabled={enviando}
                  className="input-codigo-destaque"
                  data-testid="input-codigo-manual"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block btn-lg"
                disabled={enviando || codigoDigitado.trim().length !== 6}
                data-testid="btn-confirmar-presenca"
              >
                {enviando ? 'Verificando...' : '✓ Confirmar Presença'}
              </button>
            </form>
          </div>

          <OfflineQueueDrawer
            fila={fila}
            isOnline={isOnline}
            isSincronizando={isSincronizando}
            onSincronizar={sincronizar}
          />
        </section>
      </div>

      {presencasConfirmadas.length > 0 && (
        <section className="historico-section">
          <div className="card">
            <h3>Presenças Confirmadas nesta Sessão</h3>
            <ul className="historico-list" data-testid="historico-presencas">
              {presencasConfirmadas.map((p) => (
                <li key={p.id} className="historico-item" data-testid={`historico-${p.id}`}>
                  <span>Encontro: <strong>{p.encontroId}</strong></span>
                  <span>Origem: <strong>{p.origem}</strong></span>
                  <span>Horário: {new Date(p.registradaEm).toLocaleTimeString()}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
