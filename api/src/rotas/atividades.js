import { Router } from 'express';
import { exigirOrganizacao } from '../middleware/autorizacao.js';
import { tratarCorpoJson } from '../middleware/json.js';

export function criarRotasAtividades({ db, relogio }) {
  const router = Router();

  router.post('/', exigirOrganizacao, tratarCorpoJson, (req, res) => {
    res.status(201).json({});
  });

  return router;
}
