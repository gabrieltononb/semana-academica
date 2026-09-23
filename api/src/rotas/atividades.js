import { Router } from 'express';
import { exigirOrganizacao } from '../middleware/autorizacao.js';
import { tratarCorpoJson } from '../middleware/json.js';
import {
  validarSintaxeCriacaoAtividade,
  validarQuantidadeEncontros,
  validarEncontros,
  validarCapacidadeSala
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

    res.status(201).json({});
  });

  return router;
}
