import React from 'react';

export const StatusBar: React.FC = () => {
  return (
    <section
      className="w-full pt-2 pb-1.5 flex justify-between items-center text-xs text-white tracking-tight px-3 select-none"
      data-purpose="ios-status-bar"
    >
      <span className="font-semibold text-[14px]">9:41</span>
      <div className="flex items-center space-x-1.5 opacity-90">
        {/* Signal Icon */}
        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
          <path d="M2 17h3v4H2v-4zm6-5h3v9H8v-9zm6-5h3v14h-3V7zm6-5h3v19h-3V2z" />
        </svg>
        {/* Wifi Icon */}
        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
          <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4zm0 3.5c3.5 0 6.69 1.4 9.02 3.68L12 19.34 2.98 11.18C5.31 8.9 8.5 7.5 12 7.5z" />
        </svg>
        {/* Battery Icon */}
        <div className="w-5 h-2.5 border border-white rounded-[3px] p-0.5 flex items-center">
          <div className="h-full w-full bg-white rounded-sm" />
        </div>
      </div>
    </section>
  );
};
