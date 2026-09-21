import { http, HttpResponse } from 'msw';

// Dados em memória para os mocks
export const mockState = {
  codigoAtual: 'K7M2QX',
  proximoCodigo: 'A9B3CD',
  trocaEm: new Date(Date.now() + 45000).toISOString(),
  validoAte: new Date(Date.now() + 105000).toISOString(),
  presencas: [
    {
      id: 'pre_00000001',
      encontroId: 'enc_1',
      participanteId: 'p-diego',
      origem: 'qr',
      lidoEm: '2026-10-19T19:05:00-03:00',
      registradaEm: '2026-10-19T19:05:00-03:00',
      justificativa: null,
    },
  ],
  inscricoesConfirmadas: ['p-carla', 'p-diego', 'p-elisa', 'p-fabio'],
  foraDaJanela: false,
  limiteManuaisAtingido: false,
  codigoRejeitado: false,
  sincronizacaoTardia: false,
  atividades: [
    {
      id: 'atv_1',
      titulo: 'Minicurso Flutter',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      ocupadas: 15,
      vagasRestantes: 5,
      emEspera: 0,
      cargaHorariaMinutos: 360,
      situacao: 'prevista',
      encontros: [
        { id: 'enc_1', inicio: '2026-10-19T14:00:00-03:00', fim: '2026-10-19T17:00:00-03:00' },
      ],
    },
    {
      id: 'atv_2',
      titulo: 'Minicurso Python Avançado',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 1,
      ocupadas: 1,
      vagasRestantes: 0,
      emEspera: 2,
      cargaHorariaMinutos: 180,
      situacao: 'prevista',
      encontros: [
        { id: 'enc_2', inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T17:00:00-03:00' },
      ],
    },
  ],
  inscricoes: [
    {
      id: 'ins_01',
      atividadeId: 'atv_1',
      participanteId: 'p-carla',
      status: 'confirmada',
      posicaoNaEspera: null,
      convocadaAte: null,
      criadaEm: '2026-10-13T09:00:00-03:00',
    },
  ],
};

export function resetMockState() {
  mockState.codigoAtual = 'K7M2QX';
  mockState.proximoCodigo = 'A9B3CD';
  mockState.trocaEm = new Date(Date.now() + 45000).toISOString();
  mockState.validoAte = new Date(Date.now() + 105000).toISOString();
  mockState.presencas = [
    {
      id: 'pre_00000001',
      encontroId: 'enc_1',
      participanteId: 'p-diego',
      origem: 'qr',
      lidoEm: '2026-10-19T19:05:00-03:00',
      registradaEm: '2026-10-19T19:05:00-03:00',
      justificativa: null,
    },
  ];
  mockState.foraDaJanela = false;
  mockState.limiteManuaisAtingido = false;
  mockState.codigoRejeitado = false;
  mockState.sincronizacaoTardia = false;
  mockState.atividades = [
    {
      id: 'atv_1',
      titulo: 'Minicurso Flutter',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      ocupadas: 15,
      vagasRestantes: 5,
      emEspera: 0,
      cargaHorariaMinutos: 360,
      situacao: 'prevista',
      encontros: [
        { id: 'enc_1', inicio: '2026-10-19T14:00:00-03:00', fim: '2026-10-19T17:00:00-03:00' },
      ],
    },
    {
      id: 'atv_2',
      titulo: 'Minicurso Python Avançado',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 1,
      ocupadas: 1,
      vagasRestantes: 0,
      emEspera: 2,
      cargaHorariaMinutos: 180,
      situacao: 'prevista',
      encontros: [
        { id: 'enc_2', inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T17:00:00-03:00' },
      ],
    },
  ];
  mockState.inscricoes = [
    {
      id: 'ins_01',
      atividadeId: 'atv_1',
      participanteId: 'p-carla',
      status: 'confirmada',
      posicaoNaEspera: null,
      convocadaAte: null,
      criadaEm: '2026-10-13T09:00:00-03:00',
    },
  ];
}

export const handlers = [
  // GET /encontros/:id/codigo (Fatia 1)
  http.get('http://localhost:3000/encontros/:id/codigo', ({ params, request }) => {
    const usuarioId = request.headers.get('X-Usuario');
    if (!usuarioId) {
      return HttpResponse.json(
        { erro: 'USUARIO_DESCONHECIDO', mensagem: 'Cabeçalho X-Usuario ausente' },
        { status: 401 }
      );
    }
    if (!usuarioId.startsWith('org-')) {
      return HttpResponse.json(
        { erro: 'SOMENTE_ORGANIZACAO', mensagem: 'Apenas organização pode consultar o código' },
        { status: 403 }
      );
    }
    if (mockState.foraDaJanela) {
      return HttpResponse.json(
        { erro: 'FORA_DA_JANELA', mensagem: 'Consulta fora da janela permitida' },
        { status: 422 }
      );
    }

    return HttpResponse.json({
      encontroId: params.id,
      codigo: mockState.codigoAtual,
      trocaEm: mockState.trocaEm,
      validoAte: mockState.validoAte,
    });
  }),

  // POST /encontros/:id/presencas (Fatia 2 & Fatia 3)
  http.post('http://localhost:3000/encontros/:id/presencas', async ({ params, request }) => {
    const usuarioId = request.headers.get('X-Usuario');
    if (!usuarioId) {
      return HttpResponse.json(
        { erro: 'USUARIO_DESCONHECIDO', mensagem: 'Cabeçalho X-Usuario ausente' },
        { status: 401 }
      );
    }
    if (usuarioId.startsWith('org-')) {
      return HttpResponse.json(
        { erro: 'SOMENTE_PARTICIPANTE', mensagem: 'Apenas participante pode registrar presença por esta rota' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { codigo, lidoEm } = body;

    // Idempotência (R5 / R10)
    const presencaExistente = mockState.presencas.find(
      (p) => p.encontroId === params.id && p.participanteId === usuarioId
    );
    if (presencaExistente) {
      return HttpResponse.json(presencaExistente, { status: 200 });
    }

    // Inscrição confirmada (R4)
    if (!mockState.inscricoesConfirmadas.includes(usuarioId)) {
      return HttpResponse.json(
        { erro: 'NAO_INSCRITO', mensagem: 'Participante não possui inscrição confirmada' },
        { status: 403 }
      );
    }

    // Sincronização tardia (R6 / R10)
    if (mockState.sincronizacaoTardia) {
      return HttpResponse.json(
        { erro: 'SINCRONIZACAO_TARDIA', mensagem: 'Sincronização recebida mais de 2 horas após o término' },
        { status: 422 }
      );
    }

    // Fora da janela (R3 / R10)
    if (mockState.foraDaJanela) {
      return HttpResponse.json(
        { erro: 'FORA_DA_JANELA', mensagem: 'Registro fora da janela permitida' },
        { status: 422 }
      );
    }

    // Código inválido (R2 / R10)
    if (mockState.codigoRejeitado || codigo !== mockState.codigoAtual) {
      return HttpResponse.json(
        { erro: 'CODIGO_INVALIDO', mensagem: 'Código QR inválido ou expirado' },
        { status: 422 }
      );
    }

    const novaPresenca = {
      id: `pre_${Math.random().toString(16).slice(2, 10)}`,
      encontroId: params.id,
      participanteId: usuarioId,
      origem: lidoEm ? 'qr_offline' : 'qr',
      lidoEm: lidoEm || new Date().toISOString(),
      registradaEm: new Date().toISOString(),
      justificativa: null,
    };

    mockState.presencas.push(novaPresenca);
    return HttpResponse.json(novaPresenca, { status: 201 });
  }),

  // POST /encontros/:id/presencas/manual (Fatia 4)
  http.post('http://localhost:3000/encontros/:id/presencas/manual', async ({ params, request }) => {
    const usuarioId = request.headers.get('X-Usuario');
    if (!usuarioId) {
      return HttpResponse.json(
        { erro: 'USUARIO_DESCONHECIDO', mensagem: 'Cabeçalho X-Usuario ausente' },
        { status: 401 }
      );
    }
    if (!usuarioId.startsWith('org-')) {
      return HttpResponse.json(
        { erro: 'SOMENTE_ORGANIZACAO', mensagem: 'Apenas organização pode registrar presença manual' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { participanteId, justificativa } = body;

    // R11 item 1 / R8: Justificativa obrigatória (mínimo 10 caracteres após trim)
    if (!justificativa || typeof justificativa !== 'string' || justificativa.trim().length < 10) {
      return HttpResponse.json(
        { erro: 'JUSTIFICATIVA_OBRIGATORIA', mensagem: 'A justificativa deve conter no mínimo 10 caracteres' },
        { status: 422 }
      );
    }

    // Idempotência (R5 / R11)
    const presencaExistente = mockState.presencas.find(
      (p) => p.encontroId === params.id && p.participanteId === participanteId
    );
    if (presencaExistente) {
      return HttpResponse.json(presencaExistente, { status: 200 });
    }

    // Inscrição confirmada (R4 / R11)
    if (!mockState.inscricoesConfirmadas.includes(participanteId)) {
      return HttpResponse.json(
        { erro: 'NAO_INSCRITO', mensagem: 'Participante não possui inscrição confirmada' },
        { status: 403 }
      );
    }

    // Fora da janela estendida (R7 / R11)
    if (mockState.foraDaJanela) {
      return HttpResponse.json(
        { erro: 'FORA_DA_JANELA', mensagem: 'Lançamento manual fora da janela estendida' },
        { status: 422 }
      );
    }

    // Limite de manuais (R9 / R11)
    if (mockState.limiteManuaisAtingido) {
      return HttpResponse.json(
        { erro: 'LIMITE_DE_MANUAIS', mensagem: 'Limite de presenças manuais atingido para este encontro' },
        { status: 422 }
      );
    }

    const novaPresenca = {
      id: `pre_${Math.random().toString(16).slice(2, 10)}`,
      encontroId: params.id,
      participanteId,
      origem: 'manual',
      lidoEm: new Date().toISOString(),
      registradaEm: new Date().toISOString(),
      justificativa: justificativa.trim(),
    };

    mockState.presencas.push(novaPresenca);
    return HttpResponse.json(novaPresenca, { status: 201 });
  }),

  // GET /encontros/:id/presencas (Fatia 5)
  http.get('http://localhost:3000/encontros/:id/presencas', ({ params, request }) => {
    const usuarioId = request.headers.get('X-Usuario');
    if (!usuarioId) {
      return HttpResponse.json(
        { erro: 'USUARIO_DESCONHECIDO', mensagem: 'Cabeçalho X-Usuario ausente' },
        { status: 401 }
      );
    }
    if (!usuarioId.startsWith('org-')) {
      return HttpResponse.json(
        { erro: 'SOMENTE_ORGANIZACAO', mensagem: 'Apenas organização pode consultar a lista de presenças' },
        { status: 403 }
      );
    }

    const filtradas = mockState.presencas.filter((p) => p.encontroId === params.id);
    return HttpResponse.json(filtradas);
  }),

  // ==========================================
  // Mock Handlers M2
  // ==========================================

  // GET /atividades
  http.get('http://localhost:3000/atividades', () => {
    return HttpResponse.json(mockState.atividades);
  }),

  // GET /atividades/:id
  http.get('http://localhost:3000/atividades/:id', ({ params }) => {
    const atv = mockState.atividades.find((a) => a.id === params.id);
    if (!atv) {
      return HttpResponse.json({ erro: 'NAO_ENCONTRADO' }, { status: 404 });
    }
    return HttpResponse.json(atv);
  }),

  // GET /inscricoes
  http.get('http://localhost:3000/inscricoes', ({ request }) => {
    const usuarioId = request.headers.get('X-Usuario');
    if (!usuarioId) {
      return HttpResponse.json({ erro: 'USUARIO_DESCONHECIDO' }, { status: 401 });
    }
    const filtradas = mockState.inscricoes.filter((i) =>
      usuarioId.startsWith('org-') ? true : i.participanteId === usuarioId
    );
    return HttpResponse.json(filtradas);
  }),

  // POST /atividades/:id/inscricoes
  http.post('http://localhost:3000/atividades/:id/inscricoes', ({ params, request }) => {
    const usuarioId = request.headers.get('X-Usuario');
    if (!usuarioId) {
      return HttpResponse.json({ erro: 'USUARIO_DESCONHECIDO' }, { status: 401 });
    }
    const atv = mockState.atividades.find((a) => a.id === params.id);
    if (!atv) {
      return HttpResponse.json({ erro: 'NAO_ENCONTRADO' }, { status: 404 });
    }

    const status = atv.vagasRestantes > 0 ? 'confirmada' : 'em_espera';
    const posicaoNaEspera = status === 'em_espera' ? atv.emEspera + 1 : null;

    const nova = {
      id: `ins_${Math.random().toString(16).slice(2, 10)}`,
      atividadeId: atv.id,
      participanteId: usuarioId,
      status,
      posicaoNaEspera,
      convocadaAte: null,
      criadaEm: new Date().toISOString(),
    };

    mockState.inscricoes.push(nova);
    if (status === 'confirmada') {
      atv.ocupadas += 1;
      atv.vagasRestantes -= 1;
    } else {
      atv.emEspera += 1;
    }

    return HttpResponse.json(nova, { status: 201 });
  }),

  // POST /inscricoes/:id/cancelamento
  http.post('http://localhost:3000/inscricoes/:id/cancelamento', ({ params, request }) => {
    const usuarioId = request.headers.get('X-Usuario');
    const ins = mockState.inscricoes.find((i) => i.id === params.id);
    if (!ins || ins.participanteId !== usuarioId) {
      return HttpResponse.json({ erro: 'NAO_ENCONTRADO' }, { status: 404 });
    }

    ins.status = 'cancelada';
    ins.posicaoNaEspera = null;
    ins.convocadaAte = null;

    return HttpResponse.json(ins);
  }),

  // POST /inscricoes/:id/confirmacao
  http.post('http://localhost:3000/inscricoes/:id/confirmacao', ({ params, request }) => {
    const usuarioId = request.headers.get('X-Usuario');
    const ins = mockState.inscricoes.find((i) => i.id === params.id);
    if (!ins || ins.participanteId !== usuarioId) {
      return HttpResponse.json({ erro: 'NAO_ENCONTRADO' }, { status: 404 });
    }

    ins.status = 'confirmada';
    ins.posicaoNaEspera = null;
    ins.convocadaAte = null;

    return HttpResponse.json(ins);
  }),
];
