import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../store/ui.store';
import { useAuthStore } from '../../store/auth.store';
import { useWatchOptionalVideo, useSkipCooldown } from '../../api/tasks.api';
import { AdNetwork } from '../../types/enums/whot.enums';
import { soundEffects } from '../../helpers/audio.helpers';

declare global {
  interface Window {
    Adsgram?: {
      init: (params: { blockId: string; debug?: boolean }) => {
        show: () => Promise<void>;
      };
    };
  }
}

export const RewardedAdModal: React.FC = () => {
  const { rewardedAdModal, closeRewardedAd, showToast } = useUIStore();
  const { updateUserStats } = useAuthStore();
  const watchOptionalVideoMutation = useWatchOptionalVideo();
  const skipCooldownMutation = useSkipCooldown();

  const [isPlaying, setIsPlaying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (rewardedAdModal.isOpen) {
      setIsPlaying(false);
      setSecondsLeft(5);
      setIsCompleted(false);
    }
  }, [rewardedAdModal.isOpen]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && secondsLeft > 0) {
      timer = setTimeout(() => {
        setSecondsLeft((s) => s - 1);
      }, 1000);
    } else if (isPlaying && secondsLeft === 0) {
      setIsCompleted(true);
      soundEffects.playVictoryChime();
    }
    return () => clearTimeout(timer);
  }, [isPlaying, secondsLeft]);

  if (!rewardedAdModal.isOpen) return null;

  const startAd = () => {
    soundEffects.playButtonClick();
    
    if (!window.Adsgram) {
      showToast("Ad blocker detected or Adsgram failed to load.", "error");
      return;
    }
    
    setIsPlaying(true);
    // Initialize the Adsgram Controller with a test block ID
    const AdController = window.Adsgram.init({ blockId: "int-496" });
    
    AdController.show()
      .then(() => {
        setIsCompleted(true);
        soundEffects.playVictoryChime();
      })
      .catch((result) => {
        console.log("Ad skipped or failed:", result);
        setIsPlaying(false);
        showToast("You must watch the full ad to claim the reward.", "error");
      });
  };

  const handleClaimReward = () => {
    soundEffects.playVictoryChime();

    if (rewardedAdModal.rewardType === 'BOOST_POINTS') {
      updateUserStats(0, 50, false);
      showToast('⚡ +50 Points added to your account!', 'success');
    } else if (rewardedAdModal.rewardType === 'PRACTICE_MATCH') {
      watchOptionalVideoMutation.mutate(undefined, {
        onSuccess: (res) => {
          if (res.success) {
            showToast(`🎮 Practice Match unlocked! (${res.practiceMatches} available)`, 'success');
          } else {
            showToast('Daily optional video limit (5/5) reached for today', 'info');
          }
        }
      });
    } else if (rewardedAdModal.rewardType === 'COOLDOWN_SKIP') {
      skipCooldownMutation.mutate(undefined, {
        onSuccess: () => {
          showToast('⚡ 1-Hour match cooldown skipped instantly!', 'success');
        }
      });
    }

    if (rewardedAdModal.onRewardGranted) {
      rewardedAdModal.onRewardGranted();
    }

    closeRewardedAd();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-[340px] bg-[#1A1B1E] border border-[#2b3044] rounded-[22px] p-5 shadow-2xl relative text-[#F5F5F0]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2b3044]">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📺</span>
            <h3 className="font-bebas text-xl tracking-wider text-white">
              {rewardedAdModal.title}
            </h3>
          </div>
          {!isPlaying && (
            <button
              onClick={closeRewardedAd}
              className="text-[#9A9A9A] hover:text-white p-1 rounded"
            >
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className="py-4 space-y-4 text-center">
          {!isPlaying && !isCompleted ? (
            <>
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#203666] border border-[#3b5998] flex items-center justify-center shadow-inner">
                <span className="font-bebas text-3xl text-[#FF5A36]">⚡</span>
              </div>
              <div>
                <h4 className="font-bold text-base text-white">{rewardedAdModal.subtitle}</h4>
                <p className="text-xs text-[#9A9A9A] mt-1">
                  Non-gambling rewarded program compliant with Nigerian consumer rules.
                </p>
              </div>



              <button
                onClick={startAd}
                className="w-full h-12 bg-[#FF5A36] hover:bg-[#ff6947] active:scale-[0.98] transition font-extrabold text-sm tracking-wider text-[#111214] rounded-full glow-orange shadow-lg flex items-center justify-center space-x-2"
              >
                <span>▶ WATCH VIDEO</span>
              </button>
            </>
          ) : isPlaying && !isCompleted ? (
            <div className="py-6 space-y-3">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <span className="font-bebas text-3xl text-white">...</span>
              </div>
              <p className="text-sm font-bold text-white">
                Ad is playing via Adsgram...
              </p>
              <p className="text-xs text-[#9A9A9A]">
                Please complete the ad. The reward will unlock automatically.
              </p>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#00B85F]/20 border border-[#00B85F] flex items-center justify-center text-3xl">
                ✓
              </div>
              <div>
                <h4 className="font-bold text-lg text-white">Reward Ready!</h4>
                <p className="text-xs text-[#00E676] font-semibold mt-0.5">
                  {rewardedAdModal.rewardAmount}
                </p>
              </div>
              <button
                onClick={handleClaimReward}
                className="w-full h-12 bg-[#00B85F] hover:bg-[#009951] active:scale-[0.98] transition font-black text-sm tracking-wider text-[#111214] rounded-full shadow-lg"
              >
                CLAIM REWARD
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
