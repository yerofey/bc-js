import { dirname, join } from 'path';
import {
  checkAndCreateDirectory,
  getFilesFromFolder,
  getLatestFileInFolder,
  getObjectHash,
  getRandomInt,
  getTwoUniqueRandomInts,
  getMaxArrayValue,
  objectHasAllKeys,
  readJsonFile,
  saveJsonFile,
  log,
} from './utils.js';
import Table from 'cli-table3';
import chalk from 'chalk';
import inquirer from 'inquirer';
import DB from './db.js';

class Chain {
  constructor(useDb = false) {
    this.dataPath = join(dirname(new URL(import.meta.url).pathname), '../data');
    this.balances = {};
    this.feeAmount = 1; // %
    this.rewardAmount = 1000;
    this.accountsHash = '';
    this.coins = 0;
    this.index = 0;
    this.oldIndex = 0;
    this.failedAccountsTransfers = [];
    this.pendingTransactions = [];
    this.touchedAccounts = [];
    this.isBalanceAlreadySaved = false;
    this.isChainUpdateRequired = false;
    this.isFullScanRequired = false;
    this.isAccountsUpdateRequired = false;
    this.useDatabase = useDb;
    this.useFiles = !useDb;
    this.isDbConnected = false;
    this.isFinished = false;
    this.dbCalls = 0;

    if (useDb) {
      this.db = new DB();
      this.DB_ACCOUNTS = process.env.DB_COLLECTION_ACCOUNTS;
      this.DB_TRANSACTIONS = process.env.DB_COLLECTION_TRANSACTIONS;
    }
  }

  async init(options) {
    const fullScan = options.scan || false;

    if (this.useFiles) {
      log(chalk.blue(`📁 Using file system to store chain data`));
      await checkAndCreateDirectory(this.dataPath);
    }

    if (this.useDatabase) {
      log(chalk.blue(`🗄  Using DB to store chain data`));
      try {
        log(chalk.gray(`🔗 Connecting to the DB...`));
        this.isDbConnected = await this.db.connect();
      } catch (err) {
        log(chalk.red(`🚫 Failed to connect to the DB: ${err}`));
        this.exit();
      }
    }

    await this.validateChain();
    await this.calculateBalances(this.isFullScanRequired || fullScan);

    // work with CLI options
    if (options.erase) {
      await this.eraseData();
    } else {
      await this.processRegularStart(options);
    }

    await this.printAccountsBalances();
    this.printChainData();
    await this.closeDbConnection();
  }

  async processRegularStart(options) {
    if (options.airdrop || options.reward) {
      await this.sendRewards(options.airdrop);
    }

    if (options.transfer) {
      await this.createTransfer(options.transfer);
    }

    if (options.count) {
      await this.append(options.count || 1);
    }

    await this.saveData();
  }

  async append(appendCount = 1, initialCount = 10) {
    if (this.index === 0) {
      await this.startHistory(initialCount);
    } else {
      await this.fillHistory(appendCount);
    }
  }

  async validateChain() {
    if (this.useDatabase && !this.isDbConnected) {
      log(chalk.red(`🚫 Database connection failed`));
      this.exit();
    }

    await this.getChainData();
    await this.getAccountsData();

    if (this.useFiles) {
      const lastTxId = await this.getLastTxId();
      const txCount =
        (await getFilesFromFolder(this.dataPath, 'tx_')).length || 0;
      const accountsFilesHash = getObjectHash(this.balances);

      if (
        lastTxId !== this.index ||
        txCount !== this.index ||
        accountsFilesHash !== this.accountsHash
      ) {
        this.accountsHash = accountsFilesHash;
        this.isFullScanRequired = true;
        this.isChainUpdateRequired = true;
        this.isAccountsUpdateRequired = true;
      }

      this.index = lastTxId;
      this.oldIndex = lastTxId;
    }
  }

