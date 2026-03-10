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

  useEffect(() => {
    let active = true;
    setDataUrl('');
    setSvgMarkup('');

    if (!value) {
      return () => {
        active = false;
      };
    }

    const build = async () => {
      try {
        const url = await QRCode.toDataURL(value, { margin: 1, width: size });
        if (active) {
          setDataUrl(url);
        }
      } catch {
        try {
          const svgText = await QRCode.toString(value, { type: 'svg', margin: 1, width: size });
          if (active) {
            setSvgMarkup(svgText);
          }
        } catch {
          if (active) {
            setDataUrl('');
            setSvgMarkup('');
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

  if (typeof emptyLabel !== 'string') {
    return emptyLabel;
  }

  return (
    <div className={className}>
      {emptyLabel}
    </div>
  );
}
