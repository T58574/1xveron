import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Copy, Check, Wifi, Edit3 } from 'lucide-react';
import { SystemInfo } from '../types';
import { copyToGlobalClipboard } from '../services/api';

interface RemoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemInfo: SystemInfo | null;
}

export const RemoteModal: React.FC<RemoteModalProps> = ({ isOpen, onClose, systemInfo }) => {
  const [selectedIp, setSelectedIp] = useState<string>(() => {
    return localStorage.getItem('veron_remote_ip') || '';
  });
  const [isCustomIp, setIsCustomIp] = useState(false);
  const [customIpInput, setCustomIpInput] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (systemInfo?.local_ip) {
      const savedIp = localStorage.getItem('veron_remote_ip');
      if (!savedIp) {
        setSelectedIp(systemInfo.local_ip);
      }
    }
  }, [systemInfo?.local_ip]);

  const handleSelectIp = (ip: string) => {
    setSelectedIp(ip);
    localStorage.setItem('veron_remote_ip', ip);
  };

  const handleApplyCustomIp = (e: React.FormEvent) => {
    e.preventDefault();
    if (customIpInput.trim()) {
      handleSelectIp(customIpInput.trim());
      setIsCustomIp(false);
    }
  };

  const effectiveIp = selectedIp || systemInfo?.local_ip || 'localhost';
  const effectivePort = systemInfo?.port || 4567;
  const tokenQuery = systemInfo?.auth_token ? `?token=${encodeURIComponent(systemInfo.auth_token)}` : '';
  const lanUrl = `http://${effectiveIp}:${effectivePort}${tokenQuery}`;

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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = () => {
    copyToGlobalClipboard(lanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none"
    >
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

        {/* Network Interface / IP Selector */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1 px-0.5">
            <span>Сетевой адрес (IP):</span>
            <button
              type="button"
              onClick={() => {
                setIsCustomIp(!isCustomIp);
                setCustomIpInput(effectiveIp);
              }}
              className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
            >
              <Edit3 className="w-3 h-3" />
              <span>{isCustomIp ? 'Выбрать из списка' : 'Указать вручную'}</span>
            </button>
          </div>

          {isCustomIp ? (
            <form onSubmit={handleApplyCustomIp} className="flex gap-1.5">
              <input
                type="text"
                value={customIpInput}
                onChange={(e) => setCustomIpInput(e.target.value)}
                placeholder="192.168.x.x"
                className="flex-1 bg-[#0c0d12] border border-amber-400/40 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono outline-none focus:border-amber-400"
                autoFocus
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-amber-400 text-black font-semibold rounded-lg text-xs hover:bg-amber-300 transition-colors"
              >
                ОК
              </button>
            </form>
          ) : systemInfo?.interfaces && systemInfo.interfaces.length > 1 ? (
            <select
              value={effectiveIp}
              onChange={(e) => handleSelectIp(e.target.value)}
              className="w-full bg-[#0c0d12] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-amber-300 outline-none focus:border-amber-400/60 font-mono transition-colors cursor-pointer"
            >
              {systemInfo.interfaces.map((iface) => (
                <option key={`${iface.name}-${iface.ip}`} value={iface.ip} className="bg-[#111217] text-zinc-200">
                  {iface.ip} ({iface.name})
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#0c0d12] border border-white/[0.08] text-xs font-mono text-amber-300">
              <span>{effectiveIp}</span>
              <span className="text-[10px] text-zinc-500 font-sans">LAN IPv4</span>
            </div>
          )}
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