  async getChainData() {
    if (this.useFiles) {
      const filePath = `${this.dataPath}/chain.json`;
      let data = await readJsonFile(filePath);
      if (!objectHasAllKeys(data, ['coins', 'index', 'accountsHash'])) {
        this.accountsHash = '';
        this.coins = 0;
        this.index = 0;
        this.isChainUpdateRequired = true;
      }
      this.accountsHash = data.accountsHash || '';
      this.coins = data.coins || 0;
      this.index = data.index || 0;
    }

    if (this.useDatabase) {
      this.index = (await this.getLastTxId()) || 0;
    }
  }

  async getAccountsData() {
    if (this.useFiles) {
      const files = await getFilesFromFolder(this.dataPath);
      const accountFiles = files.filter((file) => file.startsWith('account_'));

      if (accountFiles.length === 0) {
        return;
      }

      for (let file of accountFiles) {
        const filePath = `${this.dataPath}/${file}`;
        const account = await readJsonFile(filePath);
        this.balances[account.id] = account.balance || 0;
      }

      this.isBalanceAlreadySaved = true;
    }

    if (this.useDatabase) {
      const accounts = (await this.getDbAccountsBalances()) || [];
      if (accounts.length > 0) {
        for (let account of accounts) {
          const accountBalance = account.balance || 0;
          this.balances[parseInt(account.id)] = accountBalance;
          this.coins += accountBalance;
        }
      } else {
        log(chalk.yellow(`⚠️ No accounts found!`));
      }

      this.isBalanceAlreadySaved = true;
    }
  }

  async getDbAccountsBalances(getSavedBalances = true) {
    log(chalk.gray(`🪪  Collecting accounts data...`)); // 🔎

    try {
      let accountBalances;

      if (getSavedBalances) {
        const collection = this.db.connection.collection(this.DB_ACCOUNTS);
        const pipeline = [
          {
            $project: {
              _id: 0,
              id: 1,
              balance: 1,
            },
          },
        ];
        accountBalances = await collection.aggregate(pipeline).toArray();
        this.dbCalls += 1;
      }

      return accountBalances;
    } catch (err) {
      log(chalk.red(`🚫 Failed to calculate accounts balances: ${err}`));
    }
  }

  async getLastTxId() {
    log(chalk.gray(`🗂️  Calculating last tx ID...`)); // 🔎

    let txId = 0;

    if (this.useFiles) {
      txId = (await getLatestFileInFolder(this.dataPath, 'tx_')) || null;
      if (txId === 0) {
        return 0;
      }

      if (txId.startsWith('tx_')) {
        txId = txId.slice(3);
      }
      if (txId.endsWith('.json')) {
        txId = txId.substring(0, txId.length - 5);
      }
      txId = parseInt(txId);
    }

    if (this.useDatabase) {
      try {
        const collection = this.db.connection.collection(this.DB_TRANSACTIONS);
        const result = await collection
          .find()
          .sort({ id: -1 })
          .limit(1)
          .toArray();
        if (result.length > 0) {
          txId = result[0].id;
        }
        this.dbCalls += 1;
      } catch (err) {
        log(chalk.red(`🚫 Failed to get last tx id: ${err}`));
      }
    }

    return txId;
  }

  async getDbCoins() {
    log(chalk.gray(`🧮 Calculating total coins amount...`));

    let totalAmount = 0;

    try {
      const sender = 0;
      const receiver = { $ne: 0 };
      const collection = this.db.connection.collection(this.DB_TRANSACTIONS);
      const result = await collection
        .aggregate([
          {
            $match: { sender, receiver },
          },
          {
            $group: {
              _id: null,
              totalAmount: {
                $sum: {
                  $subtract: ['$amount', '$fee'],
                },
              },
            },
          },
        ])
        .toArray();
      totalAmount = result.length > 0 ? result[0].totalAmount : 0;
      this.dbCalls += 1;
    } catch (err) {
      log(chalk.red(`🚫 Failed to get total amount of coins: ${err}`));
    }

    return totalAmount;
  }

  async createRandomTransfer() {
    const firstAccountId = 1;
    const highestAccountId =
      Object.keys(this.balances).length > 0
        ? getMaxArrayValue(Object.keys(this.balances))
        : 10;

    let sender = 0;
    let receiver = 0;
    [sender, receiver] = getTwoUniqueRandomInts(
      firstAccountId,
      highestAccountId
    );
    const amount = getRandomInt(1, 100);

    return await this.saveTransaction(sender, receiver, amount, 'transfer');
  }

