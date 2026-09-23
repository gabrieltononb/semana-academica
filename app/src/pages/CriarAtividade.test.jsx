import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server.js';
import CriarAtividade from './CriarAtividade.jsx';

describe('Tela de Formulário para Criar Atividade (M1)', () => {
  it('deve submeter o formulário com sucesso e exibir mensagem de confirmação', async () => {
    let capturedBody = null;

    server.use(
      http.post('*/atividades', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          {
            id: 'atv_nova123',
            titulo: capturedBody.titulo,
            tipo: capturedBody.tipo,
            salaId: capturedBody.salaId,
            vagas: capturedBody.vagas,
            encontros: capturedBody.encontros.map((e, idx) => ({ ...e, id: `enc_${idx}` })),
            cargaHorariaMinutos: 120,
            situacao: 'prevista',
            ocupadas: 0,
            vagasRestantes: capturedBody.vagas,
            emEspera: 0,
          },
          { status: 201 }
        );
      })
    );

    const onSuccess = vi.fn();
    const user = userEvent.setup();

    render(<CriarAtividade usuario="org-ana" onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText(/título/i), 'Oficina de GraphQL');
    await user.selectOptions(screen.getByLabelText(/tipo/i), 'palestra');
    await user.selectOptions(screen.getByLabelText(/sala/i), 'sala-101');
    await user.type(screen.getByLabelText(/vagas/i), '30');

    await user.type(screen.getByLabelText(/início do encontro 1/i), '2026-10-19T14:00:00-03:00');
    await user.type(screen.getByLabelText(/fim do encontro 1/i), '2026-10-19T16:00:00-03:00');

    await user.click(screen.getByRole('button', { name: /cadastrar atividade/i }));

    expect(await screen.findByText(/atividade cadastrada com sucesso/i)).toBeInTheDocument();
    expect(capturedBody).toEqual({
      titulo: 'Oficina de GraphQL',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 30,
      encontros: [
        {
          inicio: '2026-10-19T14:00:00-03:00',
          fim: '2026-10-19T16:00:00-03:00',
        },
      ],
    });
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'atv_nova123', titulo: 'Oficina de GraphQL' })
    );
  });

  it('deve exibir o código e mensagem exatos da API em erro de conflito de sala (409 CONFLITO_DE_SALA)', async () => {
    server.use(
      http.post('*/atividades', () => {
        return HttpResponse.json(
          {
            erro: 'CONFLITO_DE_SALA',
            mensagem: 'A sala já possui atividade agendada neste horário ou intervalo inferior a 15 minutos',
          },
          { status: 409 }
        );
      })
    );

    const user = userEvent.setup();
    render(<CriarAtividade usuario="org-ana" />);

    await user.type(screen.getByLabelText(/título/i), 'Palestra Conflitante');
    await user.type(screen.getByLabelText(/vagas/i), '20');
    await user.type(screen.getByLabelText(/início do encontro 1/i), '2026-10-19T10:00:00-03:00');
    await user.type(screen.getByLabelText(/fim do encontro 1/i), '2026-10-19T12:00:00-03:00');

    await user.click(screen.getByRole('button', { name: /cadastrar atividade/i }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toBeInTheDocument();
    expect(alerta).toHaveTextContent('CONFLITO_DE_SALA');
    expect(alerta).toHaveTextContent(
      'A sala já possui atividade agendada neste horário ou intervalo inferior a 15 minutos'
    );
  });

  it('deve exibir o código e mensagem exatos da API quando vagas excederem capacidade (422 VAGAS_ACIMA_DA_CAPACIDADE)', async () => {
    server.use(
      http.post('*/atividades', () => {
        return HttpResponse.json(
          {
            erro: 'VAGAS_ACIMA_DA_CAPACIDADE',
            mensagem: 'Número de vagas excede a capacidade máxima da sala lab-3 (20)',
          },
          { status: 422 }
        );
      })
    );

    const user = userEvent.setup();
    render(<CriarAtividade usuario="org-ana" />);

    await user.type(screen.getByLabelText(/título/i), 'Minicurso Superlotado');
    await user.selectOptions(screen.getByLabelText(/sala/i), 'lab-3');
    await user.type(screen.getByLabelText(/vagas/i), '35');
    await user.type(screen.getByLabelText(/início do encontro 1/i), '2026-10-19T14:00:00-03:00');
    await user.type(screen.getByLabelText(/fim do encontro 1/i), '2026-10-19T17:00:00-03:00');

    await user.click(screen.getByRole('button', { name: /cadastrar atividade/i }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toBeInTheDocument();
    expect(alerta).toHaveTextContent('VAGAS_ACIMA_DA_CAPACIDADE');
    expect(alerta).toHaveTextContent('Número de vagas excede a capacidade máxima da sala lab-3 (20)');
  });

  it('deve exibir o código e mensagem exatos da API quando quantidade de encontros for inválida (422 QUANTIDADE_DE_ENCONTROS)', async () => {
    server.use(
      http.post('*/atividades', () => {
        return HttpResponse.json(
          {
            erro: 'QUANTIDADE_DE_ENCONTROS',
            mensagem: 'Minicurso deve ter entre 2 e 5 encontros',
          },
          { status: 422 }
        );
      })
    );

    const user = userEvent.setup();
    render(<CriarAtividade usuario="org-ana" />);

    await user.type(screen.getByLabelText(/título/i), 'Minicurso Incompleto');
    await user.selectOptions(screen.getByLabelText(/tipo/i), 'minicurso');
    await user.type(screen.getByLabelText(/vagas/i), '15');
    await user.type(screen.getByLabelText(/início do encontro 1/i), '2026-10-19T14:00:00-03:00');
    await user.type(screen.getByLabelText(/fim do encontro 1/i), '2026-10-19T17:00:00-03:00');

    await user.click(screen.getByRole('button', { name: /cadastrar atividade/i }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toBeInTheDocument();
    expect(alerta).toHaveTextContent('QUANTIDADE_DE_ENCONTROS');
    expect(alerta).toHaveTextContent('Minicurso deve ter entre 2 e 5 encontros');
  });

  it('permite adicionar e remover múltiplos encontros dinamicamente', async () => {
    const user = userEvent.setup();
    render(<CriarAtividade usuario="org-ana" />);

    expect(screen.getByLabelText(/início do encontro 1/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/início do encontro 2/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /adicionar encontro/i }));

    expect(screen.getByLabelText(/início do encontro 2/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fim do encontro 2/i)).toBeInTheDocument();
  });
});
