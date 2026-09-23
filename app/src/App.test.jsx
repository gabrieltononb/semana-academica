import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server.js';
import App from './App.jsx';

describe('Integração da Aplicação (App)', () => {
  it('deve renderizar a tela inicial de programação e permitir alternar para criação de atividade', async () => {
    server.use(
      http.get('*/atividades', () => {
        return HttpResponse.json([
          {
            id: 'atv_1',
            titulo: 'Abertura Oficial',
            tipo: 'palestra',
            salaId: 'auditorio',
            vagas: 200,
            vagasRestantes: 100,
            ocupadas: 100,
            emEspera: 0,
            situacao: 'prevista',
            encontros: [],
          },
        ]);
      })
    );

    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Semana Acadêmica 2026' })).toBeInTheDocument();
    expect(await screen.findByText('Abertura Oficial')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /nova atividade \(organização\)/i }));

    expect(screen.getByRole('heading', { name: 'Criar Nova Atividade' })).toBeInTheDocument();
  });
});