  async createTransfer() {
    log(chalk.green(`💸 Creating new transaction`));

    try {
      const input = await inquirer.prompt([
        {
          type: 'input',
          name: 'sender',
          message: `⤴️ Sender:`,
          default: 0,
        },
        {
          type: 'input',
          name: 'receiver',
          message: `⤵️ Receiver:`,
          default: 0,
        },
        {
          type: 'input',
          name: 'amount',
          message: `🔢Amount:`,
          default: 0,
        },
        {
          type: 'input',
          name: 'type',
          message: `*️⃣ Type:`,
          default: 'transfer',
        },
      ]);

      await this.saveTransaction(
        parseInt(input.sender),
        parseInt(input.receiver),
        parseFloat(input.amount),
        input.type || 'transfer'
      );

      this.forceUpdate();
    } catch (err) {
      log(chalk.red(`🚫 Failed to create transaction`));
    }
  }

  async saveTransaction(sender, receiver, amount, type) {
    const newTxId = this.index + 1;
    const currentDate = new Date();
    const fee = sender === 0 ? 0 : parseFloat((amount / 100) * this.feeAmount);
    const total = parseFloat(amount + fee);
    const currentBalance = parseFloat(this.balances[sender] || 0);

    if (sender > 0 && (currentBalance < total || total > this.coins)) {
      log(
        chalk.yellow(
          `⚠️  ${sender}'s balance is too low. Current balance: ${currentBalance.toFixed(
            2
          )}. Required amount: ${total.toFixed(2)}`
        )
      );

      // save failed transfer account id
      if (!this.failedAccountsTransfers.includes(sender)) {
        this.failedAccountsTransfers.push(sender);
      }

      return false;
    }

    // save tx
    const data = {
      id: newTxId,
      sender: parseInt(sender),
      receiver: parseInt(receiver),
      amount: parseFloat(amount),
      fee: parseFloat(fee),
      type: type || 'transfer',
      timestamp: currentDate.getTime(),
    };
    let saved = false;

    if (this.useFiles) {
      const fileName = `tx_${newTxId}.json`;
      const filePath = `${this.dataPath}/${fileName}`;
      saved = await saveJsonFile(filePath, data);
    }

    // if we are using db - save tx into mempool (it will be saved at the end)
    if (this.useDatabase) {
      // add tx into mempool
      this.pendingTransactions.push(data);
      // mark accounts to update
      if (sender > 0 && !this.touchedAccounts.includes(sender)) {
        this.touchedAccounts.push(sender);
      }
      if (receiver > 0 && !this.touchedAccounts.includes(receiver)) {
        this.touchedAccounts.push(receiver);
      }
      saved = true;
    }

    if (!saved) {
      log(chalk.red(`🚫 Failed to save transaction`));
      return false;
    }

    // update sender cached balance
    if (sender > 0) {
      this.balances[sender] = parseFloat(currentBalance - total);
    }
    // update receiver cached balance
    this.balances[receiver] =
      parseFloat(this.balances[receiver] || 0) + parseFloat(amount);
    // update tx index
    this.index += 1;
    // update coins count
    if (sender == 0) {
      this.coins += parseFloat(amount);
    }
    this.coins -= parseFloat(fee);

    if (this.useFiles && saved) {
      log(
        chalk.green(
          `📦  Tx #${newTxId} is saved: ${amount} coins sent from ${sender} to ${receiver} with ${fee} fee`
        )
      );
    }

    if (this.useDatabase) {
      log(
        chalk.cyan(
          `🗳  Tx #${newTxId} is queued: ${amount} coins to be sent from ${sender} to ${receiver} with ${fee} fee`
        )
      );
    }

    return true;
  }

  forceUpdate() {
    this.isBalanceAlreadySaved = false;
    this.isChainUpdateRequired = true;
    this.isAccountsUpdateRequired = true;
  }

