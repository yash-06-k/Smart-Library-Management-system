import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

export default function ScannerModal({
  open,
  title = 'Scan',
  formats = 'qr',
  onResult,
  onClose,
}) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState('');
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [manualValue, setManualValue] = useState('');

  const normalizeScanValue = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return trimmed;
    }

    if (formats === 'isbn') {
      return trimmed.replace(/[^0-9Xx]/g, '').toUpperCase();
    }

    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split('/').filter(Boolean);
      const booksIndex = segments.findIndex((segment) => segment === 'books');
      if (booksIndex !== -1 && segments[booksIndex + 1]) {
        return segments[booksIndex + 1];
      }

      const queryId = url.searchParams.get('bookId') || url.searchParams.get('book_id') || url.searchParams.get('id');
      if (queryId) {
        return queryId;
      }

      if (segments.length) {
        return segments[segments.length - 1];
      }
    } catch {
      // Not a URL; continue with raw value.
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed?.book_id) {
          return String(parsed.book_id);
        }
        if (parsed?.bookId) {
          return String(parsed.bookId);
        }
        if (parsed?.id) {
          return String(parsed.id);
        }
      } catch {
        // Ignore invalid JSON.
      }
    }

    return trimmed;
  };

  const isAcceptable = (value) => {
    if (formats === 'isbn') {
      return value.length === 8 || value.length === 10 || value.length === 13;
    }
    return true;
  };

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let active = true;
    setError('');
    setManualValue('');

    const hints = new Map();
    if (formats === 'qr') {
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    } else if (formats === 'isbn') {
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.ITF,
        BarcodeFormat.CODE_39,
      ]);
    }

    const reader = new BrowserMultiFormatReader(hints, 200);
    const stopReader = () => {
      if (controlsRef.current?.stop) {
        try {
          controlsRef.current.stop();
        } catch {
          // Ignore control stop errors
        }
        controlsRef.current = null;
      }

      try {
        if (typeof reader.stopContinuousDecode === 'function') {
          reader.stopContinuousDecode();
        }
        if (typeof reader.stopStreams === 'function') {
          reader.stopStreams();
        }
      } catch {
        // Ignore cleanup errors
      }

      if (videoRef.current?.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks?.() || [];
        tracks.forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    };

    const startScanner = async () => {
      try {
        const cameraDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!active) {
          return;
        }

        setDevices(cameraDevices);

        let preferred = deviceId;
        if (!preferred && cameraDevices.length > 0) {
          const backCam = cameraDevices.find((device) =>
            device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')
          );
          preferred = (backCam || cameraDevices[0]).deviceId;
          if (preferred) {
            setDeviceId(preferred);
            return;
          }
        }

        const controls = await reader.decodeFromVideoDevice(preferred || undefined, videoRef.current, (result, decodeError) => {
          if (!active) {
            return;
          }
          if (result) {
            const normalized = normalizeScanValue(result.getText());
            if (!isAcceptable(normalized)) {
              return;
            }

            active = false;
            onResult(normalized);
            stopReader();
            onClose();
          } else if (decodeError) {
            // Ignore decode errors while scanning; user-facing errors are handled via permission failures.
          }
        });
        controlsRef.current = controls;
      } catch (err) {
        if (!active) {
          return;
        }
        const fallbackMessage = err?.message || 'Unable to access camera';
        if (err?.name === 'NotAllowedError') {
          setError('Camera permission denied. Allow camera access or use manual entry below.');
          return;
        }
        if (err?.name === 'NotFoundError') {
          setError('No camera device found. Use manual entry below.');
          return;
        }
        if (typeof window !== 'undefined') {
          const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
          if (!isSecure) {
            setError('Camera access requires HTTPS or localhost. Use manual entry below.');
            return;
          }
        }
        setError(fallbackMessage);
      }
    };

    startScanner();

    return () => {
      active = false;
      stopReader();
    };
  }, [open, deviceId, onClose, onResult, formats]);

  const handleDeviceChange = (event) => {
    setDeviceId(event.target.value);
  };

  const handleManualSubmit = () => {
    const normalized = normalizeScanValue(manualValue);
    if (!normalized) {
      setError('Enter a valid code.');
      return;
    }
    if (!isAcceptable(normalized)) {
      setError(formats === 'isbn' ? 'Invalid ISBN. Use 8, 10, or 13 digits.' : 'Invalid code.');
      return;
    }
    setError('');
    onResult(normalized);
    onClose();
  };

  useEffect(() => {
    if (!open) {
      setDevices([]);
      setDeviceId('');
      setManualValue('');
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950/90 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-white font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-300"
            aria-label="Close scanner"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error ? <p className="text-rose-300 text-sm">{error}</p> : null}
          {devices.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-400">Camera</label>
              <select
                value={deviceId}
                onChange={handleDeviceChange}
                className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-slate-200"
              >
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(-4)}`}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="rounded-xl overflow-hidden border border-white/10 bg-black">
            <video ref={videoRef} className="w-full h-[320px] object-cover" muted playsInline autoPlay />
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              placeholder={formats === 'isbn' ? 'Type or paste ISBN' : 'Paste QR value or book ID'}
              className="flex-1 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-slate-200"
            />
            <button
              onClick={handleManualSubmit}
              className="rounded-lg border border-white/10 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-500/30"
            >
              Use Code
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Position the code inside the frame. The scanner will automatically capture it.
          </p>
        </div>
      </div>
    </div>
  );
}
