import { dirname, join } from 'path';
import {
  checkAndCreateDirectory,
  getFilesFromFolder,
  getLatestFileInFolder,
  getRandom,
  objectHasAllKeys,
  readJsonFile,
  saveJsonFile,
} from './utils.js';
import Table from 'cli-table3';

class Chain {
  constructor() {
    this.dataPath = join(dirname(new URL(import.meta.url).pathname), '../data');
    this.balances = {};
    this.data = {};
    this.coins = 0;
    this.index = 0;
    this.oldIndex = 0;
    this.isChainUpdateRequired = false;
    this.isFullScanRequired = false;
    this.isBalanceUpdateRequired = false;
    this.rewardAmount = 1000;
  }

  async init(fullScan = false) {
    await checkAndCreateDirectory(this.dataPath);
    await this.validateChain();
    await this.calculateBalances((this.isFullScanRequired || fullScan));
  }

  async append(appendCount = 1, initialCount = 10) {
    if (this.index === 0) {
      await this.startHistory(initialCount);
    } else {
      await this.fillHistory(appendCount);
    }
  }

  async validateChain() {
    await this.getChainData();
    const lastTxId = await this.getLastTxId();
    const txCount = (await getFilesFromFolder(this.dataPath, 'tx_')).length || 0;

    if (lastTxId !== this.index || txCount !== this.index) {
      this.isFullScanRequired = true;
      this.isChainUpdateRequired = true;
      this.isBalanceUpdateRequired = true;
    }

    this.index = lastTxId;
    this.oldIndex = lastTxId;
  }

  async getChainData() {
    const filePath = `${this.dataPath}/chain.json`;
    let data = await readJsonFile(filePath);
    if (!objectHasAllKeys(data, [
      'coins',
      'index',
    ])) {
      this.coins = 0;
      this.index = 0;
      this.isChainUpdateRequired = true;
    }
    this.coins = data.coins || 0;
    this.index = data.index || 0;
  }

  async getLastTxId() {
    let txId = await getLatestFileInFolder(this.dataPath, 'tx_') || null;
    if (txId === null) {
      return 0;
    }

    if (txId.startsWith('tx_')) {
      txId = txId.slice(3);
    }
    if (txId.endsWith('.json')) {
      txId = txId.substring(0, txId.length - 5);
    }
    txId = parseInt(txId);

    return txId;
  }

  async createTransaction(sender, receiver, amount, type) {
    const newTxId = this.index + 1;
    const currentDate = new Date();
    const fileName = `tx_${newTxId}.json`;
    const filePath = `${this.dataPath}/${fileName}`;
    const fee = sender === 0 ? 0 : Math.round(amount * 0.01);
    const total = amount + fee;
    const currentBalance = this.balances[sender];

    if (currentBalance < total && sender > 0) {
      console.log(
        `${sender}'s balance is too low. Current Balance ${currentBalance}. Required amount ${total}`
      );
      return;
    }

    if (sender === receiver) {
      console.log(`Mr. ${sender}\nYou can not send tokens to yourself`);
      return;
    }

    try {
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
      await saveJsonFile(filePath, data);
      // update sender cached balance
      if (sender > 0) {
        this.balances[sender] = currentBalance - total;
      }
      // update receiver cached balance
      this.balances[receiver] = (this.balances[receiver] || 0) + amount;
      // increase tx count
      this.index += 1;
      // increase coins count
      if (sender == 0) {
        this.coins += amount;
      }

      console.log(
        `#${newTxId}: ${amount} sent from ${sender} to ${receiver} with ${fee} fee`
      );
    } catch (err) {
      console.error('Error writing to file:', err);
    }
  }

  async generateDummyTransaction(type) {
    const sender = type == 'reward' ? 0 : getRandom();
    const receiver = getRandom();
    const amount =
      type == 'reward' ? this.rewardAmount : getRandom();
    await this.createTransaction(sender, receiver, amount, type);
  }

  async startHistory(count = 10) {
    for (let i = 1; i <= count; i++) {
      await this.generateDummyTransaction('reward');
    }
    this.isBalanceUpdateRequired = true;
    this.isChainUpdateRequired = true;
  }

  async fillHistory(count = 1) {
    for (let i = 1; i <= count; i++) {
      await this.generateDummyTransaction('transfer');
    }
    this.isBalanceUpdateRequired = true;
    this.isChainUpdateRequired = true;
  }

  async sendRewards(customRewardAmount) {
    const accounts = Object.keys(this.balances) || [];
    if (accounts.length === 0) {
      return;
    }

    const reward = parseInt(customRewardAmount || this.rewardAmount);
    console.log('reward', reward);
    for (let accountId of accounts) {
      await this.createTransaction(
        0,
        accountId,
        reward,
        'reward'
      );
    }

    this.isBalanceUpdateRequired = true;
    this.isChainUpdateRequired = true;
  }

  async calculateBalances(fullScan = false) {
    if (this.index === 0) {
      return;
    }

    const files = await getFilesFromFolder(this.dataPath);

    if (fullScan) {
      this.coins = 0;
      let totalCoins = 0;
      const txFiles = files.filter((file) => file.startsWith('tx_'));
      for (let file of txFiles) {
        const filePath = `${this.dataPath}/${file}`;
        const tx = await readJsonFile(filePath);
        if (objectHasAllKeys(tx, [
          'sender',
          'receiver',
          'amount',
          'fee',
        ])) {
          // update sender balance
          if (this.balances[tx.sender] === undefined && tx.sender > 0) {
            this.balances[tx.sender] = 0;
          }
          if (tx.sender > 0) {
            this.balances[tx.sender] -= tx.amount + tx.fee;
          }
          // update receiver balance
          if (this.balances[tx.receiver] === undefined) {
            this.balances[tx.receiver] = 0;
          }
          this.balances[tx.receiver] += tx.amount;
          // update total coins
          if (tx.sender == 0) {
            totalCoins += tx.amount;
          }
          if (tx.receiver == 0) {
            totalCoins -= (tx.amount + tx.fee);
          }
        }
      }
      this.coins = totalCoins;
      this.index = await this.getLastTxId();
      this.isChainUpdateRequired = true;
      this.isBalanceUpdateRequired = true;
    } else {
      const accountFiles = files.filter((file) => file.startsWith('account_'));
      for (let file of accountFiles) {
        const filePath = `${this.dataPath}/${file}`;
        const account = await readJsonFile(filePath);
        this.balances[account.id] = account.balance || 0;
      }
    }
  }

  async updateBalances() {
    const accounts = Object.keys(this.balances) || [];
    if (accounts.length === 0) {
      return;
    }

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

  async updateChainData() {
    const filePath = `${this.dataPath}/chain.json`;
    await saveJsonFile(filePath, {
      coins: this.coins,
      index: this.index,
    });
  }

  printChainData() {
    const table = new Table({
      head: ['Coins', 'Index'],
      colWidths: [10, 10]
    });
    table.push([this.coins, this.index]);
    console.log(table.toString());
  }

  async printAccountsBalances() {
    const accounts = Object.keys(this.balances) || [];
    if (accounts.length === 0) {
      return;
    }

    const table = new Table({
      head: ['Account', 'Balance'],
      colWidths: [10, 10]
    });
    for (let accountId of accounts) {
      table.push([accountId, this.balances[accountId]]);
    }
    console.log(table.toString());
  }

  async updateFiles() {
    if (this.index !== this.oldIndex || this.isBalanceUpdateRequired) {
      await this.updateBalances();
    }

    if (this.index !== this.oldIndex || this.isChainUpdateRequired) {
      await this.updateChainData();
    }
  }
}

export default Chain;
