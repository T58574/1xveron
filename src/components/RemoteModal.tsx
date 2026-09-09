import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Copy, Check, Wifi } from 'lucide-react';
import { SystemInfo } from '../types';

interface RemoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemInfo: SystemInfo | null;
}

export const RemoteModal: React.FC<RemoteModalProps> = ({ isOpen, onClose, systemInfo }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const lanUrl = systemInfo?.lan_url || `http://localhost:${systemInfo?.port || 4567}`;

  useEffect(() => {
    if (isOpen && lanUrl) {
      QRCode.toDataURL(lanUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url: string) => setQrDataUrl(url))
        .catch((err: unknown) => console.error('QR generation error:', err));
    }
  }, [isOpen, lanUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(lanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#16171d] border border-zinc-800 rounded-2xl p-6 shadow-2xl text-zinc-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700/50 text-emerald-400">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Local Wi-Fi Remote Control</h3>
            <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Couch / Mobile Mode</span>
            </p>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-4 bg-[#1e2029] border border-zinc-800/80 rounded-xl mb-5">
          {qrDataUrl ? (
            <div className="p-2 bg-white rounded-xl shadow-inner">
              <img src={qrDataUrl} alt="Mobile Remote QR Code" className="w-48 h-48 rounded-lg" />
            </div>
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-zinc-500 text-xs">
              Generating QR Code...
            </div>
          )}
          <p className="text-xs text-zinc-400 mt-3 text-center">
            Scan with your phone camera on the same Wi-Fi
          </p>
        </div>

        {/* LAN URL Box */}
        <div className="flex items-center gap-2 p-2 bg-[#121316] border border-zinc-800 rounded-lg text-xs font-mono mb-4">
          <span className="truncate flex-1 px-2 text-sky-400">{lanUrl}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md transition-colors shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Hint */}
        <div className="text-[11px] text-zinc-400 leading-relaxed space-y-1 bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/50">
          <p className="font-semibold text-zinc-300">💡 Как это работает:</p>
          <p>
            Открывай с телефона прямо с кровати или дивана. На мобилке сетка окон автоматически выключается,
            остается один удобный полноэкранный терминал со специальными кнопками{' '}
            <code className="text-sky-300 font-mono">[Ctrl+C] [Esc] [Tab] [↑] [↓]</code>.
          </p>
        </div>
      </div>
    </div>
  );
};
