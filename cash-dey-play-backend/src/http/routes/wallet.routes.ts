import { z } from "zod";
import { validateRequest } from "../middleware/validate-request.middleware";
import { Router } from "express";
import { WalletController } from "../controllers/wallet.controller";

export function createWalletRouter(walletController: WalletController): Router {
  const router = Router();

  router.get("/balance", validateRequest(z.object({query:z.strictObject({})})), walletController.getBalance);
  router.get("/transactions", validateRequest(z.object({query:z.strictObject({})})), walletController.getTransactions);
  router.get("/entries", validateRequest(z.object({query:z.strictObject({
    limit:z.string().regex(/^(?:[1-9]|[1-9][0-9]|100)$/).optional(),
    createdAt:z.iso.datetime({precision:6}).optional(),
    id:z.uuid().optional(),
  }).refine(q=>(q.createdAt===undefined)===(q.id===undefined),"Both cursor fields are required")})),walletController.getEntries);
  router.post("/redeem", walletController.redeem);

  return router;
}
