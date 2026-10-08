import React from 'react';
import { WhotCard } from '../../types/interfaces/card.types';
import { WhotSuit } from '../../types/enums/whot.enums';

interface WhotCardViewProps {
  card?: WhotCard;
  isFaceDown?: boolean;
  isSelected?: boolean;
  isPlayable?: boolean;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const WhotCardView: React.FC<WhotCardViewProps> = ({
  card,
  isFaceDown = false,
  isSelected = false,
  isPlayable = true,
  onClick,
  className = '',
  size = 'md',
}) => {
  // Dimension presets
  const sizeClasses = {
    sm: 'w-10 h-14 rounded-lg p-1 text-xs',
    md: 'w-20 h-32 rounded-xl p-2 text-base',
    lg: 'w-24 h-36 rounded-xl p-2 text-lg',
  };

  // Face-down card back
  if (isFaceDown || !card) {
    return (
      <div
        onClick={onClick}
        className={`${sizeClasses[size]} bg-[#16181b] border border-white/20 card-shadow flex flex-col items-center justify-center cursor-pointer select-none transition-transform hover:-translate-y-1 ${className}`}
      >
        <div className="w-full h-full rounded border border-dashed border-white/10 flex flex-col items-center justify-center bg-[#131416]">
          <svg className="w-5 h-5 text-white/30" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span className="text-[7px] font-black text-white/40 tracking-widest mt-0.5">WHOT</span>
        </div>
      </div>
    );
  }

  // Render suit SVG
  const renderSuitIcon = (suit: WhotSuit, iconSize: 'small' | 'large') => {
    const isLg = iconSize === 'large';
    const dim = isLg ? (size === 'sm' ? 'w-4 h-4' : 'w-12 h-12') : 'w-3 h-3';

    switch (suit) {
      case WhotSuit.CIRCLE:
        return (
          <div
            className={`${dim} rounded-full`}
            style={{ backgroundColor: card.colorHex }}
          />
        );

      case WhotSuit.TRIANGLE:
        return (
          <svg className={`${dim}`} viewBox="0 0 24 24" fill={card.colorHex}>
            <polygon points="12 2 23 21 1 21" />
          </svg>
        );

      case WhotSuit.CROSS:
        return (
          <svg className={`${dim}`} viewBox="0 0 24 24" fill={card.colorHex}>
            <path d="M8 2h8v6h6v8h-6v6H8v-6H2V8h6V2z" />
          </svg>
        );

      case WhotSuit.SQUARE:
        return (
          <div
            className={`${dim} rounded-xs`}
            style={{ backgroundColor: card.colorHex }}
          />
        );

      case WhotSuit.STAR:
        return (
          <svg className={`${dim}`} viewBox="0 0 24 24" fill={card.colorHex}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        );

      case WhotSuit.WHOT:
        return isLg ? (
          <div className="relative flex items-center justify-center w-full h-full">
            <svg className="w-16 h-16 scale-110" viewBox="0 0 100 100">
              <polygon points="50,5 54,40 50,50 46,40" fill="#FF2D55" />
              <polygon points="50,95 54,60 50,50 46,60" fill="#00E5FF" />
              <polygon points="5,50 40,46 50,50 40,54" fill="#00E676" />
              <polygon points="95,50 60,46 50,50 60,54" fill="#FFD600" />
              <polygon points="18,18 43,40 50,50 40,43" fill="#FF9100" />
              <polygon points="82,82 57,60 50,50 60,57" fill="#7C4DFF" />
              <polygon points="82,18 60,43 50,50 57,40" fill="#00E676" />
              <polygon points="18,82 40,57 50,50 43,60" fill="#E040FB" />
            </svg>
            <span className="absolute text-[12px] font-black tracking-wider text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              WHOT
            </span>
          </div>
        ) : (
          <span className="text-[9px] font-black text-[#7A2BE2]">W</span>
        );
    }
  };

  const isWhot20 = card.number === 20;

  return (
    <div
      onClick={isPlayable ? onClick : undefined}
      className={`relative select-none flex flex-col justify-between transition-all duration-150 cursor-pointer ${
        sizeClasses[size]
      } ${
        isWhot20 ? 'bg-[#111315] text-white border border-white/20' : 'bg-white text-black'
      } ${
        isSelected
          ? 'active-card-shadow -translate-y-4 z-30 scale-105 border-2 border-[#00FF66]'
          : 'card-shadow hover:-translate-y-2'
      } ${!isPlayable ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {/* Top Left Corner */}
      <div className="flex flex-col items-start leading-none">
        <span
          className={`font-black leading-none ${size === 'sm' ? 'text-xs' : 'text-lg'}`}
          style={{ color: isWhot20 ? '#FFFFFF' : card.suit === WhotSuit.SQUARE ? '#0047BA' : '#111214' }}
        >
          {card.number}
        </span>
        <div className="mt-0.5">{renderSuitIcon(card.suit, 'small')}</div>
      </div>

      {/* Center Suit Symbol */}
      <div className="flex items-center justify-center my-auto overflow-hidden">
        {renderSuitIcon(card.suit, 'large')}
      </div>

      {/* Bottom Right Corner */}
      <div className="flex flex-col items-end leading-none">
        <div className="mb-0.5">{renderSuitIcon(card.suit, 'small')}</div>
        <span
          className={`font-black leading-none rotate-180 ${size === 'sm' ? 'text-xs' : 'text-lg'}`}
          style={{ color: isWhot20 ? '#FFFFFF' : card.suit === WhotSuit.SQUARE ? '#0047BA' : '#111214' }}
        >
          {card.number}
        </span>
      </div>
    </div>
  );
};
