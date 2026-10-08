import { type Request, type Response, type NextFunction } from "express";
import { WalletRepository } from "../../db/repositories/wallet.repository";

export class WalletController {
  constructor(private readonly walletRepo: WalletRepository) {}

  getBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const balance = await this.walletRepo.getBalance(userId);
      res.json({ data: balance });
    } catch (error) {
      next(error);
    }
  };

  getTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const transactions = await this.walletRepo.getTransactions(userId);
      res.json({ data: transactions });
    } catch (error) {
      next(error);
    }
  };

  redeem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const { amountNgn, provider, phoneNumber } = req.body;

      if (!amountNgn || !provider || !phoneNumber) {
        res.status(400).json({ message: "amountNgn, provider, and phoneNumber are required" });
        return;
      }
      if (amountNgn < 50) {
        res.status(400).json({ message: "Minimum redemption is ₦50" });
        return;
      }

      const transaction = await this.walletRepo.debitWallet(
        userId, amountNgn, "AIRTIME_CASHOUT",
        `₦${amountNgn} airtime to ${phoneNumber}`,
        provider, phoneNumber
      );

      const balance = await this.walletRepo.getBalance(userId);
      res.json({
        data: {
          success: true,
          message: `₦${amountNgn} airtime sent to ${phoneNumber}`,
          newBalanceNgn: balance.balanceNgn,
          transaction,
        },
        message: `₦${amountNgn} airtime redeemed successfully!`,
      });
    } catch (error: any) {
      if (error.message === "Insufficient balance") {
        res.status(400).json({ message: "Insufficient wallet balance" });
        return;
      }
      next(error);
    }
  };
}
