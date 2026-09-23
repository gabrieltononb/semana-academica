import express from 'express';

export const tratarCorpoJson = [
  express.json(),
  (err, req, res, next) => {
    if (err instanceof SyntaxError && (err.status === 400 || 'body' in err)) {
      return res.status(422).json({
        erro: 'DADOS_INVALIDOS',
        mensagem: 'Corpo da requisição não é um JSON válido.'
      });
    }
    next(err);
  }
];
