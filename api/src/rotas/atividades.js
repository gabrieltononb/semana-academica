import { Router } from 'express';
import { exigirOrganizacao } from '../middleware/autorizacao.js';

export function criarRotasAtividades({ db, relogio }) {
  const router = Router();

  router.post('/', exigirOrganizacao, (req, res) => {
    res.status(201).json({});
  });

  return router;
}
