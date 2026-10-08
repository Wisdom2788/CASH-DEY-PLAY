import React, { useState } from 'react';
import { useUIStore } from '../../store/ui.store';
import { useNavigate } from 'react-router-dom';
import routes from '../../config/routes.config';
import { soundEffects } from '../../helpers/audio.helpers';

interface TelegramHeaderProps {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
}

export const TelegramHeader: React.FC<TelegramHeaderProps> = ({
  title = 'Cash Dey Play',
  onBack,
  showBack = true,
}) => {
  const { showToast } = useUIStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [muted, setMuted] = useState(soundEffects.isMuted);

  const handleBack = () => {
    soundEffects.playButtonClick();
    if (onBack) {
      onBack();
    }
  };

  const toggleSound = () => {
    soundEffects.isMuted = !soundEffects.isMuted;
    setMuted(soundEffects.isMuted);
    showToast(soundEffects.isMuted ? 'Game Audio Muted' : 'Game Audio Active', 'info');
    setMenuOpen(false);
  };

  return (
    <header className="relative flex items-center justify-between py-2.5 mb-1 px-2 z-40 select-none">
      {/* Back Button */}
      {showBack ? (
        <button
          aria-label="Go back"
          onClick={handleBack}
          className="p-1 text-[#F5F5F0] active:opacity-60 transition -ml-1 rounded-lg"
          type="button"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <div className="w-6" />
      )}

      {/* App Identity */}
      <h1 className="text-[17px] font-semibold tracking-tight text-[#F5F5F0] leading-tight text-center">
        {title}
      </h1>

      {/* More Options (⋮) */}
      <div className="relative">
        <button
          aria-label="More options"
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 text-[#F5F5F0] active:opacity-60 transition -mr-1 rounded-lg"
          type="button"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-8 w-48 bg-[#1A1B1E] border border-[#303338] rounded-xl shadow-2xl py-1 text-xs text-white z-50 animate-in fade-in zoom-in-95">
            <button
              onClick={toggleSound}
              className="w-full text-left px-3 py-2 hover:bg-[#25282e] flex items-center justify-between"
            >
              <span>{muted ? '🔈 Unmute Audio' : '🔊 Sound Effects'}</span>
              <span className="text-[#9A9A9A]">{muted ? 'OFF' : 'ON'}</span>
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                navigate(routes.tasks);
              }}
              className="w-full text-left px-3 py-2 hover:bg-[#25282e]"
            >
              📋 Daily Tasks & Streak
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                navigate(routes.profile);
              }}
              className="w-full text-left px-3 py-2 hover:bg-[#25282e]"
            >
              🛡️ Non-Gambling Compliance
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
