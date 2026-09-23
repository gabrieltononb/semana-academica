import crypto from 'node:crypto';
import { Router } from 'express';
import { exigirOrganizacao } from '../middleware/autorizacao.js';
import { tratarCorpoJson } from '../middleware/json.js';
import {
  validarSintaxeCriacaoAtividade,
  validarQuantidadeEncontros,
  validarEncontros,
  validarCapacidadeSala,
  validarConflitoSala,
  calcularSituacao,
  obterDiaBrasilia
} from '../validacoes/atividade.js';

export function criarRotasAtividades({ db, relogio }) {
  const router = Router();

  router.post('/', exigirOrganizacao, tratarCorpoJson, (req, res) => {
    const validacaoSintaxe = validarSintaxeCriacaoAtividade(req.body, db);
    if (!validacaoSintaxe.valido) {
      return res.status(422).json({
        erro: validacaoSintaxe.erro,
        mensagem: validacaoSintaxe.mensagem
      });
    }

    const validacaoQtd = validarQuantidadeEncontros(req.body.tipo, req.body.encontros);
    if (!validacaoQtd.valido) {
      return res.status(422).json({
        erro: validacaoQtd.erro,
        mensagem: validacaoQtd.mensagem
      });
    }

    const validacaoEncontros = validarEncontros(req.body.encontros);
    if (!validacaoEncontros.valido) {
      return res.status(422).json({
        erro: validacaoEncontros.erro,
        mensagem: validacaoEncontros.mensagem
      });
    }

    const validacaoCapacidade = validarCapacidadeSala(req.body.vagas, validacaoSintaxe.sala);
    if (!validacaoCapacidade.valido) {
      return res.status(422).json({
        erro: validacaoCapacidade.erro,
        mensagem: validacaoCapacidade.mensagem
      });
    }

    const validacaoConflito = validarConflitoSala(db, req.body.salaId, req.body.encontros);
    if (!validacaoConflito.valido) {
      return res.status(409).json({
        erro: validacaoConflito.erro,
        mensagem: validacaoConflito.mensagem
      });
    }

    const encontrosOrdenados = [...req.body.encontros].sort((a, b) => {
      return Date.parse(a.inicio) - Date.parse(b.inicio);
    });

    let cargaHorariaMinutos = 0;
    const encontrosComId = encontrosOrdenados.map((enc) => {
      const duracao = (Date.parse(enc.fim) - Date.parse(enc.inicio)) / 60000;
      cargaHorariaMinutos += duracao;
      return {
        id: `enc_${crypto.randomBytes(4).toString('hex')}`,
        inicio: enc.inicio,
        fim: enc.fim
      };
    });

    const atividadeId = `atv_${crypto.randomBytes(4).toString('hex')}`;
    const criadaEm = relogio.obterAgora();
    const situacao = calcularSituacao(criadaEm, encontrosComId, false);

    db.prepare(`
      INSERT INTO atividades (id, titulo, tipo, sala_id, vagas, cancelada, criada_em)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(atividadeId, req.body.titulo, req.body.tipo, req.body.salaId, req.body.vagas, criadaEm);

    const insereEncontro = db.prepare(`
      INSERT INTO encontros (id, atividade_id, inicio, fim, ordem)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < encontrosComId.length; i++) {
      const enc = encontrosComId[i];
      insereEncontro.run(enc.id, atividadeId, enc.inicio, enc.fim, i);
    }

    res.status(201).json({
      id: atividadeId,
      titulo: req.body.titulo,
      tipo: req.body.tipo,
      salaId: req.body.salaId,
      vagas: req.body.vagas,
      encontros: encontrosComId,
      cargaHorariaMinutos,
      situacao,
      ocupadas: 0,
      vagasRestantes: req.body.vagas,
      emEspera: 0
    });
  });

  router.get('/', (req, res) => {
    const { dia, tipo } = req.query;
    const atividades = db.prepare('SELECT * FROM atividades').all();
    const agoraIso = relogio.obterAgora();

    let dtos = atividades.map((atividade) => {
      const encontros = db.prepare('SELECT id, inicio, fim, ordem FROM encontros WHERE atividade_id = ? ORDER BY inicio ASC').all(atividade.id);
      return montarAtividadeDTO(atividade, encontros, agoraIso, db);
    });

    if (dia) {
      dtos = dtos.filter((atv) => {
        return atv.encontros.some((enc) => {
          return obterDiaBrasilia(Date.parse(enc.inicio)) === dia;
        });
      });
    }

    if (tipo) {
      dtos = dtos.filter((atv) => atv.tipo === tipo);
    }

    dtos.sort((a, b) => {
      const inicioA = a.encontros[0] ? Date.parse(a.encontros[0].inicio) : 0;
      const inicioB = b.encontros[0] ? Date.parse(b.encontros[0].inicio) : 0;
      if (inicioA !== inicioB) {
        return inicioA - inicioB;
      }
      return a.titulo.localeCompare(b.titulo);
    });

    res.json(dtos);
  });

  router.get('/:id', (req, res) => {
    const atividade = db.prepare('SELECT * FROM atividades WHERE id = ?').get(req.params.id);
    if (!atividade) {
      return res.status(404).json({
        erro: 'NAO_ENCONTRADO',
        mensagem: 'Atividade não encontrada.'
      });
    }

    const encontros = db.prepare('SELECT id, inicio, fim, ordem FROM encontros WHERE atividade_id = ? ORDER BY inicio ASC').all(atividade.id);
    const dto = montarAtividadeDTO(atividade, encontros, relogio.obterAgora(), db);
    res.json(dto);
  });

  router.patch('/:id', exigirOrganizacao, tratarCorpoJson, (req, res) => {
    const atividade = db.prepare('SELECT * FROM atividades WHERE id = ?').get(req.params.id);
    if (!atividade) {
      return res.status(404).json({
        erro: 'NAO_ENCONTRADO',
        mensagem: 'Atividade não encontrada.'
      });
    }

    if (atividade.cancelada === 1) {
      return res.status(422).json({
        erro: 'ATIVIDADE_CANCELADA',
        mensagem: 'Não é possível alterar uma atividade cancelada.'
      });
    }

    const camposPermitidos = new Set(['titulo', 'vagas']);
    for (const chave of Object.keys(req.body)) {
      if (!camposPermitidos.has(chave)) {
        return res.status(422).json({
          erro: 'CAMPO_NAO_EDITAVEL',
          mensagem: `O campo '${chave}' não pode ser alterado.`
        });
      }
    }

    if (req.body.vagas !== undefined) {
      if (typeof req.body.vagas !== 'number' || !Number.isInteger(req.body.vagas) || req.body.vagas < 1) {
        return res.status(422).json({
          erro: 'DADOS_INVALIDOS',
          mensagem: 'Vagas deve ser um número inteiro maior ou igual a 1.'
        });
      }

      const sala = db.prepare('SELECT id, capacidade FROM salas WHERE id = ?').get(atividade.sala_id);
      const validacaoCapacidade = validarCapacidadeSala(req.body.vagas, sala);
      if (!validacaoCapacidade.valido) {
        return res.status(422).json({
          erro: validacaoCapacidade.erro,
          mensagem: validacaoCapacidade.mensagem
        });
      }

      const contagemOcupadas = db.prepare(`
        SELECT COUNT(*) AS total
        FROM inscricoes
        WHERE atividade_id = ? AND status IN ('confirmada', 'convocada')
      `).get(atividade.id)?.total || 0;

      if (req.body.vagas < contagemOcupadas) {
        return res.status(409).json({
          erro: 'VAGAS_ABAIXO_DOS_INSCRITOS',
          mensagem: `Número de vagas (${req.body.vagas}) não pode ser inferior ao número de inscrições ocupadas (${contagemOcupadas}).`
        });
      }

      if (req.body.vagas > atividade.vagas) {
        const novasVagas = req.body.vagas - atividade.vagas;
        const emEspera = db.prepare(`
          SELECT id
          FROM inscricoes
          WHERE atividade_id = ? AND status = 'em_espera'
          ORDER BY posicao_na_espera ASC, criada_em ASC
        `).all(atividade.id);

        const convocadas = emEspera.slice(0, novasVagas);
        const restantes = emEspera.slice(novasVagas);

        const atualizaConvocada = db.prepare(`
          UPDATE inscricoes
          SET status = 'convocada', posicao_na_espera = NULL
          WHERE id = ?
        `);
        for (const c of convocadas) {
          atualizaConvocada.run(c.id);
        }

        const atualizaRestante = db.prepare(`
          UPDATE inscricoes
          SET posicao_na_espera = ?
          WHERE id = ?
        `);
        for (let i = 0; i < restantes.length; i++) {
          atualizaRestante.run(i + 1, restantes[i].id);
        }
      }

      db.prepare('UPDATE atividades SET vagas = ? WHERE id = ?').run(req.body.vagas, atividade.id);
    }

    if (req.body.titulo !== undefined) {
      if (typeof req.body.titulo !== 'string' || req.body.titulo.trim() === '') {
        return res.status(422).json({
          erro: 'DADOS_INVALIDOS',
          mensagem: 'Título deve ser uma string não vazia.'
        });
      }
      db.prepare('UPDATE atividades SET titulo = ? WHERE id = ?').run(req.body.titulo, atividade.id);
    }

    const atividadeAtualizada = db.prepare('SELECT * FROM atividades WHERE id = ?').get(atividade.id);
    const encontros = db.prepare('SELECT id, inicio, fim, ordem FROM encontros WHERE atividade_id = ? ORDER BY inicio ASC').all(atividade.id);
    const dto = montarAtividadeDTO(atividadeAtualizada, encontros, relogio.obterAgora(), db);
    res.json(dto);
  });

  router.post('/:id/cancelamento', exigirOrganizacao, (req, res) => {
    const atividade = db.prepare('SELECT * FROM atividades WHERE id = ?').get(req.params.id);
    if (!atividade) {
      return res.status(404).json({
        erro: 'NAO_ENCONTRADO',
        mensagem: 'Atividade não encontrada.'
      });
    }

    if (atividade.cancelada === 1) {
      return res.status(422).json({
        erro: 'ATIVIDADE_CANCELADA',
        mensagem: 'Atividade já se encontra cancelada.'
      });
    }

    const primeiroEncontro = db.prepare(`
      SELECT inicio
      FROM encontros
      WHERE atividade_id = ?
      ORDER BY inicio ASC
      LIMIT 1
    `).get(atividade.id);

    if (primeiroEncontro) {
      const agoraMs = Date.parse(relogio.obterAgora());
      const inicioMs = Date.parse(primeiroEncontro.inicio);
      if (agoraMs >= inicioMs) {
        return res.status(422).json({
          erro: 'ATIVIDADE_JA_INICIADA',
          mensagem: 'Não é possível cancelar uma atividade que já foi iniciada.'
        });
      }
    }

    db.prepare('UPDATE atividades SET cancelada = 1 WHERE id = ?').run(atividade.id);

    const atividadeAtualizada = db.prepare('SELECT * FROM atividades WHERE id = ?').get(atividade.id);
    const encontros = db.prepare('SELECT id, inicio, fim, ordem FROM encontros WHERE atividade_id = ? ORDER BY inicio ASC').all(atividade.id);
    const dto = montarAtividadeDTO(atividadeAtualizada, encontros, relogio.obterAgora(), db);
    res.json(dto);
  });

  return router;
}

