import { Pool } from "pg";

export interface WalletBalance {
  balanceNgn: number;
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
  creditWallet(userId: string, amountNgn: number, type: string, description: string): Promise<void>;
  debitWallet(userId: string, amountNgn: number, type: string, description: string, provider: string, phoneNumber: string): Promise<WalletTransaction>;
}

export class PostgresWalletRepository implements WalletRepository {
  constructor(private readonly pool: Pool) {}

  async getBalance(userId: string): Promise<WalletBalance> {
    // Ensure wallet row exists
    await this.pool.query(
      `INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    const res = await this.pool.query(
      `SELECT balance_ngn FROM wallets WHERE user_id = $1`,
      [userId]
    );
    return { balanceNgn: res.rows[0]?.balance_ngn ?? 0 };
  }

  async getTransactions(userId: string): Promise<WalletTransaction[]> {
    const res = await this.pool.query(
      `SELECT id, type, amount_ngn, description, provider, phone_number, status, created_at
       FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    return res.rows.map((row: any) => ({
      id: row.id.toString(),
      type: row.type,
      amountNgn: row.amount_ngn,
      timestamp: new Date(row.created_at).getTime(),
      description: row.description,
      provider: row.provider || undefined,
      phoneNumber: row.phone_number || undefined,
      status: row.status,
    }));
  }

  async creditWallet(userId: string, amountNgn: number, type: string, description: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO wallets (user_id, balance_ngn) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET balance_ngn = wallets.balance_ngn + $2, updated_at = NOW()`,
        [userId, amountNgn]
      );
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount_ngn, description)
         VALUES ($1, $2, $3, $4)`,
        [userId, type, amountNgn, description]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async debitWallet(userId: string, amountNgn: number, type: string, description: string, provider: string, phoneNumber: string): Promise<WalletTransaction> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      
      const balRes = await client.query(
        `SELECT balance_ngn FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );
      const currentBalance = balRes.rows[0]?.balance_ngn ?? 0;
      if (currentBalance < amountNgn) {
        throw new Error("Insufficient balance");
      }
      
      await client.query(
        `UPDATE wallets SET balance_ngn = balance_ngn - $2, updated_at = NOW() WHERE user_id = $1`,
        [userId, amountNgn]
      );
      const txRes = await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount_ngn, description, provider, phone_number, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING') RETURNING *`,
        [userId, type, amountNgn, description, provider, phoneNumber]
      );
      await client.query("COMMIT");
      
      const row = txRes.rows[0];
      return {
        id: row.id.toString(),
        type: row.type,
        amountNgn: row.amount_ngn,
        timestamp: new Date(row.created_at).getTime(),
        description: row.description,
        provider: row.provider,
        phoneNumber: row.phone_number,
        status: row.status,
      };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
