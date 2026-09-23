const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { criarServidor } = require('../src/servidor.js');

describe('M3 Fatia 3 — Leitura Offline e Sincronização Resiliente', () => {
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

  // Critério 17 (R6)
  it('registra presenca offline dentro da janela com 201 Created e origem qr_offline', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    // Encontro das 19:00 às 22:00
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

    // Pega o código gerado às 19:10:00
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:10:00-03:00' })
    });
    const resCodigo = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const { codigo } = await resCodigo.json();

    // Sincronização enviada às 20:30:00 com lidoEm às 19:10:00
    const momentoEnvio = '2026-10-19T20:30:00-03:00';
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: momentoEnvio })
    });

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({
        codigo,
        lidoEm: '2026-10-19T19:10:00-03:00'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.match(body.id, /^pre_[a-f0-9]{8}$/);
    assert.equal(body.encontroId, encontroId);
    assert.equal(body.participanteId, 'p-carla');
    assert.equal(body.origem, 'qr_offline');
    assert.equal(body.lidoEm, '2026-10-19T19:10:00-03:00');
    assert.equal(body.registradaEm, momentoEnvio);
    assert.equal(body.justificativa, null);
  });

  // Critério 18 (R6)
  it('ajusta lidoEm adiantado para o horario da requisicao em presenca offline com 201 Created', async () => {
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

    // Horário de recebimento da requisição pelo sistema: 19:15:00
    const momentoRecebimento = '2026-10-19T19:15:00-03:00';
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: momentoRecebimento })
    });

    // Código válido no horário de recebimento (19:15)
    const resCodigo = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const { codigo } = await resCodigo.json();

    // Celular do usuário está adiantado em 19:20:00
    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({
        codigo,
        lidoEm: '2026-10-19T19:20:00-03:00'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.match(body.id, /^pre_[a-f0-9]{8}$/);
    assert.equal(body.encontroId, encontroId);
    assert.equal(body.participanteId, 'p-carla');
    assert.equal(body.origem, 'qr_offline');
    assert.equal(body.lidoEm, momentoRecebimento);
    assert.equal(body.registradaEm, momentoRecebimento);
    assert.equal(body.justificativa, null);
  });

  // Critério 19 (R6)
  it('recusa sincronizacao offline apos 2h do termino do encontro com 422 SINCRONIZACAO_TARDIA', async () => {
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

    // Código válido às 19:10:00
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:10:00-03:00' })
    });
    const resCodigo = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const { codigo } = await resCodigo.json();

    // Sincronização enviada às 23:00:01 (mais de 2h após o fim às 21:00)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T23:00:01-03:00' })
    });

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({
        codigo,
        lidoEm: '2026-10-19T19:10:00-03:00'
      })
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.erro, 'SINCRONIZACAO_TARDIA');
  });

  // Critério 20 (R6, R10)
  it('recusa presenca offline com leitura fora da janela com 422 FORA_DA_JANELA', async () => {
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

    // Envio às 20:00:00 (dentro de fim + 2h)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T20:00:00-03:00' })
    });

    // Leitura offline feita às 19:40:00 (fora da janela [18:45, 19:30])
    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({
        codigo: 'K7M2QX',
        lidoEm: '2026-10-19T19:40:00-03:00'
      })
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.erro, 'FORA_DA_JANELA');
  });

  // Critério 29 (R10)
  it('aplica precedencia de R10: sincronizacao tardia precede fora da janela e codigo invalido', async () => {
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

    // Sincronização enviada às 23:05:00 (> 2h após o fim às 21:00)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T23:05:00-03:00' })
    });

    // lidoEm fora da janela (19:45) e código inválido (ERRADO)
    const res = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'p-carla'
      },
      body: JSON.stringify({
        codigo: 'ERRADO',
        lidoEm: '2026-10-19T19:45:00-03:00'
      })
    });

    // Deve retornar 422 SINCRONIZACAO_TARDIA (e não FORA_DA_JANELA nem CODIGO_INVALIDO)
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.erro, 'SINCRONIZACAO_TARDIA');
  });
});
