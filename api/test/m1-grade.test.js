import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarApp } from '../src/app.js';
import { criarBanco } from '../src/banco.js';

describe('Módulo 1 — Fatia 1: Infraestrutura e Salas', () => {
  let app;

  beforeEach(async () => {
    process.env.MODO_TESTE = '1';
    app = criarApp({ database: ':memory:' });
    await request(app).post('/_teste/reset');
  });

  it('M1-R1: recusa requisição sem X-Usuario', async () => {
    const res = await request(app).get('/salas');
    assert.equal(res.status, 401);
    assert.equal(res.body.erro, 'USUARIO_DESCONHECIDO');
    assert.ok(res.body.mensagem, 'Deve conter mensagem descritiva');
  });

  it('M1-R1: recusa requisição com X-Usuario não cadastrado', async () => {
    const res = await request(app)
      .get('/salas')
      .set('X-Usuario', 'usr_inexistente');
    assert.equal(res.status, 401);
    assert.equal(res.body.erro, 'USUARIO_DESCONHECIDO');
    assert.ok(res.body.mensagem, 'Deve conter mensagem descritiva');
  });

  it('M1-R1: aceita requisição com X-Usuario de participante válido', async () => {
    const res = await request(app)
      .get('/salas')
      .set('X-Usuario', 'p-carla');
    assert.equal(res.status, 200);
  });

  it('M1-R1: rotas de teste são isentas de autenticação X-Usuario sob MODO_TESTE=1', async () => {
    const res = await request(app).get('/_teste/relogio');
    assert.equal(res.status, 200);
    assert.ok(res.body.agora);
  });

  it('M1-R1: permite consultar e avançar relógio em modo de teste', async () => {
    const resGet = await request(app).get('/_teste/relogio');
    assert.equal(resGet.status, 200);
    assert.equal(resGet.body.agora, '2026-10-13T09:00:00-03:00');

    const novoInstante = '2026-10-19T10:00:00-03:00';
    const resPut = await request(app)
      .put('/_teste/relogio')
      .send({ agora: novoInstante });
    assert.equal(resPut.status, 200);
    assert.equal(resPut.body.agora, novoInstante);

    const resGet2 = await request(app).get('/_teste/relogio');
    assert.equal(resGet2.status, 200);
    assert.equal(resGet2.body.agora, novoInstante);
  });

  it('M1-R20: lista salas cadastradas de fábrica com seus dados', async () => {
    const res = await request(app)
      .get('/salas')
      .set('X-Usuario', 'p-carla');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, [
      { id: 'auditorio', nome: 'Auditório Central', capacidade: 200 },
      { id: 'sala-101', nome: 'Sala 101', capacidade: 40 },
      { id: 'sala-102', nome: 'Sala 102', capacidade: 40 },
      { id: 'lab-3', nome: 'Laboratório 3', capacidade: 20 }
    ]);
  });
});

