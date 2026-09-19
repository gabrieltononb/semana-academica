const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { criarServidor } = require('../src/servidor.js');

describe('M3 Fatia 5 — Listagem e Ordenação de Presenças', () => {
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
  it('recusa listagem de presencas chamada por participante com 403 SOMENTE_ORGANIZACAO', async () => {
    const res = await fetch(`${baseUrl}/encontros/enc_qualquer/presencas`, {
      headers: { 'X-Usuario': 'p-carla' }
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.erro, 'SOMENTE_ORGANIZACAO');
  });

  it('recusa listagem de presencas para encontro inexistente com 404 NAO_ENCONTRADO', async () => {
    const res = await fetch(`${baseUrl}/encontros/enc_inexistente/presencas`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.erro, 'NAO_ENCONTRADO');
  });

  // Critério 34 (R12)
  it('retorna lista de presencas ordenada cronologicamente por registradaEm ascendente', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Arquitetura de Software',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 50,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T22:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    for (const participanteId of ['p-carla', 'p-diego', 'p-elisa']) {
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

    // Registra 1ª presença às 19:20 (p-elisa)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:20:00-03:00' })
    });
    const resCod1 = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const { codigo: cod1 } = await resCod1.json();
    await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Usuario': 'p-elisa' },
      body: JSON.stringify({ codigo: cod1 })
    });

    // Registra 2ª presença às 19:05 (p-carla)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:05:00-03:00' })
    });
    const resCod2 = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const { codigo: cod2 } = await resCod2.json();
    await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo: cod2 })
    });

    // Registra 3ª presença às 19:12 (p-diego)
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:12:00-03:00' })
    });
    const resCod3 = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const { codigo: cod3 } = await resCod3.json();
    await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Usuario': 'p-diego' },
      body: JSON.stringify({ codigo: cod3 })
    });

    // Consulta presenças com usuário de organização
    const resList = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    assert.equal(resList.status, 200);
    const lista = await resList.json();
    assert.equal(Array.isArray(lista), true);
    assert.equal(lista.length, 3);

    // Ordem cronológica esperada: 19:05 (p-carla), 19:12 (p-diego), 19:20 (p-elisa)
    assert.equal(lista[0].participanteId, 'p-carla');
    assert.equal(lista[0].registradaEm, '2026-10-19T19:05:00-03:00');
    assert.match(lista[0].id, /^pre_[0-9a-f]{8}$/);
    assert.equal(lista[0].encontroId, encontroId);
    assert.equal(lista[0].origem, 'qr');

    assert.equal(lista[1].participanteId, 'p-diego');
    assert.equal(lista[1].registradaEm, '2026-10-19T19:12:00-03:00');

    assert.equal(lista[2].participanteId, 'p-elisa');
    assert.equal(lista[2].registradaEm, '2026-10-19T19:20:00-03:00');
  });

  // Critério 34 (R12 - Desempate por participanteId)
  it('desempata presencas com mesmo instante registradaEm por participanteId ascendente', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Workshop TypeScript',
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

    for (const participanteId of ['p-joao', 'p-diego', 'p-carla']) {
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

    // Mesmo instante de registro para todos os participantes: 19:10:00
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora: '2026-10-19T19:10:00-03:00' })
    });
    const resCod = await fetch(`${baseUrl}/encontros/${encontroId}/codigo`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    const { codigo } = await resCod.json();

    // Insere na ordem inversa da alfabética: p-joao, p-diego, p-carla
    await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Usuario': 'p-joao' },
      body: JSON.stringify({ codigo })
    });

    await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Usuario': 'p-diego' },
      body: JSON.stringify({ codigo })
    });

    await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Usuario': 'p-carla' },
      body: JSON.stringify({ codigo })
    });

    const resList = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    assert.equal(resList.status, 200);
    const lista = await resList.json();
    assert.equal(lista.length, 3);

    // Todos têm o mesmo registradaEm
    assert.equal(lista[0].registradaEm, '2026-10-19T19:10:00-03:00');
    assert.equal(lista[1].registradaEm, '2026-10-19T19:10:00-03:00');
    assert.equal(lista[2].registradaEm, '2026-10-19T19:10:00-03:00');

    // Desempate alfabético ascendente: p-carla, p-diego, p-joao
    assert.equal(lista[0].participanteId, 'p-carla');
    assert.equal(lista[1].participanteId, 'p-diego');
    assert.equal(lista[2].participanteId, 'p-joao');
  });

  // Critério 35 (R13)
  it('recusa listagem de presencas sem cabecalho X-Usuario ou usuario inexistente com 401 USUARIO_DESCONHECIDO', async () => {
    const resSemHeader = await fetch(`${baseUrl}/encontros/enc_qualquer/presencas`);
    assert.equal(resSemHeader.status, 401);
    const bodySemHeader = await resSemHeader.json();
    assert.equal(bodySemHeader.erro, 'USUARIO_DESCONHECIDO');

    const resInexistente = await fetch(`${baseUrl}/encontros/enc_qualquer/presencas`, {
      headers: { 'X-Usuario': 'usuario-inexistente' }
    });
    assert.equal(resInexistente.status, 401);
    const bodyInexistente = await resInexistente.json();
    assert.equal(bodyInexistente.erro, 'USUARIO_DESCONHECIDO');
  });

  it('retorna lista vazia com 200 OK quando encontro nao possui presencas', async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });

    const resAtv = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': 'org-ana'
      },
      body: JSON.stringify({
        titulo: 'Mesa Redonda IA',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T19:00:00-03:00', fim: '2026-10-19T21:00:00-03:00' }
        ]
      })
    });
    const atv = await resAtv.json();
    const encontroId = atv.encontros[0].id;

    const resList = await fetch(`${baseUrl}/encontros/${encontroId}/presencas`, {
      headers: { 'X-Usuario': 'org-ana' }
    });
    assert.equal(resList.status, 200);
    const lista = await resList.json();
    assert.deepEqual(lista, []);
  });
});
