import { type Request, type Response, type NextFunction } from "express";
import { NotImplementedFeatureError } from "../errors/http-errors";
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

  redeem = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // No funds may be reserved until provider delivery, idempotency and refunds exist.
    next(new NotImplementedFeatureError("Airtime redemption"));
  };
}
