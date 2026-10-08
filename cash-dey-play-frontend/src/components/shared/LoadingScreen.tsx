import React, { useEffect, useState } from 'react';
import cashDeyPlayLogo from '../../assets/CASH DEY PLAY_margin.png';
import goldenCrown from '../../assets/GoldenCrown.png';

interface LoadingScreenProps {
  onComplete: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate loading progress
    const duration = 2500; // 2.5 seconds total loading time
    const intervalTime = 30;
    const steps = duration / intervalTime;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const newProgress = Math.min(Math.round((currentStep / steps) * 100), 100);
      setProgress(newProgress);

      if (currentStep >= steps) {
        clearInterval(interval);
        setTimeout(onComplete, 200); // slight pause at 100%
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="absolute inset-0 z-[9999] bg-[#111214] flex flex-col items-center justify-between py-16 px-6 overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 whot-pattern opacity-50 pointer-events-none"></div>

      {/* Decorative abstract shapes mimicking the screenshot */}
      <div className="absolute top-10 left-[-20px] opacity-20 rotate-45 pointer-events-none">
        <div className="w-32 h-1 bg-green-500 mb-2"></div>
        <div className="w-24 h-1 bg-green-500 mb-4"></div>
        <div className="w-16 h-16 rounded-full border-2 border-green-500"></div>
      </div>

      <div className="absolute top-1/3 right-[-30px] opacity-20 pointer-events-none">
        <svg width="100" height="100" viewBox="0 0 100 100" className="stroke-[#FF5A36] stroke-2 fill-none">
          <polyline points="0,50 30,20 60,60 100,0" />
          <polyline points="0,70 40,40 70,80 100,20" />
        </svg>
      </div>

      <div className="absolute bottom-20 left-[-20px] opacity-20 pointer-events-none">
        <svg width="100" height="100" viewBox="0 0 100 100" className="stroke-[#FF5A36] stroke-2 fill-none">
          <polyline points="0,50 40,20 70,60 100,30" />
        </svg>
        <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-b-[25px] border-b-[#303338] mt-2 ml-10"></div>
      </div>

      <div className="absolute bottom-10 right-[-10px] opacity-20 pointer-events-none">
        <div className="w-32 h-1 bg-green-500 mb-2 rotate-[-45deg]"></div>
        <div className="w-24 h-1 bg-green-500 rotate-[-45deg] ml-8"></div>
      </div>

      {/* Main Content Container */}
      <div className="flex flex-col items-center mt-8 w-full z-10 relative">
        {/* Crown Asset */}
        <div className="absolute top-[-30px] right-[20px] sm:right-[50px] w-12 h-12 z-20 animate-pulse">
          <img src={goldenCrown} alt="Crown" className="w-full h-full object-contain rotate-12" />
        </div>

        {/* Cash Dey Play Logo */}
        <div className="w-full max-w-[280px] relative z-10">
          <img src={cashDeyPlayLogo} alt="Cash Dey Play" className="w-full h-auto drop-shadow-2xl" />
        </div>

        {/* Subtitles */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-[13px] font-bold tracking-[0.15em]">
            <span className="text-[#00B85F]">WHOT</span>
            <span className="text-[#40434A]">•</span>
            <span className="text-[#FF5A36]">PLAY</span>
            <span className="text-[#40434A]">•</span>
            <span className="text-[#FFC107]">WIN</span>
          </div>
          <div className="text-[#E0E0E0] text-[11px] font-semibold tracking-[0.2em] mt-1">
            AIRTIME & DATA REWARDS
          </div>
        </div>
      </div>

      {/* Loading Indicator at Bottom */}
      <div className="w-full flex flex-col items-center mb-8 z-10">
        {/* Loading Icon Box */}
        <div className="w-14 h-14 rounded-xl border border-[#00B85F] flex items-center justify-center bg-[#111214]/80 shadow-[0_0_15px_rgba(0,184,95,0.15)] mb-4 animate-pulse">
          <svg className="w-6 h-6 fill-[#00B85F]" viewBox="0 0 24 24">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        </div>

        {/* Loading Text */}
        <div className="text-[#E0E0E0] text-[13px] font-medium mb-6 tracking-wide">
          Loading table...
        </div>

        {/* Progress Bar Container */}
        <div className="w-full max-w-[280px] flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-[#303338] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#00B85F] rounded-full shadow-[0_0_8px_rgba(0,184,95,0.6)] transition-all duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="text-[#F5F5F0] text-sm font-bold min-w-[32px] text-right">
            {progress}%
          </div>
        </div>
      </div>
    </div>
  );
};
