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

function criarRelogio() {
  let agoraSimulado = HORA_INICIAL_TESTE;

  return {
    obterAgora() {
      if (process.env.MODO_TESTE === '1') {
        return agoraSimulado;
      }
      return new Date().toISOString();
    },
    definirAgora(iso) {
      agoraSimulado = iso;
      return agoraSimulado;
    },
    resetar() {
      agoraSimulado = HORA_INICIAL_TESTE;
      return agoraSimulado;
    }
  };
}

module.exports = { relogio, Relogio, HORA_INICIAL_TESTE, criarRelogio };
