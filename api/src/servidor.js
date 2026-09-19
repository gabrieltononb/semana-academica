const express = require('express');
const crypto = require('node:crypto');
const { criarBanco, carregarDadosIniciais } = require('./db.js');
const { relogio } = require('./relogio.js');
const { calcularCodigoDoEncontro } = require('./codigo-qr.js');

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

  return app;
}

module.exports = { criarServidor };
