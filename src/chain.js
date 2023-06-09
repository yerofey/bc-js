import { dirname, join } from 'path';
import {
  checkAndCreateDirectory,
  getFilesFromFolder,
  getLatestFileInFolder,
  getObjectHash,
  getRandomInt,
  getTwoUniqueRandomInts,
  objectHasAllKeys,
  readJsonFile,
  saveJsonFile,
} from './utils.js';
import Table from 'cli-table3';

class Chain {
  constructor() {
    this.dataPath = join(dirname(new URL(import.meta.url).pathname), '../data');
    this.balances = {};
    this.accountsHash = '';
    this.coins = 0;
    this.index = 0;
    this.oldIndex = 0;
    this.isBalanceAlreadySaved = false;
    this.isChainUpdateRequired = false;
    this.isFullScanRequired = false;
    this.isAccountsUpdateRequired = false;
    this.rewardAmount = 1000;
  }

  async init(fullScan = false) {
    await checkAndCreateDirectory(this.dataPath);
    await this.validateChain();
    await this.calculateBalances(this.isFullScanRequired || fullScan);
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
    await this.getAccountsData();

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

  async getChainData() {
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

  async getAccountsData() {
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

  async getLastTxId() {
    let txId = (await getLatestFileInFolder(this.dataPath, 'tx_')) || null;
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

  async createRandomTransfer(type) {
    let sender = 0;
    let receiver = getRandomInt(1, 10);
    let amount = getRandomInt(1, 100);

    if (type == 'reward') {
      amount = this.rewardAmount;
    }

    if (type == 'transfer') {
      [receiver, sender] = getTwoUniqueRandomInts(1, 10);
    }

    await this.saveTransaction(sender, receiver, amount, type);
  }

  async createTransfer(dataString) {
    if (dataString === undefined || dataString === null) {
      return;
    }

    const data = dataString.replace(/\s/g, '').split(',');
    if (data.length !== 3) {
      console.error(`Error: transfer requires 3 params: from,to,amount`);
      return;
    }

    await this.saveTransaction(
      parseInt(data[0]),
      parseInt(data[1]),
      parseFloat(data[2]),
      'transfer'
    );
    this.forceUpdate();
  }

  async saveTransaction(sender, receiver, amount, type) {
    const newTxId = this.index + 1;
    const currentDate = new Date();
    const fileName = `tx_${newTxId}.json`;
    const filePath = `${this.dataPath}/${fileName}`;
    const fee = sender === 0 ? 0 : Math.round(amount * 0.01);
    const total = parseFloat(amount + fee);
    const currentBalance = parseFloat(this.balances[sender] || 0);

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
    const saved = await saveJsonFile(filePath, data);
    if (!saved) {
      console.error(`Failed to save transaction`);
      return;
    }

    // update sender cached balance
    if (sender > 0) {
      this.balances[sender] = parseFloat(currentBalance - total);
    }
    // update receiver cached balance
    this.balances[receiver] = parseFloat(
      (this.balances[receiver] || 0) + parseFloat(amount)
    );
    // update tx index
    this.index += 1;
    // update coins count
    if (sender == 0) {
      this.coins += parseFloat(amount);
    }
    this.coins -= parseFloat(fee);

    console.log(
      `#${newTxId}: ${amount} sent from ${sender} to ${receiver} with ${fee} fee`
    );
  }

  forceUpdate() {
    this.isBalanceAlreadySaved = false;
    this.isChainUpdateRequired = true;
    this.isAccountsUpdateRequired = true;
  }

  async startHistory(count = 10) {
    for (let i = 1; i <= count; i++) {
      await this.createRandomTransfer('reward');
    }
    this.isAccountsUpdateRequired = true;
    this.isChainUpdateRequired = true;
  }

  async fillHistory(count = 1) {
    for (let i = 1; i <= count; i++) {
      await this.createRandomTransfer('transfer');
    }
    this.isAccountsUpdateRequired = true;
    this.isChainUpdateRequired = true;
  }

  async sendRewards(customRewardAmount) {
    const accounts = Object.keys(this.balances) || [];
    if (accounts.length === 0) {
      return;
    }

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

  async saveAccounts() {
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

  async saveChainData() {
    const filePath = `${this.dataPath}/chain.json`;
    await saveJsonFile(filePath, {
      accountsHash: getObjectHash(this.balances),
      coins: this.coins,
      index: this.index,
    });
  }

  printChainData() {
    const table = new Table({
      head: ['Coins', 'Index'],
      colWidths: [10, 10],
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
      colWidths: [10, 10],
    });
    for (let accountId of accounts) {
      table.push([accountId, this.balances[accountId]]);
    }
    console.log(table.toString());
  }

  async saveData() {
    if (this.index !== this.oldIndex || this.isAccountsUpdateRequired) {
      await this.saveAccounts();
    }

    if (this.index !== this.oldIndex || this.isChainUpdateRequired) {
      await this.saveChainData();
    }
  }
}

export default Chain;