  async startHistory(count = 10) {
    log(chalk.green(`🎉 New chain is started!`));
    for (let i = 1; i <= count; i++) {
      await this.saveTransaction(0, i, this.rewardAmount, 'reward');
    }
    this.isAccountsUpdateRequired = true;
    this.isChainUpdateRequired = true;
  }

  async fillHistory(count = 1) {
    log(chalk.blue(`⏳ Adding ${count} tx into chain...`));

    let i = count;
    while (i > 0) {
      const txIsCreated = await this.createRandomTransfer();
      if (txIsCreated) {
        i -= 1;
      } else {
        // all accounts balances are not enough to make transactions
        if (this.failedAccountsTransfers.length === Object.keys(this.balances).length) {
          break;
        }
      }
    }

    this.isAccountsUpdateRequired = true;
    this.isChainUpdateRequired = true;
  }

  async sendRewards(customRewardAmount) {
    const accounts = Object.keys(this.balances) || [];
    if (accounts.length === 0) {
      return;
    }

    log(chalk.magenta(`💸 Sending rewards to everyone...`));

    const reward = parseInt(customRewardAmount || this.rewardAmount);
    for (let accountId of accounts) {
      await this.saveTransaction(0, accountId, reward, 'reward');
    }

    this.isAccountsUpdateRequired = true;
    this.isChainUpdateRequired = true;
  }

  async calculateBalances(fullScan = false) {
    if (this.index === 0 || (this.isBalanceAlreadySaved && !fullScan)) {
      return;
    }

    if (this.useFiles) {
      const files = await getFilesFromFolder(this.dataPath);

      if (fullScan) {
        this.balances = {};
        this.coins = 0;
        this.index = 0;
        let totalCoins = 0;
        const txFiles = files.filter((file) => file.startsWith('tx_'));
        for (let file of txFiles) {
          const filePath = `${this.dataPath}/${file}`;
          const tx = await readJsonFile(filePath);
          if (objectHasAllKeys(tx, ['sender', 'receiver', 'amount', 'fee'])) {
            // update sender balance
            if (this.balances[tx.sender] === undefined && tx.sender > 0) {
              this.balances[tx.sender] = 0;
            }
            if (tx.sender > 0) {
              this.balances[tx.sender] -= parseFloat(tx.amount + tx.fee);
            }
            // update receiver balance
            if (this.balances[tx.receiver] === undefined) {
              this.balances[tx.receiver] = 0;
            }
            this.balances[tx.receiver] += parseFloat(tx.amount);
            // update total coins
            if (tx.sender == 0) {
              totalCoins += parseFloat(tx.amount);
            }
            if (tx.receiver == 0) {
              totalCoins -= parseFloat(tx.amount + tx.fee);
            }
            totalCoins -= parseFloat(tx.fee);
          }
        }
        this.coins = totalCoins;
        this.index = await this.getLastTxId();
        this.isChainUpdateRequired = true;
        this.isAccountsUpdateRequired = true;
      } else {
        await this.getAccountsData();
      }
    }
  }

  async saveAccounts() {
    const accounts = Object.keys(this.balances) || [];
    if (accounts.length === 0) {
      return;
    }

    if (this.useFiles) {
      for (let accountId of accounts) {
        const filePath = `${this.dataPath}/account_${accountId}.json`;
        const data = {
          id: accountId,
          balance: this.balances[accountId],
          index: this.index,
        };
        await saveJsonFile(filePath, data);
      }
    }

    if (this.useDatabase) {
      if (this.touchedAccounts.length === 0) {
        return;
      }

      log(chalk.gray(`💾 Saving accounts data...`));

      try {
        const collection = this.db.connection.collection(this.DB_ACCOUNTS);
        const accountUpdates = [];
        for (let accountId of this.touchedAccounts) {
          accountUpdates.push({
            filter: {
              id: parseInt(accountId),
            },
            update: {
              $set: {
                balance: this.balances[parseInt(accountId)] || 0,
                index: this.index,
              },
            },
            upsert: true,
          });
        }
        const bulkUpdates = accountUpdates.map((update) => ({
          updateOne: {
            filter: update.filter,
            update: update.update,
            upsert: update.upsert,
          },
        }));
        await collection.bulkWrite(bulkUpdates);
        this.dbCalls += 1;
      } catch (err) {
        log(chalk.red(`🚫 Failed to update accounts: ${err}`));
      }
    }
  }

