import { useState, useEffect, useCallback } from 'react';

export function useNetworkStatus() {
  const [isSystemOnline, setIsSystemOnline] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsSystemOnline(true);
    const handleOffline = () => setIsSystemOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleSimulatedOffline = useCallback(() => {
    setIsSimulatedOffline((prev) => {
      const next = !prev;
      // Dispara eventos artificiais para simular comportamento real de rede
      if (next) {
        window.dispatchEvent(new Event('offline'));
      } else {
        window.dispatchEvent(new Event('online'));
      }
      return next;
    });
  }, []);

  const isOnline = isSystemOnline && !isSimulatedOffline;

  return {
    isOnline,
    isSystemOnline,
    isSimulatedOffline,
    toggleSimulatedOffline,
    setSimulatedOffline: setIsSimulatedOffline,
  };
}
