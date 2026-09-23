const crypto = require('node:crypto');

const ALFABETO = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function extrairFuso(dataIso) {
  if (dataIso.endsWith('Z')) return 'Z';
  const match = dataIso.match(/([+-]\d{2}:\d{2})$/);
  return match ? match[1] : '-03:00';
}

function formatarComFuso(timestampMs, fuso) {
  if (fuso === 'Z') {
    return new Date(timestampMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  const [sinal, horas, minutos] = [
    fuso[0],
    parseInt(fuso.slice(1, 3), 10),
    parseInt(fuso.slice(4, 6), 10)
  ];
  const offsetMin = (horas * 60 + minutos) * (sinal === '+' ? 1 : -1);
  const dataComOffset = new Date(timestampMs + offsetMin * 60000);

  const ano = dataComOffset.getUTCFullYear();
  const mes = String(dataComOffset.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(dataComOffset.getUTCDate()).padStart(2, '0');
  const h = String(dataComOffset.getUTCHours()).padStart(2, '0');
  const m = String(dataComOffset.getUTCMinutes()).padStart(2, '0');
  const s = String(dataComOffset.getUTCSeconds()).padStart(2, '0');

  return `${ano}-${mes}-${dia}T${h}:${m}:${s}${fuso}`;
}

function obterBaldeMinuto(timestampMs) {
  return Math.floor(timestampMs / 60000);
}

function gerarCodigo(encontroId, baldeMinuto) {
  const hash = crypto.createHash('sha256').update(`${encontroId}:${baldeMinuto}`).digest();
  let codigo = '';
  for (let i = 0; i < 6; i++) {
    codigo += ALFABETO[hash[i] % ALFABETO.length];
  }
  return codigo;
}

function calcularCodigoDoEncontro(encontroId, dataHoraIso) {
  const fuso = extrairFuso(dataHoraIso);
  const dataMs = new Date(dataHoraIso).getTime();
  const balde = obterBaldeMinuto(dataMs);

  const codigo = gerarCodigo(encontroId, balde);
  const trocaEmMs = (balde + 1) * 60000;
  const validoAteMs = (balde + 2) * 60000;

  return {
    encontroId,
    codigo,
    trocaEm: formatarComFuso(trocaEmMs, fuso),
    validoAte: formatarComFuso(validoAteMs, fuso)
  };
}

module.exports = {
  calcularCodigoDoEncontro,
  gerarCodigo,
  obterBaldeMinuto,
  formatarComFuso
};
