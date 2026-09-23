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
});

