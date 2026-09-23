const ISO_8601_FUSO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function ehDataComFusoValida(valor) {
  if (typeof valor !== 'string') return false;
  if (!ISO_8601_FUSO_REGEX.test(valor)) return false;
  const timestamp = Date.parse(valor);
  return !Number.isNaN(timestamp);
}

export function validarSintaxeCriacaoAtividade(body, db) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valido: false, erro: 'DADOS_INVALIDOS', mensagem: 'Corpo da requisição deve ser um objeto JSON.' };
  }

  const { titulo, tipo, salaId, vagas, encontros } = body;

  if (typeof titulo !== 'string' || titulo.trim() === '') {
    return { valido: false, erro: 'DADOS_INVALIDOS', mensagem: 'Título deve ser uma string não vazia.' };
  }

  if (tipo !== 'palestra' && tipo !== 'minicurso') {
    return { valido: false, erro: 'DADOS_INVALIDOS', mensagem: 'Tipo deve ser "palestra" ou "minicurso".' };
  }

  if (typeof vagas !== 'number' || !Number.isInteger(vagas) || vagas < 1) {
    return { valido: false, erro: 'DADOS_INVALIDOS', mensagem: 'Vagas deve ser um número inteiro maior ou igual a 1.' };
  }

  if (typeof salaId !== 'string') {
    return { valido: false, erro: 'DADOS_INVALIDOS', mensagem: 'salaId deve ser uma string.' };
  }

  const sala = db.prepare('SELECT id, capacidade FROM salas WHERE id = ?').get(salaId);
  if (!sala) {
    return { valido: false, erro: 'DADOS_INVALIDOS', mensagem: 'Sala informada não existe.' };
  }

  if (!Array.isArray(encontros) || encontros.length === 0) {
    return { valido: false, erro: 'DADOS_INVALIDOS', mensagem: 'Encontros deve ser um array não vazio.' };
  }

  for (const e of encontros) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) {
      return { valido: false, erro: 'DADOS_INVALIDOS', mensagem: 'Cada encontro deve ser um objeto.' };
    }
    if (!ehDataComFusoValida(e.inicio) || !ehDataComFusoValida(e.fim)) {
      return { valido: false, erro: 'DADOS_INVALIDOS', mensagem: 'Datas de encontro devem estar no formato ISO 8601 com fuso horário.' };
    }
  }

  return { valido: true, sala };
}
