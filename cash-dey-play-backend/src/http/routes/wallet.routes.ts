import { z } from "zod";
import { validateRequest } from "../middleware/validate-request.middleware";
import { Router } from "express";
import { WalletController } from "../controllers/wallet.controller";

export function createWalletRouter(walletController: WalletController): Router {
  const router = Router();

  router.get("/balance", validateRequest(z.object({query:z.strictObject({})})), walletController.getBalance);
  router.get("/transactions", validateRequest(z.object({query:z.strictObject({})})), walletController.getTransactions);
  router.post("/redeem", walletController.redeem);

  return router;
}
