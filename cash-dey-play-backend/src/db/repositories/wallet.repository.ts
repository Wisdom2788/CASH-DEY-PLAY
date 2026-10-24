import { Pool } from "pg";
import { LedgerRepository } from "../../ledger/ledger.repository";

interface WalletRow { id:string;type:string;amount_ngn:number;description:string;provider:string|null;phone_number:string|null;status:string;created_at:Date; }

export interface WalletBalance {
  balanceNgn: number;
  availableKobo: string;
}

export interface WalletTransaction {
  id: string;
  type: string;
  amountNgn: number;
  timestamp: number;
  description: string;
  provider?: string;
  phoneNumber?: string;
  status: string;
}

export interface WalletRepository {
  getBalance(userId: string): Promise<WalletBalance>;
  getTransactions(userId: string): Promise<WalletTransaction[]>;
  getEntries(userId: string, limit: number, cursor?: {createdAt:string;id:string}): ReturnType<LedgerRepository["entries"]>;
}

export class PostgresWalletRepository implements WalletRepository {
  constructor(private readonly pool: Pool) {}

  async getBalance(userId: string): Promise<WalletBalance> {
    const availableKobo = await new LedgerRepository(this.pool).availableKobo(userId);
    return {balanceNgn:Number(availableKobo)/100,availableKobo};
  }

  getEntries(userId:string,limit:number,cursor?:{createdAt:string;id:string}):ReturnType<LedgerRepository["entries"]> {
    return new LedgerRepository(this.pool).entries(userId,limit,cursor);
  }

  async getTransactions(userId: string): Promise<WalletTransaction[]> {
    const res = await this.pool.query<WalletRow>(
      `SELECT id, type, amount_ngn, description, provider, phone_number, status, created_at
       FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    return res.rows.map((row) => ({
      id: row.id.toString(),
      type: row.type,
      amountNgn: row.amount_ngn,
      timestamp: new Date(row.created_at).getTime(),
      description: row.description,
      ...(row.provider ? {provider:row.provider} : {}),
      ...(row.phone_number ? {phoneNumber:row.phone_number} : {}),
      status: row.status,
    }));
  }

}
