import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrganizacaoScreen } from '../screens/OrganizacaoScreen.jsx';
import { mockState } from './mocks/handlers.js';

describe('M3 — Tela da Organização', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exibe o código QR e o código alfanumérico de 6 caracteres obtidos da API', async () => {
    render(<OrganizacaoScreen usuarioId="org-ana" encontroIdPadrao="enc_1" />);

    // Aguarda o código ser exibido na tela
    await waitFor(() => {
      expect(screen.getByTestId('code-value')).toHaveTextContent('K7M2QX');
    });

    // Verifica se a área do QR code gráfico SVG foi renderizada
    expect(screen.getByTestId('qrcode-svg')).toBeInTheDocument();
    expect(screen.getByTestId('qrcode-container')).toBeInTheDocument();
  });

  it('exibe contador regressivo para a próxima troca de código', async () => {
    render(<OrganizacaoScreen usuarioId="org-ana" encontroIdPadrao="enc_1" />);

    await waitFor(() => {
      expect(screen.getByTestId('code-value')).toHaveTextContent('K7M2QX');
    });

    const contador = screen.getByTestId('countdown-seconds');
    expect(contador).toBeInTheDocument();
    expect(contador.textContent).toMatch(/\d+s/);
  });

  it('permite alternar entre visualização normal e modo tela cheia', async () => {
    const user = userEvent.setup();
    render(<OrganizacaoScreen usuarioId="org-ana" encontroIdPadrao="enc_1" />);

    await waitFor(() => {
      expect(screen.getByTestId('code-value')).toHaveTextContent('K7M2QX');
    });

    const btnFullscreen = screen.getByTestId('btn-fullscreen');
    const container = screen.getByTestId('qrcode-container');

    expect(container).not.toHaveClass('fullscreen-mode');

    // Clica para ativar tela cheia
    await user.click(btnFullscreen);
    expect(container).toHaveClass('fullscreen-mode');
    expect(screen.getByTestId('btn-fullscreen')).toHaveTextContent('Sair da Tela Cheia');

    // Clica para sair da tela cheia
    await user.click(btnFullscreen);
    expect(container).not.toHaveClass('fullscreen-mode');
  });

  it('valida que o botão de lançamento manual permanece desabilitado com justificativa < 10 caracteres', async () => {
    const user = userEvent.setup();
    render(<OrganizacaoScreen usuarioId="org-ana" encontroIdPadrao="enc_1" />);

    // Abre o modal de presença manual
    const btnAbrirModal = screen.getByTestId('btn-abrir-manual');
    await user.click(btnAbrirModal);

    expect(screen.getByTestId('manual-attendance-modal')).toBeInTheDocument();

    const inputParticipante = screen.getByTestId('input-participante-id');
    const textareaJustificativa = screen.getByTestId('textarea-justificativa');
    const btnSubmeter = screen.getByTestId('btn-submeter-manual');

    // Preenche o participante
    await user.type(inputParticipante, 'p-carla');

    // Com justificativa vazia, botão desabilitado
    expect(btnSubmeter).toBeDisabled();

    // Preenche 9 caracteres (menos que 10 mínimos após trim)
    await user.type(textareaJustificativa, '123456789');
    expect(screen.getByTestId('char-counter')).toHaveTextContent('9 / 10 caracteres mín.');
    expect(btnSubmeter).toBeDisabled();

    // Adiciona mais um caractere (10 caracteres válidos)
    await user.type(textareaJustificativa, '0');
    expect(screen.getByTestId('char-counter')).toHaveTextContent('10 / 10 caracteres mín.');
    expect(btnSubmeter).not.toBeDisabled();
  });

  it('registra presença manual com justificativa válida (>= 10 caracteres) e exibe confirmação', async () => {
    const user = userEvent.setup();
    render(<OrganizacaoScreen usuarioId="org-ana" encontroIdPadrao="enc_1" />);

    // Abre modal
    await user.click(screen.getByTestId('btn-abrir-manual'));

    await user.type(screen.getByTestId('input-participante-id'), 'p-carla');
    await user.type(
      screen.getByTestId('textarea-justificativa'),
      'Smartphone descarregado durante o credenciamento'
    );

    const btnSubmeter = screen.getByTestId('btn-submeter-manual');
    expect(btnSubmeter).not.toBeDisabled();

    await user.click(btnSubmeter);

    // Verifica mensagem de sucesso
    await waitFor(() => {
      expect(screen.getByTestId('modal-success')).toHaveTextContent(
        'Presença manual registrada com sucesso para p-carla!'
      );
    });
  });

  it('informa idempotência (200 OK) quando participante já possui presença registrada', async () => {
    const user = userEvent.setup();
    // 'p-diego' já está nas presenças iniciais do mockState
    render(<OrganizacaoScreen usuarioId="org-ana" encontroIdPadrao="enc_1" />);

    await user.click(screen.getByTestId('btn-abrir-manual'));

    await user.type(screen.getByTestId('input-participante-id'), 'p-diego');
    await user.type(
      screen.getByTestId('textarea-justificativa'),
      'Tentativa de lançamento duplicado para participante já presente'
    );

    await user.click(screen.getByTestId('btn-submeter-manual'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-success')).toHaveTextContent(
        'Participante p-diego já possuía presença registrada neste encontro'
      );
    });
  });

  it('exibe erro de negócio quando limite de manuais for atingido (LIMITE_DE_MANUAIS)', async () => {
    const user = userEvent.setup();
    mockState.limiteManuaisAtingido = true;

    render(<OrganizacaoScreen usuarioId="org-ana" encontroIdPadrao="enc_1" />);

    await user.click(screen.getByTestId('btn-abrir-manual'));

    await user.type(screen.getByTestId('input-participante-id'), 'p-elisa');
    await user.type(
      screen.getByTestId('textarea-justificativa'),
      'Justificativa válida com mais de dez caracteres'
    );

    await user.click(screen.getByTestId('btn-submeter-manual'));

    await waitFor(() => {
      expect(screen.getByTestId('modal-error')).toHaveTextContent(
        'Limite de presenças manuais (teto de 10%) atingido para este encontro'
      );
    });
  });

  it('exibe listagem de presenças do encontro com contagem e detalhes', async () => {
    render(<OrganizacaoScreen usuarioId="org-ana" encontroIdPadrao="enc_1" />);

    await waitFor(() => {
      expect(screen.getByTestId('tabela-presencas')).toBeInTheDocument();
    });

    expect(screen.getByTestId('badge-total-presencas')).toHaveTextContent('Total: 1');
    expect(screen.getByText('p-diego')).toBeInTheDocument();
  });
});
