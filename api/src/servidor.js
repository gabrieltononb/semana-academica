const express = require('express');
const crypto = require('node:crypto');
const { criarBanco, carregarDadosIniciais } = require('./db.js');
const { relogio } = require('./relogio.js');
const { calcularCodigoDoEncontro, gerarCodigo, obterBaldeMinuto } = require('./codigo-qr.js');

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

  return app;
}

module.exports = { criarServidor };
