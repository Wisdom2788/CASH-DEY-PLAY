import { requireUserId } from "../middleware/auth.middleware";
import { type Request, type Response, type NextFunction } from "express";
import { NotImplementedFeatureError } from "../errors/http-errors";
import { WalletRepository } from "../../db/repositories/wallet.repository";

export class WalletController {
  constructor(private readonly walletRepo: WalletRepository) {}

  getBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const balance = await this.walletRepo.getBalance(userId);
      res.setHeader("Cache-Control","no-store");
      res.json({ data: balance });
    } catch (error) {
      next(error);
    }
  };

  getTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const transactions = await this.walletRepo.getTransactions(userId);
      res.json({ data: transactions });
    } catch (error) {
      next(error);
    }
  };

  getEntries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = requireUserId(req);
      const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
      const cursor = req.query.createdAt === undefined ? undefined : {createdAt:String(req.query.createdAt),id:String(req.query.id)};
      const rows = await this.walletRepo.getEntries(userId,limit,cursor);
      const last = rows[rows.length-1];
      res.setHeader("Cache-Control","no-store");
      res.json({data:rows,nextCursor:rows.length===limit && last ? {createdAt:last.created_at,id:last.id} : null});
    } catch(error) { next(error); }
  };

  redeem = async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // No funds may be reserved until provider delivery, idempotency and refunds exist.
    next(new NotImplementedFeatureError("Airtime redemption"));
  };
}
