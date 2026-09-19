import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export function QrCodeDisplay({
  codigo,
  segundosRestantes,
  trocaEm,
  carregando,
  encontroId,
}) {
  const [svgString, setSvgString] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!codigo) {
      setSvgString('');
      return;
    }

    // Gera SVG do QR code contendo o código de 6 caracteres
    QRCode.toString(codigo, {
      type: 'svg',
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    })
      .then((svg) => {
        setSvgString(svg);
      })
      .catch((err) => {
        console.error('Erro ao gerar SVG do QR Code:', err);
      });
  }, [codigo]);

  const toggleFullScreen = () => {
    setIsFullScreen((prev) => !prev);
  };

  return (
    <div
      ref={containerRef}
      className={`qrcode-container ${isFullScreen ? 'fullscreen-mode' : ''}`}
      data-testid="qrcode-container"
    >
      <div className="qrcode-card">
        <div className="qrcode-header">
          <h3>Código QR da Sala</h3>
          {encontroId && <span className="encontro-badge">Encontro: {encontroId}</span>}
          <button
            type="button"
            className="btn-fullscreen"
            onClick={toggleFullScreen}
            data-testid="btn-fullscreen"
          >
            {isFullScreen ? '✕ Sair da Tela Cheia' : '⛶ Modo Tela Cheia'}
          </button>
        </div>

        {carregando && !codigo ? (
          <div className="qrcode-loading" data-testid="qrcode-loading">
            <div className="spinner"></div>
            <p>Gerando código do encontro...</p>
          </div>
        ) : (
          <>
            <div
              className="qrcode-graphic"
              data-testid="qrcode-svg"
              dangerouslySetInnerHTML={{ __html: svgString }}
            />

            <div className="qrcode-info">
              <span className="code-label">Código para digitação manual:</span>
              <div className="code-value" data-testid="code-value">
                {codigo || '------'}
              </div>
            </div>

            <div className="qrcode-countdown" data-testid="qrcode-countdown">
              <div className="countdown-text">
                Próxima rotação em:{' '}
                <strong data-testid="countdown-seconds">{segundosRestantes}s</strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(100, Math.max(0, (segundosRestantes / 60) * 100))}%` }}
                />
              </div>
              {trocaEm && (
                <span className="troca-label">
                  Troca agendada para: {new Date(trocaEm).toLocaleTimeString()}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
