import { useState, useEffect, useCallback, useRef } from 'react';
import {
  obterFila,
  sincronizarFila,
  QUEUE_EVENT_NAME,
} from '../services/offlineQueueService.js';

export function useOfflineSync(isOnline = true) {
  const [fila, setFila] = useState(() => obterFila());
  const [isSincronizando, setIsSincronizando] = useState(false);
  const [ultimoRelatorio, setUltimoRelatorio] = useState(null);

  const atualizarFila = useCallback(() => {
    setFila(obterFila());
  }, []);

  // Escuta alterações na fila
  useEffect(() => {
    const handleQueueChange = (e) => {
      if (e.detail?.fila) {
        setFila(e.detail.fila);
      } else {
        atualizarFila();
      }
    };

    window.addEventListener(QUEUE_EVENT_NAME, handleQueueChange);
    return () => {
      window.removeEventListener(QUEUE_EVENT_NAME, handleQueueChange);
    };
  }, [atualizarFila]);

  // Função para sincronizar itens da fila
  const sincronizar = useCallback(async () => {
    if (!isOnline || isSincronizando) return;

    const filaAtual = obterFila();
    if (filaAtual.length === 0) return;

    setIsSincronizando(true);
    try {
      const relatorio = await sincronizarFila();
      setUltimoRelatorio(relatorio);
      atualizarFila();
      return relatorio;
    } finally {
      setIsSincronizando(false);
    }
  }, [isOnline, isSincronizando, atualizarFila]);

  const prevOnlineRef = useRef(isOnline);

  // Sincronização automática quando a conexão for restabelecida (offline -> online)
  useEffect(() => {
    if (!prevOnlineRef.current && isOnline) {
      sincronizar();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, sincronizar]);

  // Sincronização em resposta ao evento nativo de rede
  useEffect(() => {
    const handleOnlineEvent = () => {
      sincronizar();
    };

    window.addEventListener('online', handleOnlineEvent);
    return () => {
      window.removeEventListener('online', handleOnlineEvent);
    };
  }, [sincronizar]);

  return {
    fila,
    totalPendentes: fila.length,
    isSincronizando,
    ultimoRelatorio,
    sincronizar,
    atualizarFila,
  };
}
