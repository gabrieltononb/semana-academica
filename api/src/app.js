import express from 'express';
import { criarBanco } from './banco.js';
import { criarRelogio } from './relogio.js';
import { criarMiddlewareAutenticacao } from './middleware/autenticacao.js';
import { criarRotasTeste } from './rotas/teste.js';
import { criarRotasSalas } from './rotas/salas.js';
import { criarRotasAtividades } from './rotas/atividades.js';

export function criarApp(opcoes = {}) {
  const app = express();
  const db = opcoes.db || criarBanco(opcoes.database || ':memory:');
  const relogio = opcoes.relogio || criarRelogio();


  // Rotas de modo de teste (MODO_TESTE=1)
  if (process.env.MODO_TESTE === '1') {
    app.use('/_teste', criarRotasTeste({ db, relogio }));
  }

  // Middleware de autenticação obrigatória via X-Usuario
  app.use(criarMiddlewareAutenticacao(db));

  // Rotas da aplicação
  app.use('/salas', criarRotasSalas({ db }));
  app.use('/atividades', criarRotasAtividades({ db, relogio }));

  // 404 padrão para recursos não encontrados
  app.use((req, res) => {
    res.status(404).json({
      erro: 'NAO_ENCONTRADO',
      mensagem: 'Recurso não encontrado.'
    });
  });

  return app;
}
