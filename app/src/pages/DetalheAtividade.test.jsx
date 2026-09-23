import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server.js';
import DetalheAtividade from './DetalheAtividade.jsx';

const mockAtividade = {
  id: 'atv_123',
  titulo: 'Arquitetura Limpa na Prática',
  tipo: 'minicurso',
  salaId: 'sala-101',
  vagas: 40,
  cargaHorariaMinutos: 360,
  situacao: 'prevista',
  ocupadas: 30,
  vagasRestantes: 10,
  emEspera: 2,
  encontros: [
    {
      id: 'enc_1',
      inicio: '2026-10-19T14:00:00-03:00',
      fim: '2026-10-19T17:00:00-03:00',
    },
    {
      id: 'enc_2',
      inicio: '2026-10-20T14:00:00-03:00',
      fim: '2026-10-20T17:00:00-03:00',
    },
  ],
};

describe('Tela de Detalhe da Atividade (M1)', () => {
  it('deve carregar e exibir os detalhes da atividade, vagas e lista de encontros', async () => {
    server.use(
      http.get('*/atividades/atv_123', () => {
        return HttpResponse.json(mockAtividade);
      })
    );

    render(<DetalheAtividade atividadeId="atv_123" />);

    expect(screen.getByText(/carregando detalhes/i)).toBeInTheDocument();

    expect(await screen.findByRole('heading', { level: 2, name: 'Arquitetura Limpa na Prática' })).toBeInTheDocument();
    expect(screen.getByText(/tipo: minicurso/i)).toBeInTheDocument();
    expect(screen.getByText(/sala: sala-101/i)).toBeInTheDocument();
    expect(screen.getByText(/situação: prevista/i)).toBeInTheDocument();
    expect(screen.getByText(/carga horária: 360 minutos/i)).toBeInTheDocument();

    // Vagas
    expect(screen.getByText(/total de vagas: 40/i)).toBeInTheDocument();
    expect(screen.getByText(/ocupadas: 30/i)).toBeInTheDocument();
    expect(screen.getByText(/vagas restantes: 10/i)).toBeInTheDocument();
    expect(screen.getByText(/em espera: 2/i)).toBeInTheDocument();

    // Encontros
    expect(screen.getByText(/2026-10-19T14:00:00-03:00/)).toBeInTheDocument();
    expect(screen.getByText(/2026-10-20T14:00:00-03:00/)).toBeInTheDocument();
  });

  it('deve exibir mensagem e código exato de erro quando a atividade não for encontrada (404)', async () => {
    server.use(
      http.get('*/atividades/atv_inexistente', () => {
        return HttpResponse.json(
          { erro: 'NAO_ENCONTRADO', mensagem: 'Atividade não encontrada' },
          { status: 404 }
        );
      })
    );

    render(<DetalheAtividade atividadeId="atv_inexistente" />);

    const alerta = await screen.findByRole('alert');
    expect(alerta).toBeInTheDocument();
    expect(alerta).toHaveTextContent('NAO_ENCONTRADO');
    expect(alerta).toHaveTextContent('Atividade não encontrada');
  });

  it('permite acionar o botão de voltar quando fornecido', async () => {
    server.use(
      http.get('*/atividades/atv_123', () => {
        return HttpResponse.json(mockAtividade);
      })
    );

    const onVoltar = vi.fn();
    const user = userEvent.setup();

    render(<DetalheAtividade atividadeId="atv_123" onVoltar={onVoltar} />);

    expect(await screen.findByRole('heading', { name: 'Arquitetura Limpa na Prática' })).toBeInTheDocument();

    const botaoVoltar = screen.getByRole('button', { name: /voltar/i });
    await user.click(botaoVoltar);

    expect(onVoltar).toHaveBeenCalledTimes(1);
  });
});
