import { useNavigate } from 'react-router-dom';
import routes from '../../config/routes.config';
import React, { useState } from 'react';
import { useWalletStore } from '../../store/wallet.store';
import { useGetWalletBalance, useGetWalletTransactions, useRedeemAirtime } from '../../api/wallet.api';
import { useUIStore } from '../../store/ui.store';
import { TelecomProvider } from '../../types/enums/whot.enums';
import { soundEffects } from '../../helpers/audio.helpers';
import Skeleton from 'react-loading-skeleton';

export default function WalletView() {
  const {
    preferredProvider: selectedProvider,
    phoneNumber,
    setProvider,
    setPhoneNumber,
  } = useWalletStore();

  const { data: balanceData, isLoading: isLoadingBalance } = useGetWalletBalance();
  const { data: transactionsData, isLoading: isLoadingTransactions } = useGetWalletTransactions();
  const redeemMutation = useRedeemAirtime();

  const balanceNgn = balanceData?.balanceNgn ?? 0;
  const transactions = transactionsData ?? [];

  const { showToast } = useUIStore();
  const navigate = useNavigate();
  const [selectedAmount, setSelectedAmount] = useState<number>(500);

  const handleRedeem = () => {
    soundEffects.playButtonClick();
    if (!phoneNumber || phoneNumber.trim().length < 10) {
      showToast('Please enter a valid Nigerian phone number', 'error');
      return;
    }

    redeemMutation.mutate(
      { amountNgn: selectedAmount, provider: selectedProvider, phoneNumber },
      {
        onSuccess: (res) => {
          if (res.success) {
            soundEffects.playVictoryChime();
            showToast(res.message, 'success');
          } else {
            showToast(res.message, 'error');
          }
        },
        onError: (err) => {
          showToast(err.message || 'Failed to redeem airtime', 'error');
        },
      }
    );
  };

  const providers = [
    { provider: TelecomProvider.MTN, label: 'MTN', color: '#F2B705' },
    { provider: TelecomProvider.AIRTEL, label: 'Airtel', color: '#FF3D12' },
    { provider: TelecomProvider.GLO, label: 'Glo', color: '#00B85F' },
    { provider: TelecomProvider.NINE_MOBILE, label: '9mobile', color: '#007A3E' },
  ];

  const redemptionAmounts = [100, 200, 500, 1000, 2500];

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-2 pb-6 space-y-4 text-[#F5F5F0]">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bebas text-2xl tracking-wider text-white">AIRTIME &amp; DATA WALLET</h2>
          <p className="text-xs text-[#9A9A9A]">Instant direct top-up to any Nigerian telecom</p>
        </div>
        <button
          onClick={() => navigate(routes.home)}
          className="text-xs text-[#00E676] hover:underline cursor-pointer"
        >
          ← Dashboard
        </button>
      </div>

      {/* Balance Card */}
      <section className="bg-gradient-to-br from-[#102D1E] to-[#0A1A12] border border-[#00B85F] rounded-2xl p-4 shadow-xl">
        <span className="text-[10px] font-bold text-[#A6ABB3] uppercase tracking-wider block">
          AVAILABLE REWARD BALANCE
        </span>
        <div className="flex items-baseline space-x-2 mt-1">
          {isLoadingBalance ? (
            <Skeleton width={120} height={36} baseColor="#1A1B1E" highlightColor="#2A2C31" />
          ) : (
            <span className="text-3xl font-black text-white">₦{balanceNgn.toLocaleString()}</span>
          )}
          <span className="text-xs text-[#00E676] font-semibold">Ready for Top-up</span>
        </div>
        <p className="text-[11px] text-[#A6ABB3] mt-2">
          Earned via Login Streaks, Daily Tasks &amp; Monthly Leaderboards. No bank KYC needed.
        </p>
      </section>

      {/* Operator Selection */}
      <section className="bg-[#1A1B1E] border border-[#303338] rounded-2xl p-3.5 space-y-3">
        <label className="text-[11px] font-bold text-[#8E9297] tracking-wider uppercase block">
          SELECT TELECOM NETWORK
        </label>
        <div className="grid grid-cols-4 gap-2">
          {providers.map((p) => (
            <button
              key={p.provider}
              onClick={() => {
                soundEffects.playButtonClick();
                setProvider(p.provider);
              }}
              className={`p-2 rounded-xl text-center border font-bold text-xs transition cursor-pointer ${
                selectedProvider === p.provider
                  ? 'bg-white/10 border-[#00B85F] text-white shadow'
                  : 'bg-[#111214] border-[#2A2C31] text-[#9A9A9A]'
              }`}
            >
              <div
                className="w-3 h-3 rounded-full mx-auto mb-1"
                style={{ backgroundColor: p.color }}
              />
              {p.label}
            </button>
          ))}
        </div>

        {/* Phone number */}
        <div>
          <label className="text-[11px] font-bold text-[#8E9297] tracking-wider uppercase block mb-1">
            NIGERIAN PHONE NUMBER
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="0803 000 0000"
            className="w-full bg-[#111214] border border-[#34373e] text-white text-sm rounded-xl p-3 focus:outline-none focus:border-[#00B85F]"
          />
        </div>

        {/* Top-up amount pills */}
        <div>
          <label className="text-[11px] font-bold text-[#8E9297] tracking-wider uppercase block mb-1.5">
            AMOUNT TO TOP-UP
          </label>
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
            {redemptionAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => {
                  soundEffects.playButtonClick();
                  setSelectedAmount(amt);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedAmount === amt
                    ? 'bg-[#00B85F] text-[#111214]'
                    : 'bg-[#111214] text-white border border-[#2A2C31]'
                }`}
              >
                ₦{amt}
              </button>
            ))}
          </div>
        </div>

        {/* Redeem Button */}
        <button
          onClick={handleRedeem}
          disabled={balanceNgn < selectedAmount || redeemMutation.isPending}
          className={`w-full py-3.5 rounded-full font-black text-sm tracking-wider uppercase transition shadow-lg cursor-pointer ${
            balanceNgn >= selectedAmount && !redeemMutation.isPending
              ? 'bg-[#00B85F] hover:bg-[#009951] text-[#111214] active:scale-[0.98]'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          {redeemMutation.isPending ? 'PROCESSING...' : balanceNgn >= selectedAmount
            ? `TOP-UP ₦${selectedAmount.toLocaleString()} AIRTIME NOW`
            : 'INSUFFICIENT BALANCE'}
        </button>
      </section>

      {/* Transaction & Audit History */}
      <section className="bg-[#1A1B1E] border border-[#303338] rounded-2xl p-3.5 space-y-2">
        <span className="text-[11px] font-bold text-[#8E9297] tracking-wider uppercase block">
          TRANSACTION &amp; AUDIT LOGS
        </span>
        <div className="divide-y divide-[#2A2C31] text-xs">
          {isLoadingTransactions ? (
            <div className="py-2.5"><Skeleton height={40} count={3} /></div>
          ) : transactions.length === 0 ? (
            <div className="py-4 text-center text-[#9A9A9A]">No transactions yet</div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white block">{tx.description}</span>
                  <span className="text-[10px] text-[#9A9A9A]">
                    {new Date(tx.timestamp).toLocaleDateString()} · {tx.status}
                  </span>
                </div>
                <span
                  className={`font-mono font-bold text-sm ${
                    tx.amountNgn > 0 ? 'text-[#00E676]' : 'text-white'
                  }`}
                >
                  {tx.amountNgn > 0 ? `+₦${tx.amountNgn}` : `-₦${Math.abs(tx.amountNgn)}`}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
