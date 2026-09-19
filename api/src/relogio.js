const HORA_INICIAL_TESTE = '2026-10-13T09:00:00-03:00';

class Relogio {
  constructor() {
    this.horaAtual = HORA_INICIAL_TESTE;
  }

  agora() {
    if (process.env.MODO_TESTE === '1') {
      return this.horaAtual;
    }
    return new Date().toISOString();
  }

  definir(novaHora) {
    this.horaAtual = novaHora;
    return this.horaAtual;
  }

  reset() {
    this.horaAtual = HORA_INICIAL_TESTE;
  }
}

const relogio = new Relogio();

module.exports = { relogio, Relogio, HORA_INICIAL_TESTE };
