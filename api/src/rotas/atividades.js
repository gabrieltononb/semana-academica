import { Router } from 'express';
import { exigirOrganizacao } from '../middleware/autorizacao.js';
import { tratarCorpoJson } from '../middleware/json.js';
import { validarSintaxeCriacaoAtividade } from '../validacoes/atividade.js';

export function criarRotasAtividades({ db, relogio }) {
  const router = Router();

  router.post('/', exigirOrganizacao, tratarCorpoJson, (req, res) => {
    const validacao = validarSintaxeCriacaoAtividade(req.body, db);
    if (!validacao.valido) {
      return res.status(422).json({
        erro: validacao.erro,
        mensagem: validacao.mensagem
      });
    }

    res.status(201).json({});
  });

  return router;
}
