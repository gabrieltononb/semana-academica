import { useState, useEffect, useCallback, useRef } from 'react';
import { obterCodigoDoEncontro } from '../services/presencaService.js';

export function useQrCodeRotation(encontroId, usuarioId = 'org-ana') {
  const [codigoData, setCodigoData] = useState(null);
  const [segundosRestantes, setSegundosRestantes] = useState(60);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const timeoutRef = useRef(null);
  const estaBuscandoRef = useRef(false);

  const buscarCodigo = useCallback(async () => {
    if (!encontroId || estaBuscandoRef.current) return;
    estaBuscandoRef.current = true;
    setCarregando(true);
    setErro(null);

    try {
      const data = await obterCodigoDoEncontro(encontroId, usuarioId);
      setCodigoData(data);

      if (data?.trocaEm) {
        const trocaMs = new Date(data.trocaEm).getTime();
        const agoraMs = Date.now();
        const diffSegundos = Math.max(0, Math.floor((trocaMs - agoraMs) / 1000));
        setSegundosRestantes(diffSegundos > 0 ? diffSegundos : 60);
      } else {
        setSegundosRestantes(60);
      }
    } catch (err) {
      setErro({
        erro: err.erro || 'ERRO_DESCONHECIDO',
        mensagem: err.mensagem || 'Falha ao carregar código QR do encontro',
        status: err.status,
      });
    } finally {
      setCarregando(false);
      estaBuscandoRef.current = false;
    }
  }, [encontroId, usuarioId]);

  // Carga inicial
  useEffect(() => {
    buscarCodigo();
  }, [buscarCodigo]);

  // Contador regressivo e rotação automática
  useEffect(() => {
    if (!codigoData) return;

    const intervalId = setInterval(() => {
      setSegundosRestantes((prev) => {
        if (prev <= 1) {
          // Dispara busca do próximo código
          buscarCodigo();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [codigoData, buscarCodigo]);

  return {
    codigoData,
    codigo: codigoData?.codigo || '',
    trocaEm: codigoData?.trocaEm || null,
    validoAte: codigoData?.validoAte || null,
    segundosRestantes,
    carregando,
    erro,
    recarregar: buscarCodigo,
  };
}
