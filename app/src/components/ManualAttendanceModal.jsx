import React, { useState } from 'react';
import { registrarPresencaManual } from '../services/presencaService.js';

export function ManualAttendanceModal({
  encontroId,
  usuarioId = 'org-ana',
  aberto,
  aoFechar,
  aoSalvarSucesso,
}) {
  const [participanteId, setParticipanteId] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(null);

  if (!aberto) return null;

  const tamanhoTrim = justificativa.trim().length;
  const isJustificativaValida = tamanhoTrim >= 10;
  const isFormValido = participanteId.trim() && isJustificativaValida;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValido || enviando) return;

    setEnviando(true);
    setErro(null);
    setSucesso(null);

    try {
      const res = await registrarPresencaManual(
        encontroId,
        {
          participanteId: participanteId.trim(),
          justificativa: justificativa.trim(),
        },
        usuarioId
      );

      if (res.status === 201) {
        setSucesso({
          tipo: 'criado',
          mensagem: `Presença manual registrada com sucesso para ${participanteId}!`,
          presenca: res.presenca,
        });
      } else if (res.status === 200) {
        setSucesso({
          tipo: 'idempotente',
          mensagem: `Participante ${participanteId} já possuía presença registrada neste encontro.`,
          presenca: res.presenca,
        });
      }

      if (aoSalvarSucesso) {
        aoSalvarSucesso(res.presenca);
      }

      setParticipanteId('');
      setJustificativa('');
    } catch (err) {
      let msg = err.mensagem || 'Falha ao registrar presença manual';
      if (err.erro === 'JUSTIFICATIVA_OBRIGATORIA') {
        msg = 'A justificativa é obrigatória e deve conter no mínimo 10 caracteres.';
      } else if (err.erro === 'LIMITE_DE_MANUAIS') {
        msg = 'Limite de presenças manuais (teto de 10%) atingido para este encontro.';
      } else if (err.erro === 'NAO_INSCRITO') {
        msg = 'Participante não possui inscrição confirmada nesta atividade.';
      } else if (err.erro === 'FORA_DA_JANELA') {
        msg = 'Registro manual fora da janela permitida [início - 15min, fim + 2h].';
      }

      setErro({
        codigo: err.erro,
        mensagem: msg,
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="modal-backdrop" data-testid="manual-attendance-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Lançamento de Presença Manual</h3>
          <button
            type="button"
            className="btn-fechar-modal"
            onClick={aoFechar}
            data-testid="btn-fechar-modal"
          >
            ✕
          </button>
        </div>

        <p className="modal-description">
          Utilize em situações excepcionais de falha técnica ou falta de conectividade do participante.
          O registro requer justificativa detalhada com no mínimo 10 caracteres.
        </p>

        {erro && (
          <div className="alert alert-danger" data-testid="modal-error">
            <strong>Erro:</strong> {erro.mensagem}
          </div>
        )}

        {sucesso && (
          <div className="alert alert-success" data-testid="modal-success">
            <strong>{sucesso.tipo === 'criado' ? 'Sucesso!' : 'Aviso:'}</strong> {sucesso.mensagem}
          </div>
        )}

        <form onSubmit={handleSubmit} className="manual-form">
          <div className="form-group">
            <label htmlFor="participante-id">Identificador do Participante:</label>
            <input
              id="participante-id"
              type="text"
              placeholder="Ex: p-carla"
              value={participanteId}
              onChange={(e) => setParticipanteId(e.target.value)}
              disabled={enviando}
              data-testid="input-participante-id"
              required
            />
          </div>

          <div className="form-group">
            <div className="label-with-counter">
              <label htmlFor="justificativa">Justificativa da Presença:</label>
              <span
                className={`char-counter ${isJustificativaValida ? 'valid' : 'invalid'}`}
                data-testid="char-counter"
              >
                {tamanhoTrim} / 10 caracteres mín.
              </span>
            </div>
            <textarea
              id="justificativa"
              rows={3}
              placeholder="Descreva o motivo excepcional (ex: Smartphone sem bateria durante o credenciamento)"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              disabled={enviando}
              data-testid="textarea-justificativa"
              required
            />
            {!isJustificativaValida && tamanhoTrim > 0 && (
              <small className="field-hint text-warning">
                A justificativa precisa de mais {10 - tamanhoTrim} caractere(s).
              </small>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={aoFechar}
              disabled={enviando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isFormValido || enviando}
              data-testid="btn-submeter-manual"
            >
              {enviando ? 'Gravando...' : 'Registrar Presença Manual'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
