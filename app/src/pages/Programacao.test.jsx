import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server.js';
import Programacao from './Programacao.jsx';

const mockAtividades = [
  {
    id: 'atv_1',
    titulo: 'Palestra de Abertura: Futuro da IA',
    tipo: 'palestra',
    salaId: 'auditorio',
    vagas: 200,
    ocupadas: 150,
    vagasRestantes: 50,
    emEspera: 0,
    situacao: 'prevista',
    encontros: [
      { id: 'enc_1', inicio: '2026-10-19T09:00:00-03:00', fim: '2026-10-19T11:00:00-03:00' }
    ]
  },
  {
    id: 'atv_2',
    titulo: 'Minicurso de TypeScript Avançado',
    tipo: 'minicurso',
    salaId: 'lab-3',
    vagas: 20,
    ocupadas: 20,
    vagasRestantes: 0,
    emEspera: 5,
    situacao: 'prevista',
    encontros: [
      { id: 'enc_2', inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T17:00:00-03:00' }
    ]
  }
];

describe('Tela de Programação (M1)', () => {
  it('deve carregar e listar as atividades da programação', async () => {
    server.use(
      http.get('*/atividades', () => {
        return HttpResponse.json(mockAtividades);
      })
    );

    render(<Programacao />);

    expect(screen.getByText(/carregando programação/i)).toBeInTheDocument();

    expect(await screen.findByText('Palestra de Abertura: Futuro da IA')).toBeInTheDocument();
    expect(screen.getByText('Minicurso de TypeScript Avançado')).toBeInTheDocument();
    expect(screen.getByText(/vagas restantes: 50/i)).toBeInTheDocument();
    expect(screen.getByText(/vagas restantes: 0/i)).toBeInTheDocument();
  });

  it('deve filtrar atividades por tipo (palestra / minicurso)', async () => {
    server.use(
      http.get('*/atividades', ({ request }) => {
        const url = new URL(request.url);
        const tipo = url.searchParams.get('tipo');
        if (tipo) {
          return HttpResponse.json(mockAtividades.filter((a) => a.tipo === tipo));
        }
        return HttpResponse.json(mockAtividades);
      })
    );

    const user = userEvent.setup();
    render(<Programacao />);

    expect(await screen.findByText('Palestra de Abertura: Futuro da IA')).toBeInTheDocument();

    const filtroTipo = screen.getByLabelText(/filtrar por tipo/i);
    await user.selectOptions(filtroTipo, 'minicurso');

    expect(await screen.findByText('Minicurso de TypeScript Avançado')).toBeInTheDocument();
    expect(screen.queryByText('Palestra de Abertura: Futuro da IA')).not.toBeInTheDocument();
  });

  it('deve filtrar atividades por dia', async () => {
    server.use(
      http.get('*/atividades', ({ request }) => {
        const url = new URL(request.url);
        const dia = url.searchParams.get('dia');
        if (dia === '2026-10-19') {
          return HttpResponse.json([mockAtividades[0]]);
        }
        if (dia === '2026-10-20') {
          return HttpResponse.json([mockAtividades[1]]);
        }
        return HttpResponse.json(mockAtividades);
      })
    );

    const user = userEvent.setup();
    render(<Programacao />);

    expect(await screen.findByText('Palestra de Abertura: Futuro da IA')).toBeInTheDocument();

    const filtroDia = screen.getByLabelText(/filtrar por dia/i);
    await user.type(filtroDia, '2026-10-20');

    expect(await screen.findByText('Minicurso de TypeScript Avançado')).toBeInTheDocument();
    expect(screen.queryByText('Palestra de Abertura: Futuro da IA')).not.toBeInTheDocument();
  });

  it('deve exibir mensagem e código exato de erro quando a API falhar', async () => {
    server.use(
      http.get('*/atividades', () => {
        return HttpResponse.json(
          { erro: 'USUARIO_DESCONHECIDO', mensagem: 'Usuário não identificado no sistema' },
          { status: 401 }
        );
      })
    );

    render(<Programacao />);

    const alertaErro = await screen.findByRole('alert');
    expect(alertaErro).toBeInTheDocument();
    expect(alertaErro).toHaveTextContent('USUARIO_DESCONHECIDO');
    expect(alertaErro).toHaveTextContent('Usuário não identificado no sistema');
  });

  it('permite selecionar uma atividade para ver detalhes', async () => {
    server.use(
      http.get('*/atividades', () => {
        return HttpResponse.json(mockAtividades);
      })
    );

    const onSelectAtividade = vi.fn();
    const user = userEvent.setup();

    render(<Programacao onSelectAtividade={onSelectAtividade} />);

    expect(await screen.findByText('Palestra de Abertura: Futuro da IA')).toBeInTheDocument();

    const botoesDetalhes = screen.getAllByRole('button', { name: /ver detalhes/i });
    await user.click(botoesDetalhes[0]);

    expect(onSelectAtividade).toHaveBeenCalledWith('atv_1');
  });
});
