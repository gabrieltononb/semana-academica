const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { criarServidor } = require('../src/servidor.js');

describe('M3 Fatia 4 — Presença Manual e Controle de Teto', () => {
  let servidor;
  let baseUrl;

  before(async () => {
    process.env.MODO_TESTE = '1';
    const app = criarServidor();
    await new Promise((resolve) => {
      servidor = app.listen(0, () => {
        baseUrl = `http://localhost:${servidor.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => servidor.close(resolve));
  });

  // Critério 36 (R13)
  it('recusa registro de presenca manual chamado por participante com 403 SOMENTE_ORGANIZACAO', async () => {
    const res = await fetch(`${baseUrl}/encontros/enc_qualquer/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({
        participanteId: 'p-diego',
        justificativa: 'Participante sem bateria no celular'
      })
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.erro, 'SOMENTE_ORGANIZACAO');
  });

  it('recusa registro de presenca manual para encontro inexistente com 404 NAO_ENCONTRADO', async () => {
    const res = await fetch(`${baseUrl}/encontros/enc_inexistente/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        participanteId: 'p-carla',
        justificativa: 'Participante sem bateria no smartphone durante o evento'
      })
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.erro, 'NAO_ENCONTRADO');
  });

  // Critério 24 (R8, R11)
  it('recusa presenca manual sem justificativa ou com menos de 10 caracteres apos trim com 422 JUSTIFICATIVA_OBRIGATORIA', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop Docker',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    const casos = [
      { participanteId: 'p-carla' }, // sem justificativa
      { participanteId: 'p-carla', justificativa: null }, // nula
      { participanteId: 'p-carla', justificativa: '   123456789   ' }, // 9 caracteres após trim
      { participanteId: 'p-carla', justificativa: 'curta' } // < 10 caracteres
    ];

    for (const payload of casos) {
      const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Usuario': 'org-ana'
        },
        body: JSON.stringify(payload)
      });
      assert.equal(res.status, 422);
      const body = await res.json();
      assert.equal(body.erro, 'JUSTIFICATIVA_OBRIGATORIA');
    }
  });

  // Critério 16 (R5, R11)
  it('retorna 200 OK com presenca original para participante que ja possui presenca registrada (idempotencia)', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop Docker',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    await fetch(`${baseUrl}/_teste/inscricoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        atividadeId: atv.id,
        participanteId: 'p-carla',
        status: 'confirmada'
      })
    });

    // Registra presença prévia via QR online às 19:05:00
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:05:00-03:00' })
    });
    const resCodigo = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const { codigo } = await resCodigo.json();

    const resPresenca = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({ codigo })
    });
    assert.equal(resPresenca.status, 201);
    const presencaOriginal = await resPresenca.json();

    // Agora a organização tenta lançar presença manual para p-carla
    const resManual = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        participanteId: 'p-carla',
        justificativa: 'Participante estava presente na sala'
      })
    });

    assert.equal(resManual.status, 200);
    const presencaRetornada = await resManual.json();
    assert.deepEqual(presencaRetornada, presencaOriginal);
  });

  // Critério 14 (R4, R11)
  it('recusa presenca manual para participante sem inscricao ou com inscricao nao confirmada com 403 NAO_INSCRITO', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop Docker',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    // Cenário 1: Sem inscrição alguma
    const resSem = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        participanteId: 'p-carla',
        justificativa: 'Participante sem bateria no smartphone'
      })
    });
    assert.equal(resSem.status, 403);
    const bodySem = await resSem.json();
    assert.equal(bodySem.erro, 'NAO_INSCRITO');

    // Cenário 2: Inscrições com status cancelada, em_espera, convocada, expirada
    const statusInvalidos = ['cancelada', 'em_espera', 'convocada', 'expirada'];
    const participantes = ['p-diego', 'p-elisa', 'p-fabio', 'p-gabriela'];

    for (let i = 0; i < statusInvalidos.length; i++) {
      const status = statusInvalidos[i];
      const participanteId = participantes[i];

      await fetch(`${baseUrl}/_teste/inscricoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          atividadeId: atv.id,
          participanteId,
          status
        })
      });

      const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Usuario': 'org-ana'
        },
        body: JSON.stringify({
          participanteId,
          justificativa: 'Participante sem bateria no smartphone'
        })
      });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.erro, 'NAO_INSCRITO');
    }
  });

  // Critério 23 (R7, R11)
  it('recusa presenca manual antes da janela estendida (inicio - 15min) com 422 FORA_DA_JANELA', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop Docker',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    await fetch(`${baseUrl}/_teste/inscricoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        atividadeId: atv.id,
        participanteId: 'p-carla',
        status: 'confirmada'
      })
    });

    // 18:44:59 (15 min e 1s antes do início às 19:00)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T18:44:59-03:00' })
    });

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        participanteId: 'p-carla',
        justificativa: 'Participante chegou adiantado sem aparelho celular'
      })
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.erro, 'FORA_DA_JANELA');
  });

  // Critério 22 (R7, R11)
  it('recusa presenca manual apos a janela estendida (mais de 2h apos o fim) com 422 FORA_DA_JANELA', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    // Encontro das 19:00 às 21:00
    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop Docker',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T21:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    await fetch(`${baseUrl}/_teste/inscricoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        atividadeId: atv.id,
        participanteId: 'p-carla',
        status: 'confirmada'
      })
    });

    // 23:00:01 (2h e 1s após o fim às 21:00)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T23:00:01-03:00' })
    });

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        participanteId: 'p-carla',
        justificativa: 'Participante esqueceu de registrar antes de sair'
      })
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.erro, 'FORA_DA_JANELA');
  });

  // Critério 21 (R7, R8, R9)
  it('registra presenca manual com sucesso com 201 Created, origem manual e justificativa preenchida', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    // Encontro das 19:00 às 21:00
    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop Docker',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T21:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    await fetch(`${baseUrl}/_teste/inscricoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        atividadeId: atv.id,
        participanteId: 'p-carla',
        status: 'confirmada'
      })
    });

    const momentoRequisicao = '2026-10-19T22:30:00-03:00';
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: momentoRequisicao })
    });

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        participanteId: 'p-carla',
        justificativa: 'Participante sem bateria durante credenciamento'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.match(body.id, /^pre_[a-f0-9]{8}$/);
    assert.equal(body.encontroId, encontroId);
    assert.equal(body.participanteId, 'p-carla');
    assert.equal(body.origem, 'manual');
    assert.equal(body.lidoEm, momentoRequisicao);
    assert.equal(body.registradaEm, momentoRequisicao);
    assert.equal(body.justificativa, 'Participante sem bateria durante credenciamento');
  });

  // Critérios 25 e 26 (R9, R11)
  it('recusa presenca manual ao atingir teto de 10% arredondado para cima com 422 LIMITE_DE_MANUAIS', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop Docker',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T21:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    // Cadastra 5 inscrições confirmadas -> teto = Math.ceil(5 * 0.1) = 1
    const inscritos = ['p-carla', 'p-diego', 'p-elisa', 'p-fabio', 'p-gabriela'];
    for (const participanteId of inscritos) {
      await fetch(`${baseUrl}/_teste/inscricoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          atividadeId: atv.id,
          participanteId,
          status: 'confirmada'
        })
      });
    }

    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:30:00-03:00' })
    });

    // 1ª manual para p-carla -> deve aceitar (201 Created)
    const res1 = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        participanteId: 'p-carla',
        justificativa: 'Participante sem celular no credenciamento'
      })
    });
    assert.equal(res1.status, 201);

    // 2ª manual para p-diego -> atinge teto (1/1), deve recusar com 422 LIMITE_DE_MANUAIS
    const res2 = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        participanteId: 'p-diego',
        justificativa: 'Participante sem celular no credenciamento'
      })
    });
    assert.equal(res2.status, 422);
    const body2 = await res2.json();
    assert.equal(body2.erro, 'LIMITE_DE_MANUAIS');
  });

  // Critério 31 (R11)
  it('aplica precedencia de R11: justificativa obrigatoria precede nao inscrito', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop Docker',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T21:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    // Participante p-diego NÃO está inscrito; justificativa tem 5 caracteres (curta)
    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        participanteId: 'p-diego',
        justificativa: 'curta'
      })
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.erro, 'JUSTIFICATIVA_OBRIGATORIA');
  });

  // Critério 32 (R11)
  it('aplica precedencia de R11: participante nao inscrito precede fora da janela estendida', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop Docker',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T21:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    // Relógio fora da janela estendida (18:00:00)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T18:00:00-03:00' })
    });

    // Participante p-diego NÃO está inscrito
    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        participanteId: 'p-diego',
        justificativa: 'Participante sem aparelho celular no momento'
      })
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.erro, 'NAO_INSCRITO');
  });

  // Critério 33 (R11)
  it('aplica precedencia de R11: fora da janela estendida precede limite de manuais', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    // Encontro das 19:00 às 21:00
    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop Docker',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T21:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    // 5 inscrições confirmadas -> teto = Math.ceil(5 * 0.1) = 1
    const inscritos = ['p-carla', 'p-diego', 'p-elisa', 'p-fabio', 'p-gabriela'];
    for (const participanteId of inscritos) {
      await fetch(`${baseUrl}/_teste/inscricoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          atividadeId: atv.id,
          participanteId,
          status: 'confirmada'
        })
      });
    }

    // Registra 1 presença manual às 20:00 (dentro da janela) -> atinge o limite
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T20:00:00-03:00' })
    });

    const res1 = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        participanteId: 'p-carla',
        justificativa: 'Participante sem celular no credenciamento'
      })
    });
    assert.equal(res1.status, 201);

    // Relógio avança para 23:05:00 (> 2h após o fim às 21:00)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T23:05:00-03:00' })
    });

    // Tentativa para p-diego fora da janela com limite já atingido
    const res2 = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        participanteId: 'p-diego',
        justificativa: 'Participante sem celular no credenciamento'
      })
    });

    assert.equal(res2.status, 422);
    const body2 = await res2.json();
    assert.equal(body2.erro, 'FORA_DA_JANELA');
  });

  // Critério 25 (R9)
  it('recusa terceira presenca manual em atividade com 20 inscritos confirmados (teto = 2)', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop Docker',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T21:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    // Cria 20 inscrições confirmadas
    for (let i = 1; i <= 20; i++) {
      const partId = i <= 8 ? ['p-carla', 'p-diego', 'p-elisa', 'p-fabio', 'p-gabriela', 'p-heitor', 'p-isadora', 'p-joao'][i - 1] : `p-extra-${i}`;
      await fetch(`${baseUrl}/_teste/inscricoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          atividadeId: atv.id,
          participanteId: partId,
          status: 'confirmada'
        })
      });
    }

    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T20:00:00-03:00' })
    });

    // 1ª manual (p-carla) -> aceita
    const res1 = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        participanteId: 'p-carla',
        justificativa: 'Participante sem bateria durante o evento'
      })
    });
    assert.equal(res1.status, 201);

    // 2ª manual (p-diego) -> aceita
    const res2 = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        participanteId: 'p-diego',
        justificativa: 'Participante sem bateria durante o evento'
      })
    });
    assert.equal(res2.status, 201);

    // 3ª manual (p-elisa) -> excede teto de 2 (Math.ceil(20 * 0.1) = 2) -> 422 LIMITE_DE_MANUAIS
    const res3 = await fetch(`${baseUrl}/encontros/${encontroId}/presencas/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        participanteId: 'p-elisa',
        justificativa: 'Participante sem bateria durante o evento'
      })
    });
    assert.equal(res3.status, 422);
    const body3 = await res3.json();
    assert.equal(body3.erro, 'LIMITE_DE_MANUAIS');
  });
});
