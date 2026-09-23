import { Router } from 'express';

export function criarRotasSalas({ db }) {
  const router = Router();
  const buscaSalas = db.prepare('SELECT id, nome, capacidade FROM salas');

  router.get('/', (req, res) => {
    const salas = buscaSalas.all();
    res.status(200).json(salas);
  });

  return router;
}
