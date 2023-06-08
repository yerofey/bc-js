import { writeFile, readdir, readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { checkAndCreateDirectory, countFilesInFolder } from './utils.js';

class Chain {
  constructor() {
    this.dataPath = join(dirname(new URL(import.meta.url).pathname), '../data');
    this.balances = {};
    this.length = 0;
    this.rewardAmount = 1000;
    this.oldLength = 0;
    this.wasUpdated = false;
  }

  async init(fullScan = false) {
    await checkAndCreateDirectory(this.dataPath);
    const txCount = await countFilesInFolder(this.dataPath, 'tx_');;
    this.length = txCount;
    this.oldLength = txCount;
    await this.calculateBalances(fullScan);
  }

  async append(initialCount = 10, appendCount = 1) {
    if (this.length === 0) {
      await this.startHistory(initialCount);
    } else {
      await this.fillHistory(appendCount);
    }
  }

  async createTransaction(sender, receiver, amount, type) {
    const newTxId = this.length + 1;
    const currentDate = new Date();
    const fileName = `tx_${newTxId}.json`;
    const filePath = `${this.dataPath}/${fileName}`;
    const fee = (sender === 0 ? 0 : Math.round(amount * 0.01));
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

    const data = {
      id: newTxId,
      sender,
      receiver,
      amount,
      fee,
      type: (type || 'transfer'),
      timestamp: currentDate.getTime(),
    };
    const jsonData = JSON.stringify(data, null, 2);

    try {
      // save tx
      await writeFile(filePath, jsonData);
      // update sender cached balance
      if (sender > 0) {
        this.balances[sender] = (currentBalance - total);
      }
      // update receiver cached balance
      this.balances[receiver] = (this.balances[receiver] || 0) + amount;
      // increase tx count
      this.length += 1;

      console.log(
        `#${newTxId}: ${amount} sent from ${sender} to ${receiver} with ${fee} fee`
      );
    } catch (err) {
      console.error('Error writing to file:', err);
    }
  }

  async startHistory(count = 10)
  {
    for (let i = 1; i <= count; i++) {
      await this.generateDummyTransaction('reward');
    }

    await this.updateBalances();
  }

  async fillHistory(count = 1)
  {
    for (let i = 1; i <= count; i++) {
      await this.generateDummyTransaction('transfer');
    }

    await this.updateBalances();
  }

  async generateDummyTransaction(type)
  {
    const sender = (type == 'reward' ? 0 : this.getRandomSender());
    const receiver = this.getRandomReceiver();
    const amount = (type == 'reward' ? this.rewardAmount : this.getRandomAmount());
    await this.createTransaction(sender, receiver, amount, type);
  }

  async sendRewards(customRewardAmount)
  {
    const accounts = Object.keys(this.balances) || [];
    if (accounts.length === 0) {
      return;
    }

    for (let accountId of accounts) {
      await this.createTransaction(0, accountId, (customRewardAmount || this.rewardAmount), 'reward');
    }

    this.updateBalances();
  }

  getRandomSender() {
    return Math.floor(Math.random() * 10) + 1;
  }

  getRandomReceiver() {
    return Math.floor(Math.random() * 10) + 1;
  }

  getRandomAmount() {
    return Math.floor(Math.random() * 10) + 1;
  }

  async calculateBalances(fullScan = false) {
    if (this.length === 0) {
      return;
    }

    const files = await readdir(this.dataPath);

    if (fullScan) {
      // get tx files
      const txFiles = files.filter(file => file.startsWith('tx_'));
      for (let file of txFiles) {
        const filePath = `${this.dataPath}/${file}`;
        const fileContent = await readFile(filePath, 'utf8');
        if (fileContent.length === 0) {
          return;
        }

        try {
          const tx = JSON.parse(fileContent);
          // console.log('tx', tx);
          // TODO: check if all required keys exists
          if (this.balances[tx.sender] === undefined && tx.sender > 0) {
            this.balances[tx.sender] = 0;
          }
          if (this.balances[tx.receiver] === undefined) {
            this.balances[tx.receiver] = 0;
          }
          // update sender balance
          if (tx.sender > 0) {
            this.balances[tx.sender] -= (tx.amount + tx.fee);
          }
          // update receiver balance
          this.balances[tx.receiver] += tx.amount;
        } catch (err) {
          console.error(`Error parsing JSON from file ${filePath}:`, err);
        }
      }
    } else {
      const accountFiles = files.filter(file => file.startsWith('account_'));
      for (let file of accountFiles) {
        const filePath = `${this.dataPath}/${file}`;
        const fileContent = await readFile(filePath, 'utf8');
        if (fileContent.length === 0) {
          return;
        }

        try {
          const account = JSON.parse(fileContent);
          this.balances[account.id] = (account.balance || 0);
        } catch (err) {
          console.error(`Error parsing JSON from file ${filePath}:`, err);
        }
      }
    }
  }

  async updateBalances()
  {
    const accounts = Object.keys(this.balances) || [];
    if (accounts.length === 0) {
      return;
    }

    for (let accountId of accounts) {
      try {
        await writeFile(`${this.dataPath}/account_${accountId}.json`, JSON.stringify({
          id: accountId,
          balance: this.balances[accountId],
          index: this.length,
        }, null, 2));
      } catch (err) {
        console.error(`Failed to update account ${accountId} data:`, err);
      }
    }

    this.wasUpdated = true;
  }

  printChainLength() {
    console.log(this.length);
  }

  async printAccountsBalances() {
    if (this.oldLength !== this.length && !this.wasUpdated || !this.wasUpdated) {
      await this.updateBalances();
    }
    console.log(this.balances);
  }
}

export default Chain;
