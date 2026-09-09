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
          dark: '#090a0d',
          light: '#f59e0b',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#111217] border border-white/[0.08] rounded-2xl p-6 shadow-2xl text-zinc-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-amber-400/[0.1] border border-amber-400/30 text-amber-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Local Wi-Fi Remote Control</h3>
            <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
              <Wifi className="w-3 h-3 text-amber-400" />
              <span>Couch / Mobile Mode</span>
            </p>
          </div>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center justify-center p-4 bg-[#090a0d] border border-white/[0.06] rounded-xl mb-4">
          {qrDataUrl ? (
            <div className="p-2 bg-amber-400 rounded-xl shadow-inner">
              <img src={qrDataUrl} alt="Mobile Remote QR Code" className="w-44 h-44 rounded-lg" />
            </div>
          ) : (
            <div className="w-44 h-44 flex items-center justify-center text-zinc-500 text-xs">
              Generating QR Code...
            </div>
          )}
          <p className="text-[11px] text-zinc-400 mt-2.5 text-center">
            Scan with phone camera on the same Wi-Fi
          </p>
        </div>

        {/* URL Box */}
        <div className="flex items-center gap-2 p-1.5 bg-[#0c0d12] border border-white/[0.06] rounded-lg text-xs font-mono mb-3">
          <span className="truncate flex-1 px-2 text-amber-300 text-[11px]">{lanUrl}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-black font-semibold rounded-md transition-colors shrink-0 text-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Quick Hint */}
        <div className="text-[11px] text-zinc-400 leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-white/[0.04]">
          <p className="font-medium text-zinc-300 mb-1">Токен авторизации вшит в ссылку</p>
          <p>
            На телефоне откроется полноэкранный терминал со специальными быстрыми клавишами для комфортного управления с кровати.
          </p>
        </div>
      </div>
    </div>
  );
};
