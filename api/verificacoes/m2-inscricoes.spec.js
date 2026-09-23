const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { criarServidor } = require('../src/servidor.js');

describe('M2 — Inscrições e Lista de Espera', () => {
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

  beforeEach(async () => {
    await fetch(`${baseUrl}/_teste/reset`, { method: 'POST' });
  });

  async function criarAtividade(dados, usuario = 'org-ana') {
    const res = await fetch(`${baseUrl}/atividades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Usuario': usuario,
      },
      body: JSON.stringify(dados),
    });
    return await res.json();
  }

  async function definirRelogio(agora) {
    await fetch(`${baseUrl}/_teste/relogio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agora }),
    });
  }

  // ========================================================
  // R1: Alocação de vaga e entrada na fila de espera
  // ========================================================
  it('M2-R1: aloca vaga confirmada quando houver vagas livres', async () => {
    const atv = await criarAtividade({
      titulo: 'Palestra de IA',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 2,
      encontros: [{ inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }],
    });

    const res = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.match(body.id, /^ins_[0-9a-f]{8}$/);
    assert.equal(body.atividadeId, atv.id);
    assert.equal(body.participanteId, 'p-carla');
    assert.equal(body.status, 'confirmada');
    assert.equal(body.posicaoNaEspera, null);
    assert.equal(body.convocadaAte, null);
  });

  it('M2-R1: coloca participante na fila de espera com posicaoNaEspera ao atingir capacidade', async () => {
    const atv = await criarAtividade({
      titulo: 'Minicurso Python',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 1,
      encontros: [{ inicio: '2026-10-19T14:00:00-03:00', fim: '2026-10-19T17:00:00-03:00' }],
    });

    // 1º participante ganha a única vaga
    const res1 = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res1.status, 201);
    const ins1 = await res1.json();
    assert.equal(ins1.status, 'confirmada');

    // 2º participante vai para a lista de espera (posição 1)
    const res2 = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(res2.status, 201);
    const ins2 = await res2.json();
    assert.equal(ins2.status, 'em_espera');
    assert.equal(ins2.posicaoNaEspera, 1);

    // 3º participante vai para a lista de espera (posição 2)
    const res3 = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-elisa' },
    });
    assert.equal(res3.status, 201);
    const ins3 = await res3.json();
    assert.equal(ins3.status, 'em_espera');
    assert.equal(ins3.posicaoNaEspera, 2);
  });

  // ========================================================
  // R2: Restrição por atividade cancelada
  // ========================================================
  it('M2-R2: recusa inscricao em atividade cancelada com 422 ATIVIDADE_CANCELADA', async () => {
    const atv = await criarAtividade({
      titulo: 'Minicurso Cancelado',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 10,
      encontros: [{ inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T17:00:00-03:00' }],
    });

    // Cancelar atividade
    await fetch(`${baseUrl}/atividades/${atv.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'org-ana' },
    });

    const res = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.erro, 'ATIVIDADE_CANCELADA');
  });

  // ========================================================
  // R3: Encerramento de inscrições no início da atividade
  // ========================================================
  it('M2-R3: recusa inscricao quando horario atual atingir ou passar do primeiro encontro com 422 INSCRICOES_ENCERRADAS', async () => {
    const atv = await criarAtividade({
      titulo: 'Palestra de Abertura',
      tipo: 'palestra',
      salaId: 'auditorio',
      vagas: 50,
      encontros: [{ inicio: '2026-10-19T09:00:00-03:00', fim: '2026-10-19T11:00:00-03:00' }],
    });

    // Avança relógio para o momento exato do início da palestra
    await definirRelogio('2026-10-19T09:00:00-03:00');

    const res = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.erro, 'INSCRICOES_ENCERRADAS');
  });

  // ========================================================
  // R4: Unicidade de inscrição ativa por participante
  // ========================================================
  it('M2-R4: recusa segunda inscricao do mesmo participante com 409 JA_INSCRITO', async () => {
    const atv = await criarAtividade({
      titulo: 'Palestra de Redes',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 20,
      encontros: [{ inicio: '2026-10-21T10:00:00-03:00', fim: '2026-10-21T12:00:00-03:00' }],
    });

    await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    const resRepetida = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    assert.equal(resRepetida.status, 409);
    const body = await resRepetida.json();
    assert.equal(body.erro, 'JA_INSCRITO');
  });

  // ========================================================
  // R5: Detecção de conflito de horário
  // ========================================================
  it('M2-R5: recusa inscricao com sobreposicao de horario com 409 CONFLITO_DE_HORARIO', async () => {
    const atv1 = await criarAtividade({
      titulo: 'Minicurso React',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [{ inicio: '2026-10-19T14:00:00-03:00', fim: '2026-10-19T17:00:00-03:00' }],
    });

    const atv2 = await criarAtividade({
      titulo: 'Palestra Docker',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 20,
      encontros: [{ inicio: '2026-10-19T16:00:00-03:00', fim: '2026-10-19T18:00:00-03:00' }],
    });

    await fetch(`${baseUrl}/atividades/${atv1.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    const resConflito = await fetch(`${baseUrl}/atividades/${atv2.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    assert.equal(resConflito.status, 409);
    const body = await resConflito.json();
    assert.equal(body.erro, 'CONFLITO_DE_HORARIO');
  });

  it('M2-R5: permite inscricao em atividades consecutivas onde fim1 == inicio2 (sem conflito)', async () => {
    const atv1 = await criarAtividade({
      titulo: 'Minicurso Manhã',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 20,
      encontros: [{ inicio: '2026-10-19T08:00:00-03:00', fim: '2026-10-19T10:00:00-03:00' }],
    });

    const atv2 = await criarAtividade({
      titulo: 'Palestra Meio-Dia',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 20,
      encontros: [{ inicio: '2026-10-19T10:00:00-03:00', fim: '2026-10-19T12:00:00-03:00' }],
    });

    const res1 = await fetch(`${baseUrl}/atividades/${atv1.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res1.status, 201);

    const res2 = await fetch(`${baseUrl}/atividades/${atv2.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res2.status, 201);
  });

  // ========================================================
  // R6: Limite máximo de minicursos por participante
  // ========================================================
  it('M2-R6: recusa inscricao no 3º minicurso com 422 LIMITE_DE_MINICURSOS', async () => {
    const m1 = await criarAtividade({
      titulo: 'Minicurso 1',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 10,
      encontros: [{ inicio: '2026-10-19T14:00:00-03:00', fim: '2026-10-19T16:00:00-03:00' }],
    });
    const m2 = await criarAtividade({
      titulo: 'Minicurso 2',
      tipo: 'minicurso',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [{ inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T16:00:00-03:00' }],
    });
    const m3 = await criarAtividade({
      titulo: 'Minicurso 3',
      tipo: 'minicurso',
      salaId: 'sala-102',
      vagas: 10,
      encontros: [{ inicio: '2026-10-21T14:00:00-03:00', fim: '2026-10-21T16:00:00-03:00' }],
    });

    const res1 = await fetch(`${baseUrl}/atividades/${m1.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res1.status, 201);

    const res2 = await fetch(`${baseUrl}/atividades/${m2.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res2.status, 201);

    const res3 = await fetch(`${baseUrl}/atividades/${m3.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(res3.status, 422);
    const body = await res3.json();
    assert.equal(body.erro, 'LIMITE_DE_MINICURSOS');
  });

  // ========================================================
  // R7: Cancelamento de inscrição pelo participante
  // ========================================================
  it('M2-R7: cancela inscricao com 200 OK e status cancelada', async () => {
    const atv = await criarAtividade({
      titulo: 'Minicurso Git',
      tipo: 'minicurso',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [{ inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T17:00:00-03:00' }],
    });

    const resIns = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const ins = await resIns.json();

    const resCanc = await fetch(`${baseUrl}/inscricoes/${ins.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    assert.equal(resCanc.status, 200);
    const body = await resCanc.json();
    assert.equal(body.status, 'cancelada');
    assert.equal(body.posicaoNaEspera, null);
  });

  it('M2-R7: recusa cancelamento de inscricao inativa com 422 INSCRICAO_INATIVA', async () => {
    const atv = await criarAtividade({
      titulo: 'Palestra SQL',
      tipo: 'palestra',
      salaId: 'sala-102',
      vagas: 10,
      encontros: [{ inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T17:00:00-03:00' }],
    });

    const resIns = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const ins = await resIns.json();

    // Primeiro cancelamento: OK
    await fetch(`${baseUrl}/inscricoes/${ins.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    // Segundo cancelamento: recusa
    const resCanc2 = await fetch(`${baseUrl}/inscricoes/${ins.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resCanc2.status, 422);
    const body = await resCanc2.json();
    assert.equal(body.erro, 'INSCRICAO_INATIVA');
  });

  it('M2-R7: recusa cancelamento se a atividade ja tiver iniciado com 422 ATIVIDADE_JA_INICIADA', async () => {
    const atv = await criarAtividade({
      titulo: 'Palestra Rust',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [{ inicio: '2026-10-19T09:00:00-03:00', fim: '2026-10-19T11:00:00-03:00' }],
    });

    const resIns = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const ins = await resIns.json();

    // Avança o relógio para depois do início
    await definirRelogio('2026-10-19T09:30:00-03:00');

    const resCanc = await fetch(`${baseUrl}/inscricoes/${ins.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resCanc.status, 422);
    const body = await resCanc.json();
    assert.equal(body.erro, 'ATIVIDADE_JA_INICIADA');
  });

  // ========================================================
  // R8: Convocação automática e avanço da lista de espera
  // ========================================================
  it('M2-R8: promove automaticamente o 1º da espera para convocada ao cancelar vaga confirmada', async () => {
    const atv = await criarAtividade({
      titulo: 'Minicurso Flutter',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 1,
      encontros: [{ inicio: '2026-10-20T14:00:00-03:00', fim: '2026-10-20T17:00:00-03:00' }],
    });

    // Carla ocupa vaga
    const resCarla = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const insCarla = await resCarla.json();

    // Diego entra na espera (posição 1)
    const resDiego = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    const insDiego = await resDiego.json();
    assert.equal(insDiego.status, 'em_espera');

    // Elisa entra na espera (posição 2)
    const resElisa = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-elisa' },
    });
    const insElisa = await resElisa.json();
    assert.equal(insElisa.status, 'em_espera');
    assert.equal(insElisa.posicaoNaEspera, 2);

    // Carla cancela a vaga dela
    await fetch(`${baseUrl}/inscricoes/${insCarla.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    // Consulta Diego: deve estar convocada com convocadaAte e sem posicaoNaEspera
    const resConsDiego = await fetch(`${baseUrl}/inscricoes/${insDiego.id}`, {
      headers: { 'X-Usuario': 'p-diego' },
    });
    const diegoAtualizado = await resConsDiego.json();
    assert.equal(diegoAtualizado.status, 'convocada');
    assert.equal(diegoAtualizado.posicaoNaEspera, null);
    assert.ok(diegoAtualizado.convocadaAte !== null);

    // Consulta Elisa: avançou da posição 2 para a posição 1
    const resConsElisa = await fetch(`${baseUrl}/inscricoes/${insElisa.id}`, {
      headers: { 'X-Usuario': 'p-elisa' },
    });
    const elisaAtualizada = await resConsElisa.json();
    assert.equal(elisaAtualizada.status, 'em_espera');
    assert.equal(elisaAtualizada.posicaoNaEspera, 1);
  });

  // ========================================================
  // R9: Confirmação de vaga convocada e expiração
  // ========================================================
  it('M2-R9: confirma convocacao dentro do prazo com 200 OK e status confirmada', async () => {
    const atv = await criarAtividade({
      titulo: 'Minicurso TypeScript',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 1,
      encontros: [{ inicio: '2026-10-21T14:00:00-03:00', fim: '2026-10-21T17:00:00-03:00' }],
    });

    const resCarla = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const insCarla = await resCarla.json();

    const resDiego = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    const insDiego = await resDiego.json();

    // Carla cancela -> Diego convocado
    await fetch(`${baseUrl}/inscricoes/${insCarla.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    // Diego confirma sua vaga
    const resConf = await fetch(`${baseUrl}/inscricoes/${insDiego.id}/confirmacao`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });

    assert.equal(resConf.status, 200);
    const body = await resConf.json();
    assert.equal(body.status, 'confirmada');
    assert.equal(body.convocadaAte, null);
    assert.equal(body.posicaoNaEspera, null);
  });

  it('M2-R9: recusa confirmacao de inscricao que nao esta convocada com 422 SEM_CONVOCACAO', async () => {
    const atv = await criarAtividade({
      titulo: 'Palestra Cloud',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 10,
      encontros: [{ inicio: '2026-10-21T14:00:00-03:00', fim: '2026-10-21T17:00:00-03:00' }],
    });

    const res = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const ins = await res.json();

    const resConf = await fetch(`${baseUrl}/inscricoes/${ins.id}/confirmacao`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    assert.equal(resConf.status, 422);
    const body = await resConf.json();
    assert.equal(body.erro, 'SEM_CONVOCACAO');
  });

  it('M2-R9: recusa confirmacao com 422 CONVOCACAO_EXPIRADA se passar do prazo e convoca proximo', async () => {
    const atv = await criarAtividade({
      titulo: 'Minicurso Docker',
      tipo: 'minicurso',
      salaId: 'lab-3',
      vagas: 1,
      encontros: [{ inicio: '2026-10-22T14:00:00-03:00', fim: '2026-10-22T17:00:00-03:00' }],
    });

    const resCarla = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const insCarla = await resCarla.json();

    const resDiego = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    const insDiego = await resDiego.json();

    const resElisa = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-elisa' },
    });
    const insElisa = await resElisa.json();

    // Carla cancela -> Diego convocado (prazo de 24h a partir de 2026-10-13T09:00:00-03:00 -> expira 2026-10-14T09:00:00-03:00)
    await fetch(`${baseUrl}/inscricoes/${insCarla.id}/cancelamento`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });

    // Avança relógio além do prazo da convocação
    await definirRelogio('2026-10-15T09:00:00-03:00');

    // Diego tenta confirmar tarde demais
    const resConf = await fetch(`${baseUrl}/inscricoes/${insDiego.id}/confirmacao`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(resConf.status, 422);
    const body = await resConf.json();
    assert.equal(body.erro, 'CONVOCACAO_EXPIRADA');

    // Elisa deve ter sido convocada no lugar do Diego!
    const resConsElisa = await fetch(`${baseUrl}/inscricoes/${insElisa.id}`, {
      headers: { 'X-Usuario': 'p-elisa' },
    });
    const elisa = await resConsElisa.json();
    assert.equal(elisa.status, 'convocada');
  });

  // ========================================================
  // R11: Visibilidade e isolamento de inscrições
  // ========================================================
  it('M2-R11: participante lista apenas suas proprias inscricoes e organizacao lista todas', async () => {
    const atv = await criarAtividade({
      titulo: 'Palestra de Segurança',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 20,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T12:00:00-03:00' }],
    });

    await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-diego' },
    });

    // Carla consulta: só vê 1 (a dela)
    const resCarla = await fetch(`${baseUrl}/inscricoes`, {
      headers: { 'X-Usuario': 'p-carla' },
    });
    const listaCarla = await resCarla.json();
    assert.equal(listaCarla.length, 1);
    assert.equal(listaCarla[0].participanteId, 'p-carla');

    // Organização consulta: vê 2
    const resOrg = await fetch(`${baseUrl}/inscricoes?atividadeId=${atv.id}`, {
      headers: { 'X-Usuario': 'org-ana' },
    });
    const listaOrg = await resOrg.json();
    assert.equal(listaOrg.length, 2);
  });

  it('M2-R11: participante nao pode consultar inscricao de outro com GET /inscricoes/:id', async () => {
    const atv = await criarAtividade({
      titulo: 'Palestra de UX',
      tipo: 'palestra',
      salaId: 'sala-101',
      vagas: 20,
      encontros: [{ inicio: '2026-10-20T10:00:00-03:00', fim: '2026-10-20T12:00:00-03:00' }],
    });

    const resIns = await fetch(`${baseUrl}/atividades/${atv.id}/inscricoes`, {
      method: 'POST',
      headers: { 'X-Usuario': 'p-carla' },
    });
    const ins = await resIns.json();

    // Diego tenta ver a inscrição da Carla
    const res = await fetch(`${baseUrl}/inscricoes/${ins.id}`, {
      headers: { 'X-Usuario': 'p-diego' },
    });
    assert.equal(res.status, 404);
  });
});
