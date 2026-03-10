import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';

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

  const isAcceptable = (value) => {
    if (formats === 'isbn') {
      const cleaned = value.replace(/[^0-9Xx]/g, '');
      return cleaned.length === 8 || cleaned.length === 10 || cleaned.length === 13;
    }
    return true;
  };

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let active = true;
    setError('');

    const reader = new BrowserMultiFormatReader();
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
          setDeviceId(preferred);
        }

        const controls = await reader.decodeFromVideoDevice(preferred || undefined, videoRef.current, (result, decodeError) => {
          if (!active) {
            return;
          }
          if (result) {
            const text = result.getText();
            if (!isAcceptable(text)) {
              return;
            }

            active = false;
            onResult(text);
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
        setError(err?.message || 'Unable to access camera');
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

  useEffect(() => {
    if (!open) {
      setDevices([]);
      setDeviceId('');
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
            <video ref={videoRef} className="w-full h-[320px] object-cover" muted />
          </div>
          <p className="text-xs text-slate-400">
            Position the code inside the frame. The scanner will automatically capture it.
          </p>
        </div>
      </div>
    </div>
  );
}
