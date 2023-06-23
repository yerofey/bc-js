import { config } from 'dotenv';
import express from 'express';
import cors from 'cors';
import DB from './src/db.js';

config();

const app = express();
const db = new DB();
const dbCollectionAccounts = process.env.DB_COLLECTION_ACCOUNTS;
const dbCollectionTransactions = process.env.DB_COLLECTION_TRANSACTIONS;

app.use(cors());
app.use(express.json());

app.get('/accounts', async (req, res) => {
  const { offset = 0, limit = 100 } = req.query;

  try {
    await db.connect();
    const accounts = await db.find(
      dbCollectionAccounts,
      {},
      parseInt(offset),
      parseInt(limit)
    );
    const sanitizedAccounts = accounts.map(({ _id, ...rest }) => rest);
    res.json(sanitizedAccounts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

app.get('/accounts/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await db.connect();
    const account = await db.find(dbCollectionAccounts, { id });
    console.log('result', account);
    if (account.length === 0) {
      res.status(404).json({ error: 'Account not found' });
    } else {
      res.json(account[0]);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

app.post('/accounts/create', async (req, res) => {
  const { balance } = req.body;

  try {
    await db.connect();

    const lastAccountId = await db.getLastId(dbCollectionAccounts);
    const nextAccountId = lastAccountId + 1;
    const lastTransactionId = await db.getLastId(dbCollectionTransactions);
    const nextTransactionId = lastTransactionId + 1;
    const newAccountBalance = balance || 1000;

    // save transaction
    const savedTransaction = await db.insert(dbCollectionTransactions, [
      {
        id: nextTransactionId,
        sender: 0,
        receiver: nextAccountId,
        amount: newAccountBalance,
        fee: 0,
        type: 'reward',
        timestamp: Date.now(),
      }
    ]);
    // save account
    const savedAccount = await db.insert(dbCollectionAccounts, [
      {
        id: nextAccountId,
        balance: newAccountBalance,
        index: nextTransactionId,
      }
    ]);

    if (savedTransaction.insertedCount === 1 && savedAccount.insertedCount === 1) {
      res.status(201).json({
        success: true,
        data: {
          id: nextAccountId,
          balance: newAccountBalance,
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to create account',
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.get('/data/items', async (req, res) => {
  try {
    await db.connect();

    const lastAccountId = await db.getLastId(dbCollectionAccounts);
    const lastTransactionId = await db.getLastId(dbCollectionTransactions);

    res.status(200).json({
      data: {
        lastAccountId,
        lastTransactionId,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err });
  }
});

const port = process.env.PORT;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