describe('Módulo 1 — Fatia 2: Criação de Atividades', () => {
  let app;

  beforeEach(async () => {
    process.env.MODO_TESTE = '1';
    app = criarApp({ database: ':memory:' });
    await request(app).post('/_teste/reset');
  });

  it('M1-R2: recusa criação de atividade por participante', async () => {
    const res = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'p-carla')
      .send({});
    assert.equal(res.status, 403);
    assert.equal(res.body.erro, 'SOMENTE_ORGANIZACAO');
    assert.ok(res.body.mensagem, 'Deve conter mensagem descritiva');
  });

  it('M1-R3: valida identificação e perfil antes da integridade do payload', async () => {
    const res1 = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'usr_inexistente')
      .set('Content-Type', 'application/json')
      .send('{ json_invalido:');
    assert.equal(res1.status, 401);
    assert.equal(res1.body.erro, 'USUARIO_DESCONHECIDO');

    const res2 = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'p-carla')
      .set('Content-Type', 'application/json')
      .send('{ json_invalido:');
    assert.equal(res2.status, 403);
    assert.equal(res2.body.erro, 'SOMENTE_ORGANIZACAO');
  });

  it('M1-R5: recusa payload com campos obrigatorios ausentes ou invalidos', async () => {
    // 1. Campos obrigatórios ausentes
    const resVazio = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({});
    assert.equal(resVazio.status, 422);
    assert.equal(resVazio.body.erro, 'DADOS_INVALIDOS');

    // 2. Título vazio ou tipo inválido
    const resTipoInvalido = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: '',
        tipo: 'seminario',
        salaId: 'auditorio',
        vagas: 50,
        encontros: [{ inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }]
      });
    assert.equal(resTipoInvalido.status, 422);
    assert.equal(resTipoInvalido.body.erro, 'DADOS_INVALIDOS');

    // 3. SalaId não cadastrada
    const resSalaInexistente = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Teste',
        tipo: 'palestra',
        salaId: 'sala-fantasma',
        vagas: 10,
        encontros: [{ inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }]
      });
    assert.equal(resSalaInexistente.status, 422);
    assert.equal(resSalaInexistente.body.erro, 'DADOS_INVALIDOS');

    // 4. Vagas menor que 1 ou não inteiro
    const resVagasInvalidas = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Teste',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 0,
        encontros: [{ inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }]
      });
    assert.equal(resVagasInvalidas.status, 422);
    assert.equal(resVagasInvalidas.body.erro, 'DADOS_INVALIDOS');

    // 5. Data de encontro sem fuso horário
    const resSemFuso = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Teste',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 50,
        encontros: [{ inicio: '2026-10-19T10:00:00', fim: '2026-10-19T12:00:00' }]
      });
    assert.equal(resSemFuso.status, 422);
    assert.equal(resSemFuso.body.erro, 'DADOS_INVALIDOS');
  });

  it('M1-R6: recusa quantidade incompativel de encontros por tipo', async () => {
    // 1. Palestra com 2 encontros
    const resPalestra2 = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Longa',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' },
          { inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T12:00:00-03:00' }
        ]
      });
    assert.equal(resPalestra2.status, 422);
    assert.equal(resPalestra2.body.erro, 'QUANTIDADE_DE_ENCONTROS');

    // 2. Minicurso com 1 encontro
    const resMinicurso1 = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Minicurso Curto',
        tipo: 'minicurso',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(resMinicurso1.status, 422);
    assert.equal(resMinicurso1.body.erro, 'QUANTIDADE_DE_ENCONTROS');

    // 3. Minicurso com 6 encontros
    const resMinicurso6 = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Minicurso Excessivo',
        tipo: 'minicurso',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T08:00:00-03:00', fim: '2026-10-19T10:00:00-03:00' },
          { inicio: '2026-10-19T10:30:00-03:00', fim: '2026-10-19T12:30:00-03:00' },
          { inicio: '2026-10-20T08:00:00-03:00', fim: '2026-10-20T10:00:00-03:00' },
          { inicio: '2026-10-20T10:30:00-03:00', fim: '2026-10-20T12:30:00-03:00' },
          { inicio: '2026-10-21T08:00:00-03:00', fim: '2026-10-21T10:00:00-03:00' },
          { inicio: '2026-10-21T10:30:00-03:00', fim: '2026-10-21T12:30:00-03:00' }
        ]
      });
    assert.equal(resMinicurso6.status, 422);
    assert.equal(resMinicurso6.body.erro, 'QUANTIDADE_DE_ENCONTROS');
  });

  it('M1-R7: recusa encontro com duracao invalida, fora do periodo, cruzando meia-noite ou sobreposto', async () => {
    // 1. Duração inferior a 60 minutos (50 min)
    const resDuracaoCurta = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Curta',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T10:50:00-03:00' }
        ]
      });
    assert.equal(resDuracaoCurta.status, 422);
    assert.equal(resDuracaoCurta.body.erro, 'ENCONTRO_INVALIDO');

    // 2. Duração superior a 240 minutos (250 min)
    const resDuracaoLonga = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Longa Demais',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T14:10:00-03:00' }
        ]
      });
    assert.equal(resDuracaoLonga.status, 422);
    assert.equal(resDuracaoLonga.body.erro, 'ENCONTRO_INVALIDO');

    // 3. Cruzando a meia-noite no fuso de Brasília
    const resCruzaMeiaNoite = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Noturna',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T23:00:00-03:00', fim: '2026-10-20T00:30:00-03:00' }
        ]
      });
    assert.equal(resCruzaMeiaNoite.status, 422);
    assert.equal(resCruzaMeiaNoite.body.erro, 'ENCONTRO_INVALIDO');

    // 4. Fora do período oficial (ex: 18/10/2026 ou 24/10/2026)
    const resForaPeriodo = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra no Domingo',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-18T10:00:00-03:00', fim: '2026-10-18T12:00:00-03:00' }
        ]
      });
    assert.equal(resForaPeriodo.status, 422);
    assert.equal(resForaPeriodo.body.erro, 'ENCONTRO_INVALIDO');

    // 5. Dois encontros da mesma atividade com sobreposição
    const resSobrepostos = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Minicurso Sobreposto',
        tipo: 'minicurso',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' },
          { inicio: '2026-10-19T11:30:00-03:00', fim: '2026-10-19T13:30:00-03:00' }
        ]
      });
    assert.equal(resSobrepostos.status, 422);
    assert.equal(resSobrepostos.body.erro, 'ENCONTRO_INVALIDO');
  });

  it('M1-R8: recusa vagas acima da capacidade da sala', async () => {
    const res = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Oficina de Hardware',
        tipo: 'palestra',
        salaId: 'lab-3',
        vagas: 21,
        encontros: [
          { inicio: '2026-10-19T14:00:00-03:00', fim: '2026-10-19T16:00:00-03:00' }
        ]
      });
    assert.equal(res.status, 422);
    assert.equal(res.body.erro, 'VAGAS_ACIMA_DA_CAPACIDADE');
  });

  it('M1-R9: recusa conflito de sala e respeita intervalo minimo simetrico de 15 minutos', async () => {
    // 1. Cadastra atividade base no auditorio das 10:00 as 12:00
    const resBase = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Base',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(resBase.status, 201);

    // 2. Sentido 1: Novo encontro começa às 12:10 (intervalo 10 min < 15 min) -> 409
    const resSentido1 = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Conflito Posterior',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T12:10:00-03:00', fim: '2026-10-19T13:30:00-03:00' }
        ]
      });
    assert.equal(resSentido1.status, 409);
    assert.equal(resSentido1.body.erro, 'CONFLITO_DE_SALA');

    // 3. Sentido 2: Novo encontro termina às 09:50 (intervalo 10 min < 15 min do início às 10:00) -> 409
    const resSentido2 = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Conflito Anterior',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T08:30:00-03:00', fim: '2026-10-19T09:50:00-03:00' }
        ]
      });
    assert.equal(resSentido2.status, 409);
    assert.equal(resSentido2.body.erro, 'CONFLITO_DE_SALA');

    // 4. Fronteira exata (15 min): inicia às 12:15 (após término às 12:00) -> 201
    const resFronteiraDepois = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Valida Posterior',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T12:15:00-03:00', fim: '2026-10-19T14:00:00-03:00' }
        ]
      });
    assert.equal(resFronteiraDepois.status, 201);

    // 5. Fronteira exata (15 min): termina às 09:45 (antes do início às 10:00) -> 201
    const resFronteiraAntes = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Valida Anterior',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T08:00:00-03:00', fim: '2026-10-19T09:45:00-03:00' }
        ]
      });
    assert.equal(resFronteiraAntes.status, 201);
  });

  it('M1-R10: gera identificadores, ordena encontros e calcula carga horaria', async () => {
    const res = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Minicurso de TypeScript',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 20,
        cargaHorariaMinutos: 999,
        encontros: [
          { inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T17:00:00-03:00' },
          { inicio: '2026-10-19T14:00:00-03:00', fim: '2026-10-19T17:00:00-03:00' }
        ]
      });

    assert.equal(res.status, 201);
    assert.match(res.body.id, /^atv_[0-9a-f]{8}$/);
    assert.equal(res.body.titulo, 'Minicurso de TypeScript');
    assert.equal(res.body.tipo, 'minicurso');
    assert.equal(res.body.salaId, 'lab-3');
    assert.equal(res.body.vagas, 20);
    assert.equal(res.body.cargaHorariaMinutos, 360);
    assert.equal(res.body.situacao, 'prevista');
    assert.equal(res.body.ocupadas, 0);
    assert.equal(res.body.vagasRestantes, 20);
    assert.equal(res.body.emEspera, 0);

    assert.equal(res.body.encontros.length, 2);
    assert.match(res.body.encontros[0].id, /^enc_[0-9a-f]{8}$/);
    assert.match(res.body.encontros[1].id, /^enc_[0-9a-f]{8}$/);
    assert.equal(res.body.encontros[0].inicio, '2026-10-19T14:00:00-03:00');
    assert.equal(res.body.encontros[1].inicio, '2026-10-20T14:00:00-03:00');
  });
});

