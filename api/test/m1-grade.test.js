import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { criarApp } from '../src/app.js';

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
});

