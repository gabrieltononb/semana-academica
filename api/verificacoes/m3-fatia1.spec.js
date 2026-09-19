const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { criarServidor } = require('../src/servidor.js');

describe('M3 Fatia 1 — Geração e Rotação de Código QR', () => {
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

  it('recusa consulta ao codigo sem cabecalho X-Usuario com 401 USUARIO_DESCONHECIDO', async () => {
    const res = await fetch(`${baseUrl}/encontros/enc_qualquer/codigo`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.erro, 'USUARIO_DESCONHECIDO');
  });

  it('recusa consulta ao codigo por participante com 403 SOMENTE_ORGANIZACAO', async () => {
    const res = await fetch(`${baseUrl}/encontros/enc_qualquer/codigo`, {
      headers: { 'X-Usuario': 'p-carla' }
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.erro, 'SOMENTE_ORGANIZACAO');
  });

  it('recusa consulta a encontro inexistente com 404 NAO_ENCONTRADO', async () => {
    const res = await fetch(`${baseUrl}/encontros/enc_inexistente/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.erro, 'NAO_ENCONTRADO');
  });

  it('permite consulta na borda inferior da janela (15 min antes) com 200 OK e CodigoDoEncontro', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    // Cria atividade com encontro iniciando às 19:00
    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Palestra de Abertura',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 200,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    // Ajusta relógio para 18:45:00 (15 min antes, borda inferior)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T18:45:00-03:00' })
    });

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.encontroId, encontroId);
    assert.equal(typeof body.codigo, 'string');
    assert.equal(body.codigo.length, 6);
    assert.match(body.codigo, /^[A-Z0-9]{6}$/);
    assert.ok(body.trocaEm);
    assert.ok(body.validoAte);
  });

  it('recusa consulta 15 min e 1s antes do inicio com 422 FORA_DA_JANELA', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Palestra de Abertura',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 200,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    // 18:44:59 (15 min e 1s antes)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T18:44:59-03:00' })
    });

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.erro, 'FORA_DA_JANELA');
  });

  it('permite consulta na borda superior da janela (30 min apos inicio) com 200 OK', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Palestra de Abertura',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 200,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    // 19:30:00 (30 min após o início)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:30:00-03:00' })
    });

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.encontroId, encontroId);
    assert.equal(body.codigo.length, 6);
  });

  it('recusa consulta 30 min e 1s apos inicio com 422 FORA_DA_JANELA', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Palestra de Abertura',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 200,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    // 19:30:01 (30 min e 1s após o início)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:30:01-03:00' })
    });

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.erro, 'FORA_DA_JANELA');
  });

  it('recusa consulta dentro da janela para atividade cancelada com 422 FORA_DA_JANELA', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Palestra Cancelada',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 200,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    // Cancela a atividade
    await fetch(`${baseUrl}/atividades/${atv.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'org-ana' }
    });

    // Coloca relógio dentro da janela (19:00:00)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:00:00-03:00' })
    });

    const res = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.erro, 'FORA_DA_JANELA');
  });

  it('rotaciona codigo a cada minuto e calcula trocaEm e validoAte conforme R2', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Palestra de Abertura',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 200,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' },
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontro1 = atv.encontros[0].id;
    const encontro2 = atv.encontros[1].id;

    // Emissão às 19:05:20
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:05:20-03:00' })
    });

    const res1 = await fetch(`${baseUrl}/encontros/${encontro1}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.trocaEm, '2026-10-19T19:06:00-03:00');
    assert.equal(body1.validoAte, '2026-10-19T19:07:00-03:00');

    // Mesma janela (19:05:59) deve gerar o mesmo código
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:05:59-03:00' })
    });

    const res2 = await fetch(`${baseUrl}/encontros/${encontro1}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const body2 = await res2.json();
    assert.equal(body2.codigo, body1.codigo);

    // Próximo minuto (19:06:00) deve rotacionar o código
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:06:00-03:00' })
    });

    const res3 = await fetch(`${baseUrl}/encontros/${encontro1}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const body3 = await res3.json();
    assert.notEqual(body3.codigo, body1.codigo);
    assert.equal(body3.trocaEm, '2026-10-19T19:07:00-03:00');
    assert.equal(body3.validoAte, '2026-10-19T19:08:00-03:00');

    // Encontro diferente no mesmo minuto gera código diferente
    const res4 = await fetch(`${baseUrl}/encontros/${encontro2}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const body4 = await res4.json();
    assert.notEqual(body4.codigo, body3.codigo);
  });
});
