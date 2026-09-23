import crypto from 'node:crypto';
import { Router } from 'express';
import { exigirOrganizacao } from '../middleware/autorizacao.js';
import { tratarCorpoJson } from '../middleware/json.js';
import {
  validarSintaxeCriacaoAtividade,
  validarQuantidadeEncontros,
  validarEncontros,
  validarCapacidadeSala,
  validarConflitoSala
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

    const atividadeId = `atv_${crypto.randomBytes(4).toString('hex')}`;
    const criadaEm = relogio.obterAgora();

    db.prepare(`
      INSERT INTO atividades (id, titulo, tipo, sala_id, vagas, cancelada, criada_em)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(atividadeId, req.body.titulo, req.body.tipo, req.body.salaId, req.body.vagas, criadaEm);

    const insereEncontro = db.prepare(`
      INSERT INTO encontros (id, atividade_id, inicio, fim, ordem)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < req.body.encontros.length; i++) {
      const enc = req.body.encontros[i];
      const encId = `enc_${crypto.randomBytes(4).toString('hex')}`;
      insereEncontro.run(encId, atividadeId, enc.inicio, enc.fim, i);
    }

    res.status(201).json({});
  });

  return router;
}