describe('Módulo 1 — Fatia 3: Consulta, Filtros e Dinâmica Temporal', () => {
  let app;
  let db;

  beforeEach(async () => {
    process.env.MODO_TESTE = '1';
    db = criarBanco(':memory:');
    app = criarApp({ db });
    await request(app).post('/_teste/reset');
  });

  it('M1-R4: recusa consulta de atividade inexistente com 404 NAO_ENCONTRADO', async () => {
    const res = await request(app)
      .get('/atividades/atv_inexistente')
      .set('X-Usuario', 'p-carla');

    assert.equal(res.status, 404);
    assert.equal(res.body.erro, 'NAO_ENCONTRADO');
    assert.ok(res.body.mensagem, 'Deve conter mensagem descritiva');
  });

  it('M1-R4: retorna detalhes da atividade existente com 200 OK', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Introdução ao Node.js',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 150,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    const res = await request(app)
      .get(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'p-carla');

    assert.equal(res.status, 200);
    assert.equal(res.body.id, atividadeId);
    assert.equal(res.body.titulo, 'Introdução ao Node.js');
    assert.equal(res.body.tipo, 'palestra');
    assert.equal(res.body.salaId, 'auditorio');
    assert.equal(res.body.vagas, 150);
    assert.equal(res.body.cargaHorariaMinutos, 120);
    assert.equal(res.body.situacao, 'prevista');
    assert.equal(res.body.ocupadas, 0);
    assert.equal(res.body.vagasRestantes, 150);
    assert.equal(res.body.emEspera, 0);
    assert.equal(res.body.encontros.length, 1);
    assert.equal(res.body.encontros[0].inicio, '2026-10-19T10:00:00-03:00');
    assert.equal(res.body.encontros[0].fim, '2026-10-19T12:00:00-03:00');
  });

  it('M1-R16: lista todas as atividades ordenadas pelo inicio do primeiro encontro', async () => {
    // Cria atividade 1 iniciando às 14:00
    await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra da Tarde',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T14:00:00-03:00', fim: '2026-10-19T16:00:00-03:00' }
        ]
      });

    // Cria atividade 2 iniciando às 10:00
    await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra da Manhã',
        tipo: 'palestra',
        salaId: 'sala-101',
        vagas: 40,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });

    const res = await request(app)
      .get('/atividades')
      .set('X-Usuario', 'p-carla');

    assert.equal(res.status, 200);
    assert.equal(Array.isArray(res.body), true);
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].titulo, 'Palestra da Manhã');
    assert.equal(res.body[1].titulo, 'Palestra da Tarde');
  });

  it('M1-R16: desempata ordenacao por ordem alfabetica de titulo em caso de mesmo horario', async () => {
    // Cria primeira atividade com título 'Workshop de Docker'
    await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Workshop de Docker',
        tipo: 'palestra',
        salaId: 'sala-101',
        vagas: 40,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });

    // Cria segunda atividade no mesmo horário com título 'Arquitetura Limpa'
    await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Arquitetura Limpa',
        tipo: 'palestra',
        salaId: 'sala-102',
        vagas: 40,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });

    const res = await request(app)
      .get('/atividades')
      .set('X-Usuario', 'p-carla');

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].titulo, 'Arquitetura Limpa');
    assert.equal(res.body[1].titulo, 'Workshop de Docker');
  });

  it('M1-R16: inclui atividades canceladas na listagem', async () => {
    const res1 = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Normal',
        tipo: 'palestra',
        salaId: 'sala-101',
        vagas: 40,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(res1.status, 201);

    const res2 = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Desistida',
        tipo: 'palestra',
        salaId: 'sala-102',
        vagas: 40,
        encontros: [
          { inicio: '2026-10-19T14:00:00-03:00', fim: '2026-10-19T16:00:00-03:00' }
        ]
      });
    assert.equal(res2.status, 201);

    // Simula cancelamento lógico no banco
    db.prepare('UPDATE atividades SET cancelada = 1 WHERE id = ?').run(res2.body.id);

    const res = await request(app)
      .get('/atividades')
      .set('X-Usuario', 'p-carla');

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    const cancelada = res.body.find((a) => a.id === res2.body.id);
    assert.ok(cancelada);
    assert.equal(cancelada.situacao, 'cancelada');
  });

  it('M1-R17: filtra atividades por dia no fuso de Brasilia', async () => {
    // Atividade no dia 19/10/2026
    const resDia19 = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra da Segunda',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(resDia19.status, 201);

    // Atividade no dia 20/10/2026
    const resDia20 = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra da Terça',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T12:00:00-03:00' }
        ]
      });
    assert.equal(resDia20.status, 201);

    // Consulta filtrando apenas o dia 20/10/2026
    const res = await request(app)
      .get('/atividades?dia=2026-10-20')
      .set('X-Usuario', 'p-carla');

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, resDia20.body.id);
    assert.equal(res.body[0].titulo, 'Palestra da Terça');
  });

  it('M1-R17: filtra atividades por tipo', async () => {
    // Cria uma palestra
    const resPalestra = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra de Arquitetura',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(resPalestra.status, 201);

    // Cria um minicurso
    const resMinicurso = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Minicurso de Git',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-19T14:00:00-03:00', fim: '2026-10-19T17:00:00-03:00' },
          { inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T17:00:00-03:00' }
        ]
      });
    assert.equal(resMinicurso.status, 201);

    // Consulta filtrando por tipo: minicurso
    const res = await request(app)
      .get('/atividades?tipo=minicurso')
      .set('X-Usuario', 'p-carla');

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, resMinicurso.body.id);
    assert.equal(res.body[0].tipo, 'minicurso');
  });

  it('M1-R17: combina filtros de dia e tipo simultaneamente', async () => {
    // 1. Palestra na Segunda (19/10)
    await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra de Segunda',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });

    // 2. Palestra na Terça (20/10)
    await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra de Terça',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T12:00:00-03:00' }
        ]
      });

    // 3. Minicurso com encontros na Terça (20/10) e Quarta (21/10)
    const resMinicursoAlvo = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Minicurso de Rust',
        tipo: 'minicurso',
        salaId: 'lab-3',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T17:00:00-03:00' },
          { inicio: '2026-10-21T14:00:00-03:00', fim: '2026-10-21T17:00:00-03:00' }
        ]
      });
    assert.equal(resMinicursoAlvo.status, 201);

    // Consulta combinando dia=2026-10-20 e tipo=minicurso
    const res = await request(app)
      .get('/atividades?dia=2026-10-20&tipo=minicurso')
      .set('X-Usuario', 'p-carla');

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].id, resMinicursoAlvo.body.id);
    assert.equal(res.body[0].titulo, 'Minicurso de Rust');
    assert.equal(res.body[0].tipo, 'minicurso');
  });

  it('M1-R18: calcula situacao como prevista quando relogio for anterior ao inicio do primeiro encontro', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Futura',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    // Posiciona relógio 1 minuto antes do início
    await request(app)
      .put('/_teste/relogio')
      .send({ agora: '2026-10-19T09:59:00-03:00' });

    const res = await request(app)
      .get(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'p-carla');

    assert.equal(res.status, 200);
    assert.equal(res.body.situacao, 'prevista');
  });

  it('M1-R18: calcula situacao como em_andamento quando relogio estiver entre inicio e fim dos encontros', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Em Andamento',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    // 1. Exatamente no início do encontro (fronteira inferior inclusiva)
    await request(app)
      .put('/_teste/relogio')
      .send({ agora: '2026-10-19T10:00:00-03:00' });
    const resInicio = await request(app)
      .get(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'p-carla');
    assert.equal(resInicio.status, 200);
    assert.equal(resInicio.body.situacao, 'em_andamento');

    // 2. Durante o encontro
    await request(app)
      .put('/_teste/relogio')
      .send({ agora: '2026-10-19T11:00:00-03:00' });
    const resMeio = await request(app)
      .get(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'p-carla');
    assert.equal(resMeio.status, 200);
    assert.equal(resMeio.body.situacao, 'em_andamento');

    // 3. Exatamente no término do último encontro (fronteira superior inclusiva)
    await request(app)
      .put('/_teste/relogio')
      .send({ agora: '2026-10-19T12:00:00-03:00' });
    const resFim = await request(app)
      .get(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'p-carla');
    assert.equal(resFim.status, 200);
    assert.equal(resFim.body.situacao, 'em_andamento');
  });

  it('M1-R18: calcula situacao como encerrada quando relogio for posterior ao fim do ultimo encontro', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Encerrada',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    // Posiciona relógio 1 minuto após o término do encontro
    await request(app)
      .put('/_teste/relogio')
      .send({ agora: '2026-10-19T12:01:00-03:00' });

    const res = await request(app)
      .get(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'p-carla');

    assert.equal(res.status, 200);
    assert.equal(res.body.situacao, 'encerrada');
  });

  it('M1-R18: calcula situacao como cancelada independentemente do relogio', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Sempre Cancelada',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 100,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    // Marca como cancelada
    db.prepare('UPDATE atividades SET cancelada = 1 WHERE id = ?').run(atividadeId);

    // 1. Relógio antes do início
    await request(app)
      .put('/_teste/relogio')
      .send({ agora: '2026-10-19T08:00:00-03:00' });
    const resAntes = await request(app)
      .get(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'p-carla');
    assert.equal(resAntes.status, 200);
    assert.equal(resAntes.body.situacao, 'cancelada');

    // 2. Relógio durante o encontro
    await request(app)
      .put('/_teste/relogio')
      .send({ agora: '2026-10-19T11:00:00-03:00' });
    const resDurante = await request(app)
      .get(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'p-carla');
    assert.equal(resDurante.status, 200);
    assert.equal(resDurante.body.situacao, 'cancelada');

    // 3. Relógio após o término
    await request(app)
      .put('/_teste/relogio')
      .send({ agora: '2026-10-19T15:00:00-03:00' });
    const resDepois = await request(app)
      .get(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'p-carla');
    assert.equal(resDepois.status, 200);
    assert.equal(resDepois.body.situacao, 'cancelada');
  });

  it('M1-R19: retorna metricas zeradas para atividade recem criada sem inscricoes', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Métricas Recém Criada',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 200,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    // Consulta por ID
    const resGet = await request(app)
      .get(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'p-carla');
    assert.equal(resGet.status, 200);
    assert.equal(resGet.body.ocupadas, 0);
    assert.equal(resGet.body.vagasRestantes, 200);
    assert.equal(resGet.body.emEspera, 0);

    // Consulta na listagem
    const resList = await request(app)
      .get('/atividades')
      .set('X-Usuario', 'p-carla');
    assert.equal(resList.status, 200);
    const item = resList.body.find((a) => a.id === atividadeId);
    assert.ok(item);
    assert.equal(item.ocupadas, 0);
    assert.equal(item.vagasRestantes, 200);
    assert.equal(item.emEspera, 0);
  });

  it('M1-R19: calcula ocupadas, vagasRestantes e emEspera a partir das inscricoes no banco', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra com Inscricoes',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 50,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    // Insere inscrições no banco com diferentes status
    const insere = db.prepare(`
      INSERT INTO inscricoes (id, atividade_id, participante_id, status, posicao_na_espera, convocada_ate, criada_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insere.run('ins_11111111', atividadeId, 'p-carla', 'confirmada', null, null, '2026-10-13T10:00:00-03:00');
    insere.run('ins_22222222', atividadeId, 'p-diego', 'confirmada', null, null, '2026-10-13T10:05:00-03:00');
    insere.run('ins_33333333', atividadeId, 'p-elisa', 'convocada', null, '2026-10-15T10:00:00-03:00', '2026-10-13T10:10:00-03:00');
    insere.run('ins_44444444', atividadeId, 'p-fabio', 'cancelada', null, null, '2026-10-13T10:15:00-03:00');
    insere.run('ins_55555555', atividadeId, 'p-gabriela', 'em_espera', 1, null, '2026-10-13T10:20:00-03:00');
    insere.run('ins_66666666', atividadeId, 'p-heitor', 'em_espera', 2, null, '2026-10-13T10:25:00-03:00');

    // Consulta por ID
    const resGet = await request(app)
      .get(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'p-carla');

    assert.equal(resGet.status, 200);
    assert.equal(resGet.body.ocupadas, 3); // 2 confirmadas + 1 convocada
    assert.equal(resGet.body.vagasRestantes, 47); // 50 - 3
    assert.equal(resGet.body.emEspera, 2); // 2 em_espera

    // Consulta na listagem
    const resList = await request(app)
      .get('/atividades')
      .set('X-Usuario', 'p-carla');

    assert.equal(resList.status, 200);
    const item = resList.body.find((a) => a.id === atividadeId);
    assert.ok(item);
    assert.equal(item.ocupadas, 3);
    assert.equal(item.vagasRestantes, 47);
    assert.equal(item.emEspera, 2);
  });
});

describe('Módulo 1 — Fatia 4: Gestão, Alteração e Cancelamento de Atividades', () => {
  let app;
  let db;

  beforeEach(async () => {
    process.env.MODO_TESTE = '1';
    db = criarBanco(':memory:');
    app = criarApp({ db });
    await request(app).post('/_teste/reset');
  });

  it('M1-R4: recusa alteracao de atividade inexistente com 404 NAO_ENCONTRADO', async () => {
    const res = await request(app)
      .patch('/atividades/atv_inexistente')
      .set('X-Usuario', 'org-ana')
      .send({ titulo: 'Novo Título' });

    assert.equal(res.status, 404);
    assert.equal(res.body.erro, 'NAO_ENCONTRADO');
    assert.equal(res.body.mensagem, 'Atividade não encontrada.');
  });

  it('M1-R4: recusa cancelamento de atividade inexistente com 404 NAO_ENCONTRADO', async () => {
    const res = await request(app)
      .post('/atividades/atv_inexistente/cancelamento')
      .set('X-Usuario', 'org-ana');

    assert.equal(res.status, 404);
    assert.equal(res.body.erro, 'NAO_ENCONTRADO');
    assert.equal(res.body.mensagem, 'Atividade não encontrada.');
  });

  it('M1-R8: recusa alteracao de vagas acima da capacidade da sala com 422 VAGAS_ACIMA_DA_CAPACIDADE', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Sala 101',
        tipo: 'palestra',
        salaId: 'sala-101',
        vagas: 30,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    const res = await request(app)
      .patch(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'org-ana')
      .send({ vagas: 45 });

    assert.equal(res.status, 422);
    assert.equal(res.body.erro, 'VAGAS_ACIMA_DA_CAPACIDADE');
    assert.ok(res.body.mensagem, 'Deve conter mensagem descritiva');
  });

  it('M1-R11: recusa alteracao do campo salaId com 422 CAMPO_NAO_EDITAVEL', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Original',
        tipo: 'palestra',
        salaId: 'sala-101',
        vagas: 30,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    const res = await request(app)
      .patch(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'org-ana')
      .send({ salaId: 'auditorio' });

    assert.equal(res.status, 422);
    assert.equal(res.body.erro, 'CAMPO_NAO_EDITAVEL');
    assert.ok(res.body.mensagem, 'Deve conter mensagem descritiva');
  });

  it('M1-R11: recusa alteracao do campo tipo com 422 CAMPO_NAO_EDITAVEL', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Original',
        tipo: 'palestra',
        salaId: 'sala-101',
        vagas: 30,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    const res = await request(app)
      .patch(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'org-ana')
      .send({ tipo: 'minicurso' });

    assert.equal(res.status, 422);
    assert.equal(res.body.erro, 'CAMPO_NAO_EDITAVEL');
    assert.ok(res.body.mensagem, 'Deve conter mensagem descritiva');
  });

  it('M1-R11: recusa alteracao do campo encontros com 422 CAMPO_NAO_EDITAVEL', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Original',
        tipo: 'palestra',
        salaId: 'sala-101',
        vagas: 30,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    const res = await request(app)
      .patch(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'org-ana')
      .send({
        encontros: [
          { inicio: '2026-10-19T14:00:00-03:00', fim: '2026-10-19T16:00:00-03:00' }
        ]
      });

    assert.equal(res.status, 422);
    assert.equal(res.body.erro, 'CAMPO_NAO_EDITAVEL');
    assert.ok(res.body.mensagem, 'Deve conter mensagem descritiva');
  });

  it('M1-R11: recusa alteracao de campos calculados ou gerados com 422 CAMPO_NAO_EDITAVEL', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Original',
        tipo: 'palestra',
        salaId: 'sala-101',
        vagas: 30,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    const res = await request(app)
      .patch(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'org-ana')
      .send({ cargaHorariaMinutos: 999 });

    assert.equal(res.status, 422);
    assert.equal(res.body.erro, 'CAMPO_NAO_EDITAVEL');
    assert.ok(res.body.mensagem, 'Deve conter mensagem descritiva');
  });

  it('M1-R11: permite alterar titulo preservando os demais campos com 200 OK', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Antiga',
        tipo: 'palestra',
        salaId: 'sala-101',
        vagas: 30,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    const res = await request(app)
      .patch(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'org-ana')
      .send({ titulo: 'Novo Título da Palestra' });

    assert.equal(res.status, 200);
    assert.equal(res.body.id, atividadeId);
    assert.equal(res.body.titulo, 'Novo Título da Palestra');
    assert.equal(res.body.tipo, 'palestra');
    assert.equal(res.body.salaId, 'sala-101');
    assert.equal(res.body.vagas, 30);
    assert.equal(res.body.encontros.length, 1);

    // Consulta novamente por GET para verificar persistência
    const resGet = await request(app)
      .get(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'org-ana');
    assert.equal(resGet.status, 200);
    assert.equal(resGet.body.titulo, 'Novo Título da Palestra');
  });

  it('M1-R12: recusa reducao de vagas abaixo das ocupadas com 409 VAGAS_ABAIXO_DOS_INSCRITOS', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Concorrida',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    // Insere 10 confirmadas e 2 convocadas = 12 ocupadas
    const insereUsuario = db.prepare('INSERT INTO usuarios (id, nome, papel) VALUES (?, ?, ?)');
    for (let i = 1; i <= 12; i++) {
      insereUsuario.run(`usr_teste_${i}`, `Participante Teste ${i}`, 'participante');
    }

    const insere = db.prepare(`
      INSERT INTO inscricoes (id, atividade_id, participante_id, status, posicao_na_espera, convocada_ate, criada_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (let i = 1; i <= 10; i++) {
      insere.run(`ins_conf_${i}`, atividadeId, `usr_teste_${i}`, 'confirmada', null, null, '2026-10-13T10:00:00-03:00');
    }
    insere.run('ins_conv_1', atividadeId, 'usr_teste_11', 'convocada', null, '2026-10-15T10:00:00-03:00', '2026-10-13T10:00:00-03:00');
    insere.run('ins_conv_2', atividadeId, 'usr_teste_12', 'convocada', null, '2026-10-15T10:00:00-03:00', '2026-10-13T10:00:00-03:00');

    // Tenta reduzir vagas para 10 (< 12)
    const res = await request(app)
      .patch(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'org-ana')
      .send({ vagas: 10 });

    assert.equal(res.status, 409);
    assert.equal(res.body.erro, 'VAGAS_ABAIXO_DOS_INSCRITOS');
    assert.ok(res.body.mensagem, 'Deve conter mensagem descritiva');
  });

  it('M1-R12: permite reducao de vagas quando valor for maior ou igual as vagas ocupadas com 200 OK', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra com Vagas Reduziveis',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 30,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    // Insere 5 confirmadas
    const insereUsuario = db.prepare('INSERT INTO usuarios (id, nome, papel) VALUES (?, ?, ?)');
    const insereInscricao = db.prepare(`
      INSERT INTO inscricoes (id, atividade_id, participante_id, status, posicao_na_espera, convocada_ate, criada_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (let i = 1; i <= 5; i++) {
      insereUsuario.run(`usr_red_${i}`, `User ${i}`, 'participante');
      insereInscricao.run(`ins_red_${i}`, atividadeId, `usr_red_${i}`, 'confirmada', null, null, '2026-10-13T10:00:00-03:00');
    }

    // Reduz vagas de 30 para 10 (>= 5 ocupadas)
    const res = await request(app)
      .patch(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'org-ana')
      .send({ vagas: 10 });

    assert.equal(res.status, 200);
    assert.equal(res.body.vagas, 10);
    assert.equal(res.body.ocupadas, 5);
    assert.equal(res.body.vagasRestantes, 5);
  });

  it('M1-R13: convoca automaticamente inscricoes da lista de espera ao expandir vagas com 200 OK', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra com Fila de Espera',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 20,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    // Cadastra 22 usuários no banco (20 confirmados + 2 em espera)
    const insereUsuario = db.prepare('INSERT INTO usuarios (id, nome, papel) VALUES (?, ?, ?)');
    for (let i = 1; i <= 22; i++) {
      insereUsuario.run(`usr_esp_${i}`, `User ${i}`, 'participante');
    }

    const insereInscricao = db.prepare(`
      INSERT INTO inscricoes (id, atividade_id, participante_id, status, posicao_na_espera, convocada_ate, criada_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // 20 confirmadas
    for (let i = 1; i <= 20; i++) {
      insereInscricao.run(`ins_conf_${i}`, atividadeId, `usr_esp_${i}`, 'confirmada', null, null, `2026-10-13T10:${String(i).padStart(2, '0')}:00-03:00`);
    }

    // 2 em espera
    insereInscricao.run('ins_espera_1', atividadeId, 'usr_esp_21', 'em_espera', 1, null, '2026-10-13T11:00:00-03:00');
    insereInscricao.run('ins_espera_2', atividadeId, 'usr_esp_22', 'em_espera', 2, null, '2026-10-13T11:05:00-03:00');

    // Expande vagas de 20 para 22
    const res = await request(app)
      .patch(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'org-ana')
      .send({ vagas: 22 });

    assert.equal(res.status, 200);
    assert.equal(res.body.vagas, 22);
    assert.equal(res.body.ocupadas, 22); // 20 confirmadas + 2 convocadas
    assert.equal(res.body.vagasRestantes, 0);
    assert.equal(res.body.emEspera, 0);

    // Verifica no banco se as inscrições foram convocadas
    const ins1 = db.prepare('SELECT status, posicao_na_espera FROM inscricoes WHERE id = ?').get('ins_espera_1');
    assert.equal(ins1.status, 'convocada');
    assert.equal(ins1.posicao_na_espera, null);

    const ins2 = db.prepare('SELECT status, posicao_na_espera FROM inscricoes WHERE id = ?').get('ins_espera_2');
    assert.equal(ins2.status, 'convocada');
    assert.equal(ins2.posicao_na_espera, null);
  });

  it('M1-R13: convoca apenas ate o limite de novas vagas e atualiza posicao da fila restante', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Fila Parcial',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 10,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    const insereUsuario = db.prepare('INSERT INTO usuarios (id, nome, papel) VALUES (?, ?, ?)');
    for (let i = 1; i <= 13; i++) {
      insereUsuario.run(`usr_parc_${i}`, `User ${i}`, 'participante');
    }

    const insereInscricao = db.prepare(`
      INSERT INTO inscricoes (id, atividade_id, participante_id, status, posicao_na_espera, convocada_ate, criada_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // 10 confirmadas
    for (let i = 1; i <= 10; i++) {
      insereInscricao.run(`ins_conf_p_${i}`, atividadeId, `usr_parc_${i}`, 'confirmada', null, null, `2026-10-13T10:${String(i).padStart(2, '0')}:00-03:00`);
    }

    // 3 em espera (posições 1, 2, 3)
    insereInscricao.run('ins_esp_p_1', atividadeId, 'usr_parc_11', 'em_espera', 1, null, '2026-10-13T11:00:00-03:00');
    insereInscricao.run('ins_esp_p_2', atividadeId, 'usr_parc_12', 'em_espera', 2, null, '2026-10-13T11:05:00-03:00');
    insereInscricao.run('ins_esp_p_3', atividadeId, 'usr_parc_13', 'em_espera', 3, null, '2026-10-13T11:10:00-03:00');

    // Aumenta apenas 1 vaga (de 10 para 11)
    const res = await request(app)
      .patch(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'org-ana')
      .send({ vagas: 11 });

    assert.equal(res.status, 200);
    assert.equal(res.body.vagas, 11);
    assert.equal(res.body.ocupadas, 11); // 10 confirmadas + 1 convocada
    assert.equal(res.body.vagasRestantes, 0);
    assert.equal(res.body.emEspera, 2);

    // O primeiro foi convocado
    const ins1 = db.prepare('SELECT status, posicao_na_espera FROM inscricoes WHERE id = ?').get('ins_esp_p_1');
    assert.equal(ins1.status, 'convocada');
    assert.equal(ins1.posicao_na_espera, null);

    // O segundo virou posição 1
    const ins2 = db.prepare('SELECT status, posicao_na_espera FROM inscricoes WHERE id = ?').get('ins_esp_p_2');
    assert.equal(ins2.status, 'em_espera');
    assert.equal(ins2.posicao_na_espera, 1);

    // O terceiro virou posição 2
    const ins3 = db.prepare('SELECT status, posicao_na_espera FROM inscricoes WHERE id = ?').get('ins_esp_p_3');
    assert.equal(ins3.status, 'em_espera');
    assert.equal(ins3.posicao_na_espera, 2);
  });

  it('M1-R14: recusa alteracao via PATCH em atividade cancelada com 422 ATIVIDADE_CANCELADA', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Cancelada',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 50,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    // Marca como cancelada no banco
    db.prepare('UPDATE atividades SET cancelada = 1 WHERE id = ?').run(atividadeId);

    const res = await request(app)
      .patch(`/atividades/${atividadeId}`)
      .set('X-Usuario', 'org-ana')
      .send({ titulo: 'Novo Título' });

    assert.equal(res.status, 422);
    assert.equal(res.body.erro, 'ATIVIDADE_CANCELADA');
    assert.ok(res.body.mensagem, 'Deve conter mensagem descritiva');
  });

  it('M1-R14: recusa novo cancelamento em atividade ja cancelada com 422 ATIVIDADE_CANCELADA', async () => {
    const criacao = await request(app)
      .post('/atividades')
      .set('X-Usuario', 'org-ana')
      .send({
        titulo: 'Palestra Ja Cancelada',
        tipo: 'palestra',
        salaId: 'auditorio',
        vagas: 50,
        encontros: [
          { inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }
        ]
      });
    assert.equal(criacao.status, 201);
    const atividadeId = criacao.body.id;

    // Marca como cancelada no banco
    db.prepare('UPDATE atividades SET cancelada = 1 WHERE id = ?').run(atividadeId);

    const res = await request(app)
      .post(`/atividades/${atividadeId}/cancelamento`)
      .set('X-Usuario', 'org-ana');

    assert.equal(res.status, 422);
    assert.equal(res.body.erro, 'ATIVIDADE_CANCELADA');
    assert.ok(res.body.mensagem, 'Deve conter mensagem descritiva');
  });
});

