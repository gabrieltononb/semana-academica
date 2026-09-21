const crypto = require('node:crypto');

function gerarId(prefixo) {
  return `${prefixo}_${crypto.randomBytes(4).toString('hex')}`;
}

function obterPrimeiroEncontro(db, atividadeId) {
  return db.prepare(`
    SELECT * FROM encontros 
    WHERE atividadeId = ? 
    ORDER BY inicio ASC 
    LIMIT 1
  `).get(atividadeId);
}

function formatarInscricao(db, row) {
  if (!row) return null;

  let posicaoNaEspera = null;
  if (row.status === 'em_espera') {
    const { count } = db.prepare(`
      SELECT COUNT(*) as count 
      FROM inscricoes 
      WHERE atividadeId = ? 
        AND status = 'em_espera' 
        AND rowid < (SELECT rowid FROM inscricoes WHERE id = ?)
    `).get(row.atividadeId, row.id);
    posicaoNaEspera = count + 1;
  }

  return {
    id: row.id,
    atividadeId: row.atividadeId,
    participanteId: row.participanteId,
    status: row.status,
    posicaoNaEspera,
    convocadaAte: row.status === 'convocada' ? row.convocadaAte : null,
    criadaEm: row.criadaEm,
  };
}

function verificarConflitoDeHorario(db, participanteId, novaAtividadeId) {
  const novosEncontros = db.prepare(`
    SELECT inicio, fim FROM encontros WHERE atividadeId = ?
  `).all(novaAtividadeId);

  if (novosEncontros.length === 0) return false;

  const encontrosExistentes = db.prepare(`
    SELECT e.inicio, e.fim, e.atividadeId 
    FROM encontros e 
    JOIN inscricoes i ON e.atividadeId = i.atividadeId 
    WHERE i.participanteId = ? 
      AND i.status IN ('confirmada', 'convocada') 
      AND i.atividadeId != ?
  `).all(participanteId, novaAtividadeId);

  for (const novo of novosEncontros) {
    const novoInicioMs = new Date(novo.inicio).getTime();
    const novoFimMs = new Date(novo.fim).getTime();

    for (const existente of encontrosExistentes) {
      const exInicioMs = new Date(existente.inicio).getTime();
      const exFimMs = new Date(existente.fim).getTime();

      // Sobreposição estrita: inicioA < fimB && inicioB < fimA
      if (novoInicioMs < exFimMs && exInicioMs < novoFimMs) {
        return true;
      }
    }
  }

  return false;
}

function atingiuLimiteDeMinicursos(db, participanteId, novaAtividadeId = null) {
  const atividade = novaAtividadeId ? db.prepare('SELECT tipo FROM atividades WHERE id = ?').get(novaAtividadeId) : null;
  if (atividade && atividade.tipo !== 'minicurso') {
    return false;
  }

  const { total } = db.prepare(`
    SELECT COUNT(*) as total 
    FROM inscricoes i 
    JOIN atividades a ON i.atividadeId = a.id 
    WHERE i.participanteId = ? 
      AND a.tipo = 'minicurso' 
      AND i.status IN ('confirmada', 'convocada')
  `).get(participanteId);

  return total >= 2;
}

function calcularPrazoConvocacao(db, atividadeId, agora) {
  const agoraMs = new Date(agora).getTime();
  const limite24hMs = agoraMs + 24 * 60 * 60 * 1000;

  const primeiroEncontro = obterPrimeiroEncontro(db, atividadeId);
  if (primeiroEncontro) {
    const inicioMs = new Date(primeiroEncontro.inicio).getTime();
    if (inicioMs < limite24hMs) {
      return primeiroEncontro.inicio;
    }
  }

  return new Date(limite24hMs).toISOString();
}

function promoverProximoDaEspera(db, atividadeId, agora) {
  const proximo = db.prepare(`
    SELECT * FROM inscricoes 
    WHERE atividadeId = ? AND status = 'em_espera' 
    ORDER BY rowid ASC 
    LIMIT 1
  `).get(atividadeId);

  if (!proximo) return null;

  const convocadaAte = calcularPrazoConvocacao(db, atividadeId, agora);

  db.prepare(`
    UPDATE inscricoes 
    SET status = 'convocada', convocadaAte = ? 
    WHERE id = ?
  `).run(convocadaAte, proximo.id);

  const atualizado = db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(proximo.id);
  return formatarInscricao(db, atualizado);
}

function expirarConvocacoesVencidas(db, agora) {
  const agoraMs = new Date(agora).getTime();
  const vencidas = db.prepare(`
    SELECT * FROM inscricoes 
    WHERE status = 'convocada' AND convocadaAte IS NOT NULL
  `).all();

  for (const inscricao of vencidas) {
    const prazoMs = new Date(inscricao.convocadaAte).getTime();
    if (agoraMs > prazoMs) {
      db.prepare(`
        UPDATE inscricoes 
        SET status = 'expirada' 
        WHERE id = ?
      `).run(inscricao.id);

      promoverProximoDaEspera(db, inscricao.atividadeId, agora);
    }
  }
}

module.exports = {
  gerarId,
  obterPrimeiroEncontro,
  formatarInscricao,
  verificarConflitoDeHorario,
  atingiuLimiteDeMinicursos,
  calcularPrazoConvocacao,
  promoverProximoDaEspera,
  expirarConvocacoesVencidas,
};
