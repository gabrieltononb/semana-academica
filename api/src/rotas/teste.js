import express, { Router } from 'express';
import { resetarBanco } from '../banco.js';

export function criarRotasTeste({ db, relogio }) {
  const router = Router();
  router.use(express.json());


  router.post('/reset', (req, res) => {
    resetarBanco(db);
    relogio.resetar();
    res.status(204).end();
  });

  router.get('/relogio', (req, res) => {
    res.status(200).json({ agora: relogio.obterAgora() });
  });

  router.put('/relogio', (req, res) => {
    const { agora } = req.body || {};
    if (!agora) {
      return res.status(422).json({
        erro: 'DADOS_INVALIDOS',
        mensagem: 'Campo "agora" é obrigatório no corpo.'
      });
    }
    relogio.definirAgora(agora);
    res.status(200).json({ agora: relogio.obterAgora() });
  });

  return router;
}
