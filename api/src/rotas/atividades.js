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
  calcularSituacao
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

  return router;
}
