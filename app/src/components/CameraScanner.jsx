import React, { useState, useRef, useEffect } from 'react';

export function CameraScanner({ onScan, ativo = true }) {
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [erroCamera, setErroCamera] = useState(null);
  const [simuladoCodigo, setSimuladoCodigo] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const iniciarCamera = async () => {
    setErroCamera(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Navegador sem suporte a acesso à câmera');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraAtiva(true);
    } catch (err) {
      setErroCamera(err.message || 'Não foi possível acessar a câmera');
      setCameraAtiva(false);
    }
  };

  const pararCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraAtiva(false);
  };

  useEffect(() => {
    return () => {
      pararCamera();
    };
  }, []);

  const handleSimularLeitura = (e) => {
    e.preventDefault();
    if (simuladoCodigo.trim()) {
      onScan(simuladoCodigo.trim().toUpperCase());
      setSimuladoCodigo('');
    }
  };

  return (
    <div className="camera-scanner-card" data-testid="camera-scanner">
      <div className="camera-header">
        <h4>Leitor de QR Code via Câmera</h4>
        <div className="camera-controls">
          {!cameraAtiva ? (
            <button
              type="button"
              className="btn-camera-toggle"
              onClick={iniciarCamera}
              data-testid="btn-iniciar-camera"
            >
              📷 Abrir Câmera
            </button>
          ) : (
            <button
              type="button"
              className="btn-camera-toggle btn-danger"
              onClick={pararCamera}
              data-testid="btn-parar-camera"
            >
              ⏹ Parar Câmera
            </button>
          )}
        </div>
      </div>

      {erroCamera && (
        <div className="camera-notice" data-testid="camera-error">
          <p>{erroCamera}</p>
          <small>Use a simulação abaixo ou digite o código de 6 caracteres.</small>
        </div>
      )}

      <div className="scanner-viewfinder">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`scanner-video ${cameraAtiva ? 'active' : 'hidden'}`}
          data-testid="scanner-video"
        />

        <div className="scanner-overlay">
          <div className="viewfinder-frame">
            <div className="corner top-left"></div>
            <div className="corner top-right"></div>
            <div className="corner bottom-left"></div>
            <div className="corner bottom-right"></div>
            <div className="scan-line"></div>
          </div>
          <p className="scanner-instruction">
            {cameraAtiva
              ? 'Aponte a câmera para o QR Code projetado na sala'
              : 'Câmera desativada'}
          </p>
        </div>
      </div>

      <div className="camera-fallback-actions">
        <form onSubmit={handleSimularLeitura} className="simulated-scan-form">
          <input
            type="text"
            placeholder="Simular leitura (ex: K7M2QX)"
            maxLength={6}
            value={simuladoCodigo}
            onChange={(e) => setSimuladoCodigo(e.target.value.toUpperCase())}
            data-testid="input-simular-camera"
            className="input-simular"
          />
          <button
            type="submit"
            className="btn-simular-scan"
            data-testid="btn-simular-camera"
            disabled={!simuladoCodigo.trim()}
          >
            🔍 Simular Leitura da Câmera
          </button>
        </form>
      </div>
    </div>
  );
}
