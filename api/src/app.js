import express from 'express';
import { criarBanco } from './banco.js';
import { criarRelogio } from './relogio.js';
import { criarMiddlewareAutenticacao } from './middleware/autenticacao.js';
import { criarRotasTeste } from './rotas/teste.js';
import { criarRotasSalas } from './rotas/salas.js';

export function criarApp(opcoes = {}) {
  const app = express();
  const db = opcoes.db || criarBanco(opcoes.database || ':memory:');
  const relogio = opcoes.relogio || criarRelogio();

  app.use(express.json());

  // Tratamento de corpo JSON inválido -> 422 DADOS_INVALIDOS
  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(422).json({
        erro: 'DADOS_INVALIDOS',
        mensagem: 'Corpo da requisição não é um JSON válido.'
      });
    }
    next(err);
  });

  // Rotas de modo de teste (MODO_TESTE=1)
  if (process.env.MODO_TESTE === '1') {
    app.use('/_teste', criarRotasTeste({ db, relogio }));
  }

  // Middleware de autenticação obrigatória via X-Usuario
  app.use(criarMiddlewareAutenticacao(db));

  // Rotas da aplicação
  app.use('/salas', criarRotasSalas({ db }));

  // 404 padrão para recursos não encontrados
  app.use((req, res) => {
    res.status(404).json({
      erro: 'NAO_ENCONTRADO',
      mensagem: 'Recurso não encontrado.'
    });
  });

  return app;
}
