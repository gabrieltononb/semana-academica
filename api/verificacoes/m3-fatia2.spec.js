const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { criarServidor } = require('../src/servidor.js');

describe('M3 Fatia 2 — Registro de Presença Online por Participante', () => {
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

  it('recusa registro de presenca chamado por organizacao com 403 SOMENTE_PARTICIPANTE', async () => {
    const res = await fetch(`${baseUrl}/encontros/enc_qualquer/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({ codigo: 'K7M2QX' })
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.erro, 'SOMENTE_PARTICIPANTE');
  });

  it('recusa registro de presenca para encontro inexistente com 404 NAO_ENCONTRADO', async () => {
    const res = await fetch(`${baseUrl}/encontros/enc_inexistente/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({ codigo: 'K7M2QX' })
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.erro, 'NAO_ENCONTRADO');
  });

  it('recusa registro de presenca para participante sem inscricao com 403 NAO_INSCRITO', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop React',
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

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({ codigo: 'K7M2QX' })
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.erro, 'NAO_INSCRITO');
  });

  it('recusa registro de presenca para participante com status em_espera, convocada, cancelada ou expirada com 403 NAO_INSCRITO', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop React',
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
      { participanteId: 'p-diego', status: 'em_espera' },
      { participanteId: 'p-elisa', status: 'convocada' },
      { participanteId: 'p-fabio', status: 'cancelada' },
      { participanteId: 'p-gabriela', status: 'expirada' },
    ];

    for (const { participanteId, status } of casos) {
      await fetch(`${baseUrl}/_teste/inscricoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          atividadeId: atv.id,
          participanteId,
          status
        })
      });

      const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Usuario': participanteId
        },
        body: JSON.stringify({ codigo: 'K7M2QX' })
      });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.erro, 'NAO_INSCRITO');
    }
  });

  it('recusa registro de presenca online antes da janela com 422 FORA_DA_JANELA', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop React',
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

    // Relógio em 18:44:59 (15 min e 1s antes do início)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T18:44:59-03:00' })
    });

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({ codigo: 'K7M2QX' })
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.erro, 'FORA_DA_JANELA');
  });

  it('recusa registro de presenca online apos a janela (30 min e 1s apos inicio) com 422 FORA_DA_JANELA', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop React',
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

    // Relógio em 19:30:01 (30 min e 1s após o início)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:30:01-03:00' })
    });

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({ codigo: 'K7M2QX' })
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.erro, 'FORA_DA_JANELA');
  });

  it('registra presenca online no minuto atual com 201 Created e objeto Presenca', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop React',
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

    const momento = '2026-10-19T19:05:10-03:00';
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: momento })
    });

    const resCodigo = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const { codigo } = await resCodigo.json();

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({ codigo })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.match(body.id, /^pre_[a-f0-9]{8}$/);
    assert.equal(body.encontroId, encontroId);
    assert.equal(body.participanteId, 'p-carla');
    assert.equal(body.origem, 'qr');
    assert.equal(body.lidoEm, momento);
    assert.equal(body.registradaEm, momento);
    assert.equal(body.justificativa, null);
  });

  it('registra presenca online com codigo do minuto anterior (grace period) com 201 Created', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop React',
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

    // Código emitido no minuto 19:05:00
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:05:00-03:00' })
    });
    const resCodigo = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const { codigo: codigo1905 } = await resCodigo.json();

    // Relógio avança para 19:06:15 (minuto seguinte, dentro do grace period)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:06:15-03:00' })
    });

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({ codigo: codigo1905 })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.encontroId, encontroId);
    assert.equal(body.participanteId, 'p-carla');
    assert.equal(body.origem, 'qr');
    assert.equal(body.lidoEm, '2026-10-19T19:06:15-03:00');
  });

  it('recusa presenca online com codigo expirado (2 min apos) ou de outro encontro com 422 CODIGO_INVALIDO', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop React',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontro1 = atv.encontros[0].id;
    const encontro2 = atv.encontros[1].id;

    await fetch(`${baseUrl}/_teste/inscricoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        atividadeId: atv.id,
        participanteId: 'p-carla',
        status: 'confirmada'
      })
    });

    // Código gerado no minuto 19:05 para encontro 1
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:05:00-03:00' })
    });
    const resCod1 = await fetch(`${baseUrl}/encontros/${encontro1}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const { codigo: codigo1905 } = await resCod1.json();

    // Código gerado para encontro 2 (outro encontro)
    const resCod2 = await fetch(`${baseUrl}/encontros/${encontro2}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const { codigo: codigoEncontro2 } = await resCod2.json();

    // Cenário 1: 19:07:01 com código de 19:05 (expirado, fora do grace period)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:07:01-03:00' })
    });

    const resExp = await fetch(`${baseUrl}/encontros/${encontro1}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({ codigo: codigo1905 })
    });
    assert.equal(resExp.status, 422);
    const bodyExp = await resExp.json();
    assert.equal(bodyExp.erro, 'CODIGO_INVALIDO');

    // Cenário 2: tentativa de usar código de outro encontro
    const resOutro = await fetch(`${baseUrl}/encontros/${encontro1}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({ codigo: codigoEncontro2 })
    });
    assert.equal(resOutro.status, 422);
    const bodyOutro = await resOutro.json();
    assert.equal(bodyOutro.erro, 'CODIGO_INVALIDO');
  });

  it('retorna 200 OK com presenca original para participante que ja possui presenca (idempotencia)', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop React',
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

    const momentoOriginal = '2026-10-19T19:05:10-03:00';
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: momentoOriginal })
    });
    const resCod1 = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const { codigo: codigo1 } = await resCod1.json();

    const resPrimeiro = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({ codigo: codigo1 })
    });
    assert.equal(resPrimeiro.status, 201);
    const presencaOriginal = await resPrimeiro.json();

    // 2º envio: relógio avançou para 19:40:00 (fora da janela) com outro código
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:40:00-03:00' })
    });

    const resRepetido = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({ codigo: 'QUALQU' })
    });

    assert.equal(resRepetido.status, 200);
    const presencaRepetida = await resRepetido.json();
    assert.deepEqual(presencaRepetida, presencaOriginal);
  });

  it('aplica precedencia de R10: recusa com 403 NAO_INSCRITO participante nao inscrito fora da janela com codigo invalido', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop React',
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

    // Participante p-diego não está inscrito; relógio fora da janela (18:30:00) e código inválido
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T18:30:00-03:00' })
    });

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-diego'
      },
      body: JSON.stringify({ codigo: 'ERRADO' })
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.erro, 'NAO_INSCRITO');
  });

  it('aplica precedencia de R10: recusa com 422 FORA_DA_JANELA requisicao fora da janela com codigo invalido', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop React',
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

    // Relógio fora da janela (18:30:00)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T18:30:00-03:00' })
    });

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({ codigo: 'ERRADO' })
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.erro, 'FORA_DA_JANELA');
  });

  it('recusa registro de presenca sem cabecalho X-Usuario ou usuario inexistente com 401 USUARIO_DESCONHECIDO', async () => {
    const resSem = await fetch(`${baseUrl}/encontros/enc_qualquer/presencas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: 'K7M2QX' })
    });
    assert.equal(resSem.status, 401);
    const bodySem = await resSem.json();
    assert.equal(bodySem.erro, 'USUARIO_DESCONHECIDO');

    const resInex = await fetch(`${baseUrl}/encontros/enc_qualquer/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'usuario-inexistente'
      },
      body: JSON.stringify({ codigo: 'K7M2QX' })
    });
    assert.equal(resInex.status, 401);
    const bodyInex = await resInex.json();
    assert.equal(bodyInex.erro, 'USUARIO_DESCONHECIDO');
  });
});
