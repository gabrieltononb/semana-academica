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
});