export function montarAtividadeDTO(atividadeRow, encontrosRows, agoraIso, db) {
  const encontrosOrdenados = [...encontrosRows].sort((a, b) => {
    return Date.parse(a.inicio) - Date.parse(b.inicio);
  });

  let cargaHorariaMinutos = 0;
  const encontrosFormatados = encontrosOrdenados.map((enc) => {
    const duracao = (Date.parse(enc.fim) - Date.parse(enc.inicio)) / 60000;
    cargaHorariaMinutos += duracao;
    return {
      id: enc.id,
      inicio: enc.inicio,
      fim: enc.fim
    };
  });

  const situacao = calcularSituacao(agoraIso, encontrosFormatados, atividadeRow.cancelada === 1);

  let ocupadas = 0;
  let emEspera = 0;
  const temInscricoes = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='inscricoes'").get();
  if (temInscricoes) {
    const contagem = db.prepare(`
      SELECT
        SUM(CASE WHEN status IN ('confirmada', 'convocada') THEN 1 ELSE 0 END) AS ocupadas,
        SUM(CASE WHEN status = 'em_espera' THEN 1 ELSE 0 END) AS em_espera
      FROM inscricoes
      WHERE atividade_id = ?
    `).get(atividadeRow.id);

    ocupadas = contagem?.ocupadas || 0;
    emEspera = contagem?.em_espera || 0;
  }

  const vagasRestantes = Math.max(0, atividadeRow.vagas - ocupadas);

  return {
    id: atividadeRow.id,
    titulo: atividadeRow.titulo,
    tipo: atividadeRow.tipo,
    salaId: atividadeRow.sala_id,
    vagas: atividadeRow.vagas,
    encontros: encontrosFormatados,
    cargaHorariaMinutos,
    situacao,
    ocupadas,
    vagasRestantes,
    emEspera
  };
}
