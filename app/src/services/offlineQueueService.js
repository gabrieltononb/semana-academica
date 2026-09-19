import { registrarPresenca } from './presencaService.js';

export const OFFLINE_QUEUE_KEY = '@semana-academica:presencas_offline';
export const QUEUE_EVENT_NAME = 'offline-queue-changed';

export function obterFila() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function salvarFila(fila) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(fila));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(QUEUE_EVENT_NAME, { detail: { fila } }));
    }
  } catch (err) {
    console.error('Erro ao salvar fila offline no localStorage:', err);
  }
}

export function enfileirarLeitura({ encontroId, participanteId, codigo, lidoEm }) {
  const agora = new Date().toISOString();
  const item = {
    idFila: `fila_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    encontroId,
    participanteId: participanteId || 'p-carla',
    codigo: (codigo || '').trim().toUpperCase(),
    lidoEm: lidoEm || agora,
    criadoEm: agora,
    status: 'pendente',
    tentativas: 0,
    ultimoErro: null,
  };

  const fila = obterFila();
  fila.push(item);
  salvarFila(fila);
  return item;
}

export function removerDaFila(idFila) {
  const fila = obterFila();
  const novaFila = fila.filter((item) => item.idFila !== idFila);
  salvarFila(novaFila);
}

export function limparFila() {
  salvarFila([]);
}

export async function sincronizarFila(onProgresso) {
  const fila = obterFila();
  if (fila.length === 0) {
    return { total: 0, sincronizados: 0, falhas: [] };
  }

  const resultados = {
    total: fila.length,
    sincronizados: 0,
    falhas: [],
  };

  // Copia dos itens pendentes para processar
  const pendentes = [...fila];

  for (const item of pendentes) {
    try {
      const res = await registrarPresenca(
        item.encontroId,
        { codigo: item.codigo, lidoEm: item.lidoEm },
        item.participanteId
      );

      // Sucesso (201 Created ou 200 OK idempotente)
      resultados.sincronizados += 1;
      removerDaFila(item.idFila);

      if (onProgresso) {
        onProgresso({
          tipo: 'sucesso',
          item,
          status: res.status,
          presenca: res.presenca,
        });
      }
    } catch (err) {
      if (err.isNetworkError) {
        // Ainda sem conexão, aborta o restante do envio em lote
        resultados.falhas.push({
          item,
          motivo: 'sem_conexao',
          mensagem: 'Sem conexão com a internet',
        });
        break;
      }

      // Erro da API (rejeição de negócio: 422 SINCRONIZACAO_TARDIA, 422 CODIGO_INVALIDO, 403, etc.)
      // Remove da fila pendente ativa para não travar o fluxo e registra a falha
      removerDaFila(item.idFila);
      resultados.falhas.push({
        item,
        motivo: err.erro || 'ERRO_API',
        mensagem: err.mensagem || 'Falha ao registrar presença offline',
        status: err.status,
      });

      if (onProgresso) {
        onProgresso({
          tipo: 'erro',
          item,
          erro: err.erro,
          mensagem: err.mensagem,
        });
      }
    }
  }

  return resultados;
}
