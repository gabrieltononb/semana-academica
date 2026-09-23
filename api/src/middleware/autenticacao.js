export function criarMiddlewareAutenticacao(db) {
  const buscaUsuario = db.prepare('SELECT id, nome, papel FROM usuarios WHERE id = ?');

  return (req, res, next) => {
    // Rotas isentas de autenticação conforme o contrato
    if (req.path.startsWith('/_teste/') || (req.method === 'GET' && req.path.startsWith('/certificados/'))) {
      return next();
    }

    const usuarioId = req.headers['x-usuario'];
    if (!usuarioId) {
      return res.status(401).json({
        erro: 'USUARIO_DESCONHECIDO',
        mensagem: 'Cabeçalho X-Usuario não informado.'
      });
    }

    const usuario = buscaUsuario.get(usuarioId);
    if (!usuario) {
      return res.status(401).json({
        erro: 'USUARIO_DESCONHECIDO',
        mensagem: 'Usuário informado não consta nos registros.'
      });
    }

    req.usuario = usuario;
    next();
  };
}
