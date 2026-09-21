const express = require('express');
const crypto = require('node:crypto');
const { criarBanco, carregarDadosIniciais } = require('./db.js');
const { relogio } = require('./relogio.js');
const { calcularCodigoDoEncontro, gerarCodigo, obterBaldeMinuto } = require('./codigo-qr.js');
const {
  obterPrimeiroEncontro,
  formatarInscricao,
  verificarConflitoDeHorario,
  atingiuLimiteDeMinicursos,
  promoverProximoDaEspera,
  expirarConvocacoesVencidas,
} = require('./inscricoes.js');

function gerarId(prefixo) {
  return `${prefixo}_${crypto.randomBytes(4).toString('hex')}`;
}

function criarServidor(banco) {
  const db = banco || criarBanco();
  const app = express();
  app.use(express.json());

  // Rotas de teste
  if (process.env.MODO_TESTE === '1') {
    app.post('/_teste/reset', (req, res) => {
      db.exec(`
        DELETE FROM presencas;
        DELETE FROM inscricoes;
        DELETE FROM encontros;
        DELETE FROM atividades;
        DELETE FROM salas;
        DELETE FROM usuarios;
      `);
      carregarDadosIniciais(db);
      relogio.reset();
      res.status(204).end();
    });

    app.put('/_teste/relogio', (req, res) => {
      const { agora } = req.body || {};
      if (!agora) {
        return res.status(422).json({ erro: 'DADOS_INVALIDOS', mensagem: 'Campo agora é obrigatório' });
      }
      relogio.definir(agora);
      res.json({ agora: relogio.agora() });
    });

    app.get('/_teste/relogio', (req, res) => {
      res.json({ agora: relogio.agora() });
    });

    app.post('/_teste/inscricoes', (req, res) => {
      const { atividadeId, participanteId, status = 'confirmada' } = req.body || {};
      const id = gerarId('ins');
      db.prepare(`
        INSERT INTO inscricoes (id, atividadeId, participanteId, status, criadaEm)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, atividadeId, participanteId, status, relogio.agora());
      res.status(201).json({ id, atividadeId, participanteId, status });
    });
  }

  // Middleware de identificação X-Usuario (Seção 1 do Contrato)
  app.use((req, res, next) => {
    if (req.path.startsWith('/_teste/')) {
      return next();
    }
    const usuarioId = req.header('X-Usuario');
    if (!usuarioId) {
      return res.status(401).json({ erro: 'USUARIO_DESCONHECIDO', mensagem: 'Cabeçalho X-Usuario ausente' });
    }

    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioId);
    if (!usuario) {
      return res.status(401).json({ erro: 'USUARIO_DESCONHECIDO', mensagem: 'Usuário não encontrado' });
    }

    req.usuario = usuario;
    next();
  });

  // POST /atividades (para suporte a criação de encontros nos testes)
  app.post('/atividades', (req, res) => {
    if (req.usuario.papel !== 'organizacao') {
      return res.status(403).json({ erro: 'SOMENTE_ORGANIZACAO', mensagem: 'Apenas organização pode cadastrar atividade' });
    }

    const { titulo, tipo, salaId, vagas, encontros = [] } = req.body || {};
    const atvId = gerarId('atv');

    db.prepare(`
      INSERT INTO atividades (id, titulo, tipo, salaId, vagas, situacao)
      VALUES (?, ?, ?, ?, ?, 'prevista')
    `).run(atvId, titulo, tipo, salaId, vagas);

    const encontrosCriados = [];
    const insertEncontro = db.prepare(`
      INSERT INTO encontros (id, atividadeId, inicio, fim)
      VALUES (?, ?, ?, ?)
    `);

    for (const enc of encontros) {
      const encId = gerarId('enc');
      insertEncontro.run(encId, atvId, enc.inicio, enc.fim);
      encontrosCriados.push({ id: encId, inicio: enc.inicio, fim: enc.fim });
    }

    res.status(201).json({
      id: atvId,
      titulo,
      tipo,
      salaId,
      vagas,
      encontros: encontrosCriados,
      situacao: 'prevista'
    });
  });

  // POST /atividades/:id/cancelamento
  app.post('/atividades/:id/cancelamento', (req, res) => {
    if (req.usuario.papel !== 'organizacao') {
      return res.status(403).json({ erro: 'SOMENTE_ORGANIZACAO', mensagem: 'Apenas organização pode cancelar atividade' });
    }
    const atividade = db.prepare('SELECT * FROM atividades WHERE id = ?').get(req.params.id);
    if (!atividade) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Atividade não encontrada' });
    }

    db.prepare("UPDATE atividades SET situacao = 'cancelada' WHERE id = ?").run(req.params.id);
    const atualizada = db.prepare('SELECT * FROM atividades WHERE id = ?').get(req.params.id);
    res.json(atualizada);
  });

  // GET /atividades
  app.get('/atividades', (req, res) => {
    const { dia, tipo } = req.query || {};
    let query = 'SELECT * FROM atividades WHERE 1=1';
    const params = [];

    if (tipo) {
      query += ' AND tipo = ?';
      params.push(tipo);
    }

    const atividades = db.prepare(query).all(...params);
    const resultado = [];

    for (const atv of atividades) {
      const encontros = db.prepare('SELECT id, inicio, fim FROM encontros WHERE atividadeId = ? ORDER BY inicio ASC').all(atv.id);

      if (dia) {
        const atendeDia = encontros.some(e => e.inicio.startsWith(dia));
        if (!atendeDia) continue;
      }

      let cargaHorariaMinutos = 0;
      for (const e of encontros) {
        cargaHorariaMinutos += Math.round((new Date(e.fim).getTime() - new Date(e.inicio).getTime()) / 60000);
      }

      const { ocupadas } = db.prepare("SELECT COUNT(*) as ocupadas FROM inscricoes WHERE atividadeId = ? AND status = 'confirmada'").get(atv.id);
      const { emEspera } = db.prepare("SELECT COUNT(*) as emEspera FROM inscricoes WHERE atividadeId = ? AND status = 'em_espera'").get(atv.id);

      resultado.push({
        id: atv.id,
        titulo: atv.titulo,
        tipo: atv.tipo,
        salaId: atv.salaId,
        vagas: atv.vagas,
        encontros,
        cargaHorariaMinutos,
        situacao: atv.situacao,
        ocupadas,
        vagasRestantes: Math.max(0, atv.vagas - ocupadas),
        emEspera
      });
    }

    res.json(resultado);
  });

  // GET /atividades/:id
  app.get('/atividades/:id', (req, res) => {
    const atv = db.prepare('SELECT * FROM atividades WHERE id = ?').get(req.params.id);
    if (!atv) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Atividade não encontrada' });
    }

    const encontros = db.prepare('SELECT id, inicio, fim FROM encontros WHERE atividadeId = ? ORDER BY inicio ASC').all(atv.id);
    let cargaHorariaMinutos = 0;
    for (const e of encontros) {
      cargaHorariaMinutos += Math.round((new Date(e.fim).getTime() - new Date(e.inicio).getTime()) / 60000);
    }

    const { ocupadas } = db.prepare("SELECT COUNT(*) as ocupadas FROM inscricoes WHERE atividadeId = ? AND status = 'confirmada'").get(atv.id);
    const { emEspera } = db.prepare("SELECT COUNT(*) as emEspera FROM inscricoes WHERE atividadeId = ? AND status = 'em_espera'").get(atv.id);

    res.json({
      id: atv.id,
      titulo: atv.titulo,
      tipo: atv.tipo,
      salaId: atv.salaId,
      vagas: atv.vagas,
      encontros,
      cargaHorariaMinutos,
      situacao: atv.situacao,
      ocupadas,
      vagasRestantes: Math.max(0, atv.vagas - ocupadas),
      emEspera
    });
  });

  // ==========================================
  // M2 — Inscrições e Lista de Espera
  // ==========================================

  // POST /atividades/:id/inscricoes
  app.post('/atividades/:id/inscricoes', (req, res) => {
    if (req.usuario.papel !== 'participante') {
      return res.status(403).json({ erro: 'SOMENTE_PARTICIPANTE', mensagem: 'Apenas participantes podem se inscrever em atividades' });
    }

    const agora = relogio.agora();
    expirarConvocacoesVencidas(db, agora);

    const atividade = db.prepare('SELECT * FROM atividades WHERE id = ?').get(req.params.id);
    if (!atividade) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Atividade não encontrada' });
    }

    if (atividade.situacao === 'cancelada') {
      return res.status(422).json({ erro: 'ATIVIDADE_CANCELADA', mensagem: 'Esta atividade foi cancelada' });
    }

    const primeiroEncontro = obterPrimeiroEncontro(db, atividade.id);
    if (primeiroEncontro) {
      const agoraMs = new Date(agora).getTime();
      const inicioMs = new Date(primeiroEncontro.inicio).getTime();
      if (agoraMs >= inicioMs) {
        return res.status(422).json({ erro: 'INSCRICOES_ENCERRADAS', mensagem: 'As inscrições para esta atividade já foram encerradas' });
      }
    }

    const inscricaoAtiva = db.prepare(`
      SELECT * FROM inscricoes 
      WHERE atividadeId = ? AND participanteId = ? AND status IN ('confirmada', 'em_espera', 'convocada')
    `).get(atividade.id, req.usuario.id);

    if (inscricaoAtiva) {
      return res.status(409).json({ erro: 'JA_INSCRITO', mensagem: 'Participante já possui inscrição ativa nesta atividade' });
    }

    if (verificarConflitoDeHorario(db, req.usuario.id, atividade.id)) {
      return res.status(409).json({ erro: 'CONFLITO_DE_HORARIO', mensagem: 'Conflito de horário com outra atividade já inscrita' });
    }

    if (atingiuLimiteDeMinicursos(db, req.usuario.id, atividade.id)) {
      return res.status(422).json({ erro: 'LIMITE_DE_MINICURSOS', mensagem: 'Limite de 2 minicursos simultâneos atingido' });
    }

    const { totalConfirmadas } = db.prepare(`
      SELECT COUNT(*) as totalConfirmadas 
      FROM inscricoes 
      WHERE atividadeId = ? AND status = 'confirmada'
    `).get(atividade.id);

    const novoId = gerarId('ins');
    let status;

    if (totalConfirmadas < atividade.vagas) {
      status = 'confirmada';
    } else {
      status = 'em_espera';
    }

    db.prepare(`
      INSERT INTO inscricoes (id, atividadeId, participanteId, status, convocadaAte, criadaEm)
      VALUES (?, ?, ?, ?, NULL, ?)
    `).run(novoId, atividade.id, req.usuario.id, status, agora);

    const novaInscricao = db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(novoId);
    res.status(201).json(formatarInscricao(db, novaInscricao));
  });

  // GET /inscricoes
  app.get('/inscricoes', (req, res) => {
    const agora = relogio.agora();
    expirarConvocacoesVencidas(db, agora);

    const { atividadeId } = req.query || {};

    let query = 'SELECT * FROM inscricoes WHERE 1=1';
    const params = [];

    if (req.usuario.papel === 'participante') {
      query += ' AND participanteId = ?';
      params.push(req.usuario.id);
    }

    if (atividadeId) {
      query += ' AND atividadeId = ?';
      params.push(atividadeId);
    }

    query += ' ORDER BY criadaEm ASC, id ASC';

    const rows = db.prepare(query).all(...params);
    const resultado = rows.map(r => formatarInscricao(db, r));
    res.json(resultado);
  });

  // GET /inscricoes/:id
  app.get('/inscricoes/:id', (req, res) => {
    const agora = relogio.agora();
    expirarConvocacoesVencidas(db, agora);

    const inscricao = db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(req.params.id);
    if (!inscricao) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Inscrição não encontrada' });
    }

    if (req.usuario.papel === 'participante' && inscricao.participanteId !== req.usuario.id) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Inscrição não encontrada' });
    }

    res.json(formatarInscricao(db, inscricao));
  });

  // POST /inscricoes/:id/cancelamento
  app.post('/inscricoes/:id/cancelamento', (req, res) => {
    if (req.usuario.papel !== 'participante') {
      return res.status(403).json({ erro: 'SOMENTE_PARTICIPANTE', mensagem: 'Apenas participantes podem cancelar inscrição' });
    }

    const agora = relogio.agora();
    expirarConvocacoesVencidas(db, agora);

    const inscricao = db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(req.params.id);
    if (!inscricao || inscricao.participanteId !== req.usuario.id) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Inscrição não encontrada' });
    }

    const primeiroEncontro = obterPrimeiroEncontro(db, inscricao.atividadeId);
    if (primeiroEncontro) {
      const agoraMs = new Date(agora).getTime();
      const inicioMs = new Date(primeiroEncontro.inicio).getTime();
      if (agoraMs >= inicioMs) {
        return res.status(422).json({ erro: 'ATIVIDADE_JA_INICIADA', mensagem: 'A atividade já foi iniciada; não é possível cancelar a inscrição' });
      }
    }

    if (inscricao.status === 'cancelada' || inscricao.status === 'expirada') {
      return res.status(422).json({ erro: 'INSCRICAO_INATIVA', mensagem: 'Esta inscrição já se encontra inativa' });
    }

    const statusAnterior = inscricao.status;

    db.prepare(`
      UPDATE inscricoes 
      SET status = 'cancelada', convocadaAte = NULL 
      WHERE id = ?
    `).run(inscricao.id);

    if (statusAnterior === 'confirmada' || statusAnterior === 'convocada') {
      promoverProximoDaEspera(db, inscricao.atividadeId, agora);
    }

    const cancelada = db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(inscricao.id);
    res.json(formatarInscricao(db, cancelada));
  });

  // POST /inscricoes/:id/confirmacao
  app.post('/inscricoes/:id/confirmacao', (req, res) => {
    if (req.usuario.papel !== 'participante') {
      return res.status(403).json({ erro: 'SOMENTE_PARTICIPANTE', mensagem: 'Apenas participantes podem confirmar convocação' });
    }

    const agora = relogio.agora();

    const inscricao = db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(req.params.id);
    if (!inscricao || inscricao.participanteId !== req.usuario.id) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Inscrição não encontrada' });
    }

    if (inscricao.status === 'expirada') {
      return res.status(422).json({ erro: 'CONVOCACAO_EXPIRADA', mensagem: 'O prazo para confirmar esta convocação expirou' });
    }

    if (inscricao.status !== 'convocada') {
      return res.status(422).json({ erro: 'SEM_CONVOCACAO', mensagem: 'Inscrição não está em processo de convocação' });
    }

    const agoraMs = new Date(agora).getTime();
    const prazoMs = new Date(inscricao.convocadaAte).getTime();
    if (agoraMs > prazoMs) {
      db.prepare("UPDATE inscricoes SET status = 'expirada', convocadaAte = NULL WHERE id = ?").run(inscricao.id);
      promoverProximoDaEspera(db, inscricao.atividadeId, agora);
      return res.status(422).json({ erro: 'CONVOCACAO_EXPIRADA', mensagem: 'O prazo para confirmar esta convocação expirou' });
    }

    if (verificarConflitoDeHorario(db, req.usuario.id, inscricao.atividadeId)) {
      return res.status(409).json({ erro: 'CONFLITO_DE_HORARIO', mensagem: 'Conflito de horário com outra atividade confirmada' });
    }

    if (atingiuLimiteDeMinicursos(db, req.usuario.id, inscricao.atividadeId)) {
      return res.status(422).json({ erro: 'LIMITE_DE_MINICURSOS', mensagem: 'Limite de 2 minicursos simultâneos atingido' });
    }

    db.prepare(`
      UPDATE inscricoes 
      SET status = 'confirmada', convocadaAte = NULL 
      WHERE id = ?
    `).run(inscricao.id);

    const confirmada = db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(inscricao.id);
    res.json(formatarInscricao(db, confirmada));
  });

  // GET /encontros/:id/codigo (Fatia 1: R1, R2, R13)
  app.get('/encontros/:id/codigo', (req, res) => {
    if (req.usuario.papel !== 'organizacao') {
      return res.status(403).json({ erro: 'SOMENTE_ORGANIZACAO', mensagem: 'Apenas a organização pode consultar o código do encontro' });
    }

    const encontro = db.prepare('SELECT * FROM encontros WHERE id = ?').get(req.params.id);
    if (!encontro) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Encontro não encontrado' });
    }

    const atividade = db.prepare('SELECT * FROM atividades WHERE id = ?').get(encontro.atividadeId);
    if (atividade && atividade.situacao === 'cancelada') {
      return res.status(422).json({ erro: 'FORA_DA_JANELA', mensagem: 'Atividade cancelada' });
    }

    const agora = relogio.agora();
    const agoraMs = new Date(agora).getTime();
    const inicioMs = new Date(encontro.inicio).getTime();

    const janelaInicioMs = inicioMs - 15 * 60 * 1000;
    const janelaFimMs = inicioMs + 30 * 60 * 1000;

    if (agoraMs < janelaInicioMs || agoraMs > janelaFimMs) {
      return res.status(422).json({ erro: 'FORA_DA_JANELA', mensagem: 'Consulta fora da janela permitida' });
    }

    const codigoDoEncontro = calcularCodigoDoEncontro(encontro.id, agora);
    res.json(codigoDoEncontro);
  });

  // POST /encontros/:id/presencas (Fatia 2: R2, R3, R4, R5, R10, R13)
  app.post('/encontros/:id/presencas', (req, res) => {
    if (req.usuario.papel !== 'participante') {
      return res.status(403).json({ erro: 'SOMENTE_PARTICIPANTE', mensagem: 'Apenas participantes podem registrar presença' });
    }

    const encontro = db.prepare('SELECT * FROM encontros WHERE id = ?').get(req.params.id);
    if (!encontro) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Encontro não encontrado' });
    }

    // R10 item 2 / R5: Idempotência - Presença já existente
    const presencaExistente = db.prepare(`
      SELECT * FROM presencas 
      WHERE encontroId = ? AND participanteId = ?
    `).get(encontro.id, req.usuario.id);

    if (presencaExistente) {
      return res.status(200).json(presencaExistente);
    }

    // R4: Exigência de inscrição confirmada
    const inscricao = db.prepare(`
      SELECT * FROM inscricoes 
      WHERE atividadeId = ? AND participanteId = ?
    `).get(encontro.atividadeId, req.usuario.id);

    if (!inscricao || inscricao.status !== 'confirmada') {
      return res.status(403).json({ erro: 'NAO_INSCRITO', mensagem: 'Participante não possui inscrição confirmada nesta atividade' });
    }

    const agora = relogio.agora();
    const agoraMs = new Date(agora).getTime();
    const inicioMs = new Date(encontro.inicio).getTime();

    const { codigo, lidoEm } = req.body || {};

    const fimMs = new Date(encontro.fim).getTime();
    const limiteSincronizacaoMs = fimMs + 2 * 60 * 60 * 1000;

    // R10 item 4 / R6: Sincronização offline recebida mais de 2 horas após o fim do encontro
    if (lidoEm && agoraMs > limiteSincronizacaoMs) {
      return res.status(422).json({ erro: 'SINCRONIZACAO_TARDIA', mensagem: 'Sincronização recebida após o prazo limite de 2 horas' });
    }

    const origem = lidoEm ? 'qr_offline' : 'qr';
    let instanteAvaliadoMs = agoraMs;
    let lidoEmFinal = agora;

    if (lidoEm) {
      const lidoEmMs = new Date(lidoEm).getTime();
      if (lidoEmMs > agoraMs) {
        instanteAvaliadoMs = agoraMs;
        lidoEmFinal = agora;
      } else {
        instanteAvaliadoMs = lidoEmMs;
        lidoEmFinal = lidoEm;
      }
    }

    // R3 / R10 item 5: Janela para registro de presença [inicio - 15min, inicio + 30min]
    const janelaInicioMs = inicioMs - 15 * 60 * 1000;
    const janelaFimMs = inicioMs + 30 * 60 * 1000;

    if (instanteAvaliadoMs < janelaInicioMs || instanteAvaliadoMs > janelaFimMs) {
      return res.status(422).json({ erro: 'FORA_DA_JANELA', mensagem: 'Registro de presença fora da janela permitida' });
    }

    if (!codigo || typeof codigo !== 'string' || codigo.length !== 6) {
      return res.status(422).json({ erro: 'DADOS_INVALIDOS', mensagem: 'Código inválido ou ausente' });
    }

    // R2 / R10 item 6: Validação do código QR (minuto atual ou grace period de 1 min)
    const baldeAtual = obterBaldeMinuto(instanteAvaliadoMs);
    const codigoAtual = gerarCodigo(encontro.id, baldeAtual);
    const codigoAnterior = gerarCodigo(encontro.id, baldeAtual - 1);

    if (codigo !== codigoAtual && codigo !== codigoAnterior) {
      return res.status(422).json({ erro: 'CODIGO_INVALIDO', mensagem: 'Código QR inválido ou expirado' });
    }

    const presencaId = gerarId('pre');
    db.prepare(`
      INSERT INTO presencas (id, encontroId, participanteId, origem, lidoEm, registradaEm, justificativa)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `).run(presencaId, encontro.id, req.usuario.id, origem, lidoEmFinal, agora);

    const presencaCriada = db.prepare('SELECT * FROM presencas WHERE id = ?').get(presencaId);
    res.status(201).json(presencaCriada);
  });

  // POST /encontros/:id/presencas/manual (Fatia 4: R7, R8, R9, R4, R5, R11, R13)
  app.post('/encontros/:id/presencas/manual', (req, res) => {
    if (req.usuario.papel !== 'organizacao') {
      return res.status(403).json({ erro: 'SOMENTE_ORGANIZACAO', mensagem: 'Apenas organização pode registrar presença manual' });
    }

    const encontro = db.prepare('SELECT * FROM encontros WHERE id = ?').get(req.params.id);
    if (!encontro) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Encontro não encontrado' });
    }

    const { participanteId, justificativa } = req.body || {};

    // R11 item 1 / R8: Justificativa ausente ou com menos de 10 caracteres após trim
    if (!justificativa || typeof justificativa !== 'string' || justificativa.trim().length < 10) {
      return res.status(422).json({ erro: 'JUSTIFICATIVA_OBRIGATORIA', mensagem: 'Justificativa é obrigatória e deve conter no mínimo 10 caracteres' });
    }

    // R11 item 2 / R5: Idempotência - Presença já existente para o participante no encontro
    const presencaExistente = db.prepare(`
      SELECT * FROM presencas 
      WHERE encontroId = ? AND participanteId = ?
    `).get(encontro.id, participanteId);

    if (presencaExistente) {
      return res.status(200).json(presencaExistente);
    }

    // R11 item 3 / R4: Exigência de inscrição confirmada
    const inscricao = db.prepare(`
      SELECT * FROM inscricoes 
      WHERE atividadeId = ? AND participanteId = ?
    `).get(encontro.atividadeId, participanteId);

    if (!inscricao || inscricao.status !== 'confirmada') {
      return res.status(403).json({ erro: 'NAO_INSCRITO', mensagem: 'Participante não possui inscrição confirmada nesta atividade' });
    }

    const agora = relogio.agora();
    const agoraMs = new Date(agora).getTime();
    const inicioMs = new Date(encontro.inicio).getTime();
    const fimMs = new Date(encontro.fim).getTime();

    // R11 item 4 / R7: Horário da requisição fora da janela estendida [inicio - 15min, fim + 2h]
    const janelaInicioMs = inicioMs - 15 * 60 * 1000;
    const janelaFimMs = fimMs + 2 * 60 * 60 * 1000;

    if (agoraMs < janelaInicioMs || agoraMs > janelaFimMs) {
      return res.status(422).json({ erro: 'FORA_DA_JANELA', mensagem: 'Registro manual fora da janela permitida' });
    }

    // R11 item 5 / R9: Teto percentual de presenças manuais por encontro (10% arredondado para cima)
    const { totalConfirmadas } = db.prepare(`
      SELECT COUNT(*) as totalConfirmadas 
      FROM inscricoes 
      WHERE atividadeId = ? AND status = 'confirmada'
    `).get(encontro.atividadeId);

    const tetoManuais = Math.ceil(totalConfirmadas * 0.1);

    const { totalManuais } = db.prepare(`
      SELECT COUNT(*) as totalManuais 
      FROM presencas 
      WHERE encontroId = ? AND origem = 'manual'
    `).get(encontro.id);

    if (totalManuais >= tetoManuais) {
      return res.status(422).json({ erro: 'LIMITE_DE_MANUAIS', mensagem: 'Limite de presenças manuais atingido para este encontro' });
    }

    const presencaId = gerarId('pre');
    db.prepare(`
      INSERT INTO presencas (id, encontroId, participanteId, origem, lidoEm, registradaEm, justificativa)
      VALUES (?, ?, ?, 'manual', ?, ?, ?)
    `).run(presencaId, encontro.id, participanteId, agora, agora, justificativa);

    const presencaCriada = db.prepare('SELECT * FROM presencas WHERE id = ?').get(presencaId);
    res.status(201).json(presencaCriada);
  });

  // GET /encontros/:id/presencas (Fatia 5: R12, R13)
  app.get('/encontros/:id/presencas', (req, res) => {
    if (req.usuario.papel !== 'organizacao') {
      return res.status(403).json({ erro: 'SOMENTE_ORGANIZACAO', mensagem: 'Apenas a organização pode consultar a lista de presenças' });
    }

    const encontro = db.prepare('SELECT * FROM encontros WHERE id = ?').get(req.params.id);
    if (!encontro) {
      return res.status(404).json({ erro: 'NAO_ENCONTRADO', mensagem: 'Encontro não encontrado' });
    }

    const presencas = db.prepare('SELECT * FROM presencas WHERE encontroId = ?').all(encontro.id);
    presencas.sort((a, b) => {
      const diff = new Date(a.registradaEm).getTime() - new Date(b.registradaEm).getTime();
      if (diff !== 0) return diff;
      return a.participanteId.localeCompare(b.participanteId);
    });

    res.json(presencas);
  });

  return app;
}

module.exports = { criarServidor };
