export function exigirOrganizacao(req, res, next) {
  if (req.usuario?.papel !== 'organizacao') {
    return res.status(403).json({
      erro: 'SOMENTE_ORGANIZACAO',
      mensagem: 'Apenas usuários da organização podem realizar esta operação.'
    });
  }
  next();
}
