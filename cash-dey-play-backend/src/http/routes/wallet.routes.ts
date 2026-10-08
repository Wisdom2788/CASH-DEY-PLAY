import { Router } from "express";
import { WalletController } from "../controllers/wallet.controller";

export function createWalletRouter(walletController: WalletController): Router {
  const router = Router();

  router.get("/balance", walletController.getBalance);
  router.get("/transactions", walletController.getTransactions);
  router.post("/redeem", walletController.redeem);

  return router;
}
