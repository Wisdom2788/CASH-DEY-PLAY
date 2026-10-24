import { useEffect, useRef } from 'react';
import { useUIStore } from '../../store/ui.store';

/** No simulated views or client-granted rewards. Provider verification is not integrated yet. */
export const RewardedAdModal = () => {
  const { rewardedAdModal, closeRewardedAd } = useUIStore();
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!rewardedAdModal.isOpen) return;
    const previous = document.activeElement;
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRewardedAd();
      if (event.key === 'Tab') { event.preventDefault(); closeButton.current?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [rewardedAdModal.isOpen, closeRewardedAd]);
  if (!rewardedAdModal.isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <section role="dialog" aria-modal="true" aria-labelledby="rewards-title"
        className="w-full max-w-[340px] bg-[#1A1B1E] border border-[#303338] rounded-2xl p-5 text-[#F5F5F0]">
        <h2 id="rewards-title" className="font-bold text-lg">Video rewards coming soon</h2>
        <p className="text-sm text-gray-300 my-4">Rewards will be available once video verification is connected. No ad has been played or reward claimed.</p>
        <button ref={closeButton} onClick={closeRewardedAd} className="w-full min-h-11 rounded-full bg-[#00B85F] text-black font-bold">Close</button>
      </section>
    </div>
  );
};
