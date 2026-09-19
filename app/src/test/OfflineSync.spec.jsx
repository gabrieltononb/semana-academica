import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParticipanteScreen } from '../screens/ParticipanteScreen.jsx';
import { App } from '../App.jsx';
import { obterFila, enfileirarLeitura } from '../services/offlineQueueService.js';
import { mockState } from './mocks/handlers.js';

describe('M3 — Suporte Offline e Sincronização Resiliente', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('armazena a leitura localmente quando o dispositivo está offline, registrando o instante lidoEm', async () => {
    const user = userEvent.setup();
    render(<ParticipanteScreen usuarioId="p-carla" encontroIdPadrao="enc_1" isOnline={false} />);

    const inputCodigo = screen.getByTestId('input-codigo-manual');
    const btnConfirmar = screen.getByTestId('btn-confirmar-presenca');

    await user.type(inputCodigo, 'K7M2QX');
    await user.click(btnConfirmar);

    // Verifica aviso de armazenamento offline
    await waitFor(() => {
      const feedback = screen.getByTestId('participante-feedback');
      expect(feedback).toHaveTextContent('Presença Salva Localmente (Offline)');
      expect(feedback).toHaveTextContent('Timestamp local gravado (lidoEm):');
    });

    // Verifica fila no localStorage
    const fila = obterFila();
    expect(fila).toHaveLength(1);
    expect(fila[0].codigo).toBe('K7M2QX');
    expect(fila[0].encontroId).toBe('enc_1');
    expect(fila[0].participanteId).toBe('p-carla');
    expect(fila[0].lidoEm).toBeDefined();

    // Verifica que o badge de contagem da fila exibe 1 pendente
    expect(screen.getByTestId('badge-pendentes-count')).toHaveTextContent('1 pendente(s)');
  });

  it('sincroniza manualmente leituras pendentes da fila enviando lidoEm para a API', async () => {
    const user = userEvent.setup();

    // Preenche previamente a fila com uma leitura offline
    const timestampLidoEm = '2026-10-19T19:05:30-03:00';
    enfileirarLeitura({
      encontroId: 'enc_1',
      participanteId: 'p-carla',
      codigo: 'K7M2QX',
      lidoEm: timestampLidoEm,
    });

    expect(obterFila()).toHaveLength(1);

    // Renderiza a tela online
    render(<ParticipanteScreen usuarioId="p-carla" encontroIdPadrao="enc_1" isOnline={true} />);

    // Verifica que a lista na fila exibe a leitura com o horário lidoEm
    expect(screen.getByTestId('queue-list')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(timestampLidoEm))).toBeInTheDocument();

    const btnSincronizar = screen.getByTestId('btn-sincronizar-fila');
    expect(btnSincronizar).not.toBeDisabled();

    // Clica em sincronizar agora
    await user.click(btnSincronizar);

    // Aguarda sincronização e esvaziamento da fila
    await waitFor(() => {
      expect(obterFila()).toHaveLength(0);
      expect(screen.getByTestId('badge-pendentes-count')).toHaveTextContent('0 pendente(s)');
      expect(screen.getByTestId('empty-queue-msg')).toHaveTextContent('Nenhuma leitura pendente');
    });

    // Verifica que o mockState registrou a presença com origem qr_offline
    const presenca = mockState.presencas.find((p) => p.participanteId === 'p-carla');
    expect(presenca).toBeDefined();
    expect(presenca.origem).toBe('qr_offline');
    expect(presenca.lidoEm).toBe(timestampLidoEm);
  });

  it('aciona sincronização automática ao disparar evento online de restabelecimento de rede', async () => {
    // Insere leitura offline
    enfileirarLeitura({
      encontroId: 'enc_1',
      participanteId: 'p-elisa',
      codigo: 'K7M2QX',
      lidoEm: '2026-10-19T19:10:00-03:00',
    });

    expect(obterFila()).toHaveLength(1);

    render(<ParticipanteScreen usuarioId="p-elisa" encontroIdPadrao="enc_1" isOnline={true} />);

    // Simula disparo do evento nativo 'online' da janela
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Aguarda o processamento automático da fila
    await waitFor(() => {
      expect(obterFila()).toHaveLength(0);
    });

    const presenca = mockState.presencas.find((p) => p.participanteId === 'p-elisa');
    expect(presenca).toBeDefined();
    expect(presenca.origem).toBe('qr_offline');
  });

  it('lida com sincronização tardia (422 SINCRONIZACAO_TARDIA) recebida mais de 2h após o término', async () => {
    const user = userEvent.setup();
    mockState.sincronizacaoTardia = true;

    enfileirarLeitura({
      encontroId: 'enc_1',
      participanteId: 'p-carla',
      codigo: 'K7M2QX',
      lidoEm: '2026-10-19T19:05:00-03:00',
    });

    render(<ParticipanteScreen usuarioId="p-carla" encontroIdPadrao="enc_1" isOnline={true} />);

    const btnSincronizar = screen.getByTestId('btn-sincronizar-fila');
    await user.click(btnSincronizar);

    // O item com erro permanente é removido da fila ativa para não travar
    await waitFor(() => {
      expect(obterFila()).toHaveLength(0);
    });
  });

  it('integração na aplicação completa: simulação offline via navbar armazena leitura e atualiza badge', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Navega para a tela do participante
    const tabParticipante = screen.getByTestId('tab-participante');
    await user.click(tabParticipante);

    expect(screen.getByTestId('participante-screen')).toBeInTheDocument();

    // Ativa simulação de offline pelo botão da Navbar
    const btnToggleOffline = screen.getByTestId('btn-toggle-offline');
    await user.click(btnToggleOffline);

    expect(screen.getByTestId('status-conexao-texto')).toHaveTextContent('Offline');

    // Digita e confirma código offline
    const inputCodigo = screen.getByTestId('input-codigo-manual');
    await user.type(inputCodigo, 'K7M2QX');
    await user.click(screen.getByTestId('btn-confirmar-presenca'));

    // Verifica que o badge na navbar reflete 1 item pendente
    await waitFor(() => {
      expect(screen.getByTestId('nav-badge-pendentes')).toHaveTextContent('1');
    });

    // Restabelece a rede via Navbar
    await user.click(btnToggleOffline);
    expect(screen.getByTestId('status-conexao-texto')).toHaveTextContent('Online');

    // Ao restabelecer a rede, a fila deve ser sincronizada automaticamente
    await waitFor(() => {
      expect(screen.queryByTestId('nav-badge-pendentes')).not.toBeInTheDocument();
      expect(obterFila()).toHaveLength(0);
    });
  });
});
