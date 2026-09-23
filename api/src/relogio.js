const HORA_INICIAL_TESTE = '2026-10-13T09:00:00-03:00';

export function criarRelogio() {
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
