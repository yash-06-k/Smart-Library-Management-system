import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QrCodePreview({
  value,
  size = 220,
  className = '',
  alt = 'QR code',
  emptyLabel = 'QR not available',
}) {
  const [dataUrl, setDataUrl] = useState('');
  const [svgMarkup, setSvgMarkup] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');

  useEffect(() => {
    let active = true;
    setDataUrl('');
    setSvgMarkup('');
    setFallbackUrl('');

    if (!value) {
      return () => {
        active = false;
      };
    }

    const build = async () => {
      const payload = String(value);
      try {
        const url = await QRCode.toDataURL(payload, { margin: 1, width: size });
        if (active) {
          setDataUrl(url);
        }
      } catch {
        try {
          const svgText = await QRCode.toString(payload, { type: 'svg', margin: 1, width: size });
          if (active) {
            setSvgMarkup(svgText);
          }
        } catch {
          if (active) {
            const remoteUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}`;
            setFallbackUrl(remoteUrl);
          }
        }
      }
    };

    build();

    return () => {
      active = false;
    };
  }, [value, size]);

  if (dataUrl) {
    return <img src={dataUrl} alt={alt} className={className} />;
  }

  if (svgMarkup) {
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
      />
    );
  }

  if (fallbackUrl) {
    return <img src={fallbackUrl} alt={alt} className={className} />;
  }

  if (typeof emptyLabel !== 'string') {
    return emptyLabel;
  }

  return (
    <div className={className}>
      {emptyLabel}
    </div>
  );
}
