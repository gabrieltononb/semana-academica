import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InscricoesScreen } from '../screens/InscricoesScreen.jsx';
import { resetMockState, mockState } from './mocks/handlers.js';

describe('M2 — Tela de Inscrições e Gestão de Vagas', () => {
  beforeEach(() => {
    resetMockState();
  });

  it('renderiza catalogo de atividades e exibe detalhes da atividade selecionada', async () => {
    render(<InscricoesScreen usuarioId="p-carla" />);

    await waitFor(() => {
      expect(screen.getByTestId('card-atividade-atv_1')).toBeInTheDocument();
      expect(screen.getByTestId('card-atividade-atv_2')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Minicurso Flutter').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('detalhe-atividade')).toBeInTheDocument();
  });

  it('permite inscrever participante em atividade com vaga livre', async () => {
    const user = userEvent.setup();
    // Usa participante p-diego que ainda não tem inscrição em atv_1
    render(<InscricoesScreen usuarioId="p-diego" />);

    await waitFor(() => {
      expect(screen.getByTestId('card-atividade-atv_1')).toBeInTheDocument();
    });

    const btnInscrever = screen.getByTestId('btn-inscrever');
    expect(btnInscrever).toHaveTextContent('Garantir Vaga');

    await user.click(btnInscrever);

    await waitFor(() => {
      expect(screen.getByTestId('feedback-inscricao')).toHaveTextContent(
        'Inscrição confirmada com sucesso!'
      );
    });
  });

  it('permite entrar na lista de espera quando atividade estiver lotada', async () => {
    const user = userEvent.setup();
    render(<InscricoesScreen usuarioId="p-diego" />);

    await waitFor(() => {
      expect(screen.getByTestId('card-atividade-atv_2')).toBeInTheDocument();
    });

    // Clica no card da atividade lotada atv_2
    await user.click(screen.getByTestId('card-atividade-atv_2'));

    const btnInscrever = screen.getByTestId('btn-inscrever');
    expect(btnInscrever).toHaveTextContent('Entrar na Lista de Espera');

    await user.click(btnInscrever);

    await waitFor(() => {
      expect(screen.getByTestId('feedback-inscricao')).toHaveTextContent(
        'Você entrou na lista de espera'
      );
    });
  });

  it('navega para Minhas Inscrições e exibe status e badges correspondentes', async () => {
    const user = userEvent.setup();
    render(<InscricoesScreen usuarioId="p-carla" />);

    await waitFor(() => {
      expect(screen.getByTestId('tab-minhas-inscricoes')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('tab-minhas-inscricoes'));

    await waitFor(() => {
      expect(screen.getByTestId('secao-minhas-inscricoes')).toBeInTheDocument();
      expect(screen.getByTestId('badge-status-ins_01')).toHaveTextContent('CONFIRMADA');
    });
  });

  it('permite cancelar uma inscricao ativa pela tela de Minhas Inscrições', async () => {
    const user = userEvent.setup();
    render(<InscricoesScreen usuarioId="p-carla" />);

    await user.click(screen.getByTestId('tab-minhas-inscricoes'));

    await waitFor(() => {
      expect(screen.getByTestId('btn-cancelar-ins_01')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('btn-cancelar-ins_01'));

    await waitFor(() => {
      expect(screen.getByTestId('feedback-inscricao')).toHaveTextContent(
        'Inscrição cancelada com sucesso.'
      );
    });
  });

  it('permite confirmar convocacao ativa com sucesso', async () => {
    const user = userEvent.setup();
    // Adiciona uma convocação ativa para p-carla
    mockState.inscricoes.push({
      id: 'ins_convocada_teste',
      atividadeId: 'atv_2',
      participanteId: 'p-carla',
      status: 'convocada',
      posicaoNaEspera: null,
      convocadaAte: new Date(Date.now() + 7200000).toISOString(),
      criadaEm: new Date().toISOString(),
    });

    render(<InscricoesScreen usuarioId="p-carla" />);

    await user.click(screen.getByTestId('tab-minhas-inscricoes'));

    await waitFor(() => {
      expect(screen.getByTestId('btn-confirmar-ins_convocada_teste')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('btn-confirmar-ins_convocada_teste'));

    await waitFor(() => {
      expect(screen.getByTestId('feedback-inscricao')).toHaveTextContent(
        'Convocação confirmada!'
      );
    });
  });
});
