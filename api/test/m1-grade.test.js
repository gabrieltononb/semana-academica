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