  async saveChainData() {
    if (this.useFiles) {
      const filePath = `${this.dataPath}/chain.json`;
      await saveJsonFile(filePath, {
        accountsHash: getObjectHash(this.balances),
        coins: this.coins,
        index: this.index,
      });
    }
  }

  getTableColumnWidth(value) {
    const columnWidth = value.toString().length;
    const minimumWidth = 10;

    if (columnWidth < 8) {
      return minimumWidth;
    }

    return columnWidth + 2;
  }

  printChainData() {
    const table = new Table({
      head: ['Coins', 'Index'],
      colWidths: [
        this.getTableColumnWidth(this.coins.toFixed(4)),
        this.getTableColumnWidth(this.index),
      ],
    });
    table.push([this.coins, this.index]);
    log(table.toString());
  }

  async printAccountsBalances() {
    if (!this.isFinished) {
      await this.closeDbConnection();
    }

    const accounts = Object.keys(this.balances) || [];
    if (accounts.length === 0) {
      return;
    }

    const table = new Table({
      head: ['Account', 'Balance'],
      colWidths: [
        this.getTableColumnWidth(
          getMaxArrayValue(Object.keys(this.balances)).toFixed(4)
        ),
        this.getTableColumnWidth(
          getMaxArrayValue(Object.values(this.balances)).toFixed(4)
        ),
      ],
    });
    for (let accountId of accounts) {
      table.push([accountId, this.balances[accountId]]);
    }
    log(table.toString());
  }

  async savePendingTransactions() {
    if (this.pendingTransactions.length === 0) {
      return;
    }

    log(chalk.gray(`💾 Saving pending transactions...`));

    // TODO: split on chunks if array is too big

    try {
      const result = await this.db.insert(
        this.DB_TRANSACTIONS,
        this.pendingTransactions
      );
      if (result.insertedCount) {
        log(
          chalk.green(
            `✅ ${result.insertedCount} transaction${
              result.insertedCount > 1 ? 's' : ''
            } saved into DB`
          )
        );
        this.pendingTransactions = [];
      }
      this.dbCalls += 1;
    } catch (err) {
      log(chalk.red(`🚫 Failed to save pending transactions: ${err}`));
    }
  }

  async eraseData() {
    log(chalk.yellow(`⚠️ Erasing the chain data`));

    try {
      const input = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'sure',
          message: `⁉️ Do you really want to erase the data?`,
          default: true,
        },
      ]);

      if (input.sure) {
        log(chalk.gray(`🗑 Erasing DB data...`));

        await this.db.clear(this.DB_ACCOUNTS);
        this.dbCalls += 1;
        await this.db.clear(this.DB_TRANSACTIONS);
        this.dbCalls += 1;

        log(chalk.blue(`✅ Database is erased!`));
      } else {
        log(chalk.blue(`❎ Erase is declined!`));
      }

      this.balances = [];
      this.coins = 0;
      this.index = 0;
    } catch (err) {
      log(chalk.red(`🚫 Failed to erase the chain data`));
    }
  }

  async saveData() {
    if (this.useDatabase) {
      await this.savePendingTransactions();
    }

    if (this.index !== this.oldIndex || this.isAccountsUpdateRequired) {
      await this.saveAccounts();
    }

    if (this.index !== this.oldIndex || this.isChainUpdateRequired) {
      await this.saveChainData();
    }
  }

  async closeDbConnection() {
    if (!this.isDbConnected || this.isFinished) {
      return;
    }

    log(chalk.gray(`🔌 Closing the DB connection...`));

    try {
      await this.db.disconnect();
      this.isFinished = true;
    } catch (err) {
      log(chalk.red(`🚫 Failed to close connection`));
    }
  }

  exit() {
    this.closeDbConnection();
    process.exit(0);
  }
}

export default Chain;
