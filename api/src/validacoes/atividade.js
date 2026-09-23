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

export function validarQuantidadeEncontros(tipo, encontros) {
  if (tipo === 'palestra' && encontros.length !== 1) {
    return {
      valido: false,
      erro: 'QUANTIDADE_DE_ENCONTROS',
      mensagem: 'Atividade do tipo palestra deve ter exatamente 1 encontro.'
    };
  }

  if (tipo === 'minicurso' && (encontros.length < 2 || encontros.length > 5)) {
    return {
      valido: false,
      erro: 'QUANTIDADE_DE_ENCONTROS',
      mensagem: 'Atividade do tipo minicurso deve ter entre 2 e 5 encontros.'
    };
  }

  return { valido: true };
}

export function obterDiaBrasilia(timestampMs) {
  const offsetMs = -3 * 60 * 60 * 1000;
  const d = new Date(timestampMs + offsetMs);
  const ano = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function validarEncontros(encontros) {
  const DIA_INICIO_EVENTO = '2026-10-19';
  const DIA_FIM_EVENTO = '2026-10-23';

  const intervalos = [];

  for (const e of encontros) {
    const inicioMs = Date.parse(e.inicio);
    const fimMs = Date.parse(e.fim);

    if (fimMs <= inicioMs) {
      return {
        valido: false,
        erro: 'ENCONTRO_INVALIDO',
        mensagem: 'O término do encontro deve ser posterior ao início.'
      };
    }

    const duracaoMinutos = (fimMs - inicioMs) / 60000;
    if (duracaoMinutos < 60 || duracaoMinutos > 240) {
      return {
        valido: false,
        erro: 'ENCONTRO_INVALIDO',
        mensagem: 'A duração do encontro deve ser entre 60 e 240 minutos.'
      };
    }

    const diaInicio = obterDiaBrasilia(inicioMs);
    const diaFim = obterDiaBrasilia(fimMs);

    if (diaInicio !== diaFim) {
      return {
        valido: false,
        erro: 'ENCONTRO_INVALIDO',
        mensagem: 'O encontro deve iniciar e terminar no mesmo dia civil no horário de Brasília.'
      };
    }

    if (diaInicio < DIA_INICIO_EVENTO || diaInicio > DIA_FIM_EVENTO) {
      return {
        valido: false,
        erro: 'ENCONTRO_INVALIDO',
        mensagem: 'O encontro deve ocorrer durante o período oficial do evento (19 a 23/10/2026).'
      };
    }

    intervalos.push({ inicioMs, fimMs });
  }

  // Verifica sobreposição interna entre encontros da mesma atividade
  for (let i = 0; i < intervalos.length; i++) {
    for (let j = i + 1; j < intervalos.length; j++) {
      const a = intervalos[i];
      const b = intervalos[j];
      if (Math.max(a.inicioMs, b.inicioMs) < Math.min(a.fimMs, b.fimMs)) {
        return {
          valido: false,
          erro: 'ENCONTRO_INVALIDO',
          mensagem: 'Encontros da mesma atividade não podem possuir horários sobrepostos.'
        };
      }
    }
  }

  return { valido: true };
}

export function validarCapacidadeSala(vagas, sala) {
  if (vagas > sala.capacidade) {
    return {
      valido: false,
      erro: 'VAGAS_ACIMA_DA_CAPACIDADE',
      mensagem: `Número de vagas (${vagas}) excede a capacidade da sala (${sala.capacidade}).`
    };
  }
  return { valido: true };
}

export function validarConflitoSala(db, salaId, encontros) {
  const buscaEncontrosExistentes = db.prepare(`
    SELECT e.inicio, e.fim
    FROM encontros e
    JOIN atividades a ON a.id = e.atividade_id
    WHERE a.sala_id = ? AND a.cancelada = 0
  `);

  const existentes = buscaEncontrosExistentes.all(salaId);
  const INTERVALO_MINIMO_MS = 15 * 60 * 1000;

  for (const novo of encontros) {
    const novoInicioMs = Date.parse(novo.inicio);
    const novoFimMs = Date.parse(novo.fim);

    for (const ex of existentes) {
      const exInicioMs = Date.parse(ex.inicio);
      const exFimMs = Date.parse(ex.fim);

      const semConflito =
        (novoFimMs + INTERVALO_MINIMO_MS <= exInicioMs) ||
        (novoInicioMs >= exFimMs + INTERVALO_MINIMO_MS);

      if (!semConflito) {
        return {
          valido: false,
          erro: 'CONFLITO_DE_SALA',
          mensagem: 'Conflito de horário ou intervalo inferior a 15 minutos na sala.'
        };
      }
    }
  }

  return { valido: true };
}




