import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParticipanteScreen } from '../screens/ParticipanteScreen.jsx';
import { mockState } from './mocks/handlers.js';

describe('M3 — Tela do Participante', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('permite registrar presença online via digitação do código de 6 caracteres', async () => {
    const user = userEvent.setup();
    render(<ParticipanteScreen usuarioId="p-carla" encontroIdPadrao="enc_1" isOnline={true} />);

    const inputCodigo = screen.getByTestId('input-codigo-manual');
    const btnConfirmar = screen.getByTestId('btn-confirmar-presenca');

    // Botão desabilitado enquanto não tem 6 caracteres
    expect(btnConfirmar).toBeDisabled();
    await user.type(inputCodigo, 'K7M2');
    expect(btnConfirmar).toBeDisabled();

    // Completa os 6 caracteres válidos
    await user.type(inputCodigo, 'QX');
    expect(inputCodigo).toHaveValue('K7M2QX');
    expect(btnConfirmar).not.toBeDisabled();

    await user.click(btnConfirmar);

    // Verifica feedback de sucesso
    await waitFor(() => {
      expect(screen.getByTestId('participante-feedback')).toHaveTextContent('Presença Confirmada!');
    });

    // Verifica que o histórico local registra a presença
    expect(screen.getByTestId('historico-presencas')).toBeInTheDocument();
  });

  it('permite registrar presença online simulando a leitura via câmera', async () => {
    const user = userEvent.setup();
    render(<ParticipanteScreen usuarioId="p-carla" encontroIdPadrao="enc_1" isOnline={true} />);

    const inputSimular = screen.getByTestId('input-simular-camera');
    const btnSimular = screen.getByTestId('btn-simular-camera');

    await user.type(inputSimular, 'K7M2QX');
    await user.click(btnSimular);

    await waitFor(() => {
      expect(screen.getByTestId('participante-feedback')).toHaveTextContent('Presença Confirmada!');
    });
  });

  it('informa idempotência com retorno 200 OK quando presença já foi confirmada anteriormente', async () => {
    const user = userEvent.setup();
    // 'p-diego' já tem presença registrada no mockState inicial
    render(<ParticipanteScreen usuarioId="p-diego" encontroIdPadrao="enc_1" isOnline={true} />);

    const inputCodigo = screen.getByTestId('input-codigo-manual');
    await user.type(inputCodigo, 'K7M2QX');
    await user.click(screen.getByTestId('btn-confirmar-presenca'));

    await waitFor(() => {
      const feedback = screen.getByTestId('participante-feedback');
      expect(feedback).toHaveTextContent('Presença Já Registrada');
      expect(feedback).toHaveTextContent(
        'Você já possui presença confirmada neste encontro (registro mantido).'
      );
    });
  });

  it('exibe mensagem adequada quando o código QR for inválido ou expirado (CODIGO_INVALIDO)', async () => {
    const user = userEvent.setup();
    render(<ParticipanteScreen usuarioId="p-carla" encontroIdPadrao="enc_1" isOnline={true} />);

    const inputCodigo = screen.getByTestId('input-codigo-manual');
    // Código diferente do mockState.codigoAtual ('K7M2QX')
    await user.type(inputCodigo, 'ERRADO');
    await user.click(screen.getByTestId('btn-confirmar-presenca'));

    await waitFor(() => {
      const feedback = screen.getByTestId('participante-feedback');
      expect(feedback).toHaveTextContent('Código QR inválido ou expirado. Verifique a tela da sala.');
    });
  });

  it('exibe mensagem de erro quando chamada for feita fora da janela permitida (FORA_DA_JANELA)', async () => {
    const user = userEvent.setup();
    mockState.foraDaJanela = true;

    render(<ParticipanteScreen usuarioId="p-carla" encontroIdPadrao="enc_1" isOnline={true} />);

    const inputCodigo = screen.getByTestId('input-codigo-manual');
    await user.type(inputCodigo, 'K7M2QX');
    await user.click(screen.getByTestId('btn-confirmar-presenca'));

    await waitFor(() => {
      const feedback = screen.getByTestId('participante-feedback');
      expect(feedback).toHaveTextContent('Registro de presença fora do horário permitido pelo encontro.');
    });
  });

  it('exibe erro 403 quando o participante não possui inscrição confirmada (NAO_INSCRITO)', async () => {
    const user = userEvent.setup();
    // 'p-joao' não está na lista de confirmadas do mockState
    render(<ParticipanteScreen usuarioId="p-joao" encontroIdPadrao="enc_1" isOnline={true} />);

    const inputCodigo = screen.getByTestId('input-codigo-manual');
    await user.type(inputCodigo, 'K7M2QX');
    await user.click(screen.getByTestId('btn-confirmar-presenca'));

    await waitFor(() => {
      const feedback = screen.getByTestId('participante-feedback');
      expect(feedback).toHaveTextContent('Inscrição confirmada não encontrada para este participante.');
    });
  });
});
