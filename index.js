import { options, zeroOptions } from './src/options.js';
import Chain from './src/chain.js';

const main = async () => {
  const chain = new Chain(true);
  await chain.init(options.scan);

  // regular start
  if (!options.balances && !options.erase) {
    // send rewards
    if (options.airdrop || options.reward) {
      await chain.sendRewards(options.airdrop);
    }
    // create custom transfer
    if (options.transfer) {
      await chain.createTransfer(options.transfer);
    }
    // create random transfer or multiple transfers
    if (options.count || zeroOptions) {
      await chain.append(options.count || 1);
    }
    // save
    await chain.saveData();
  }

  // clear chain data
  if (options.erase) {
    await chain.eraseData();
  }

  await chain.printAccountsBalances();
  chain.printChainData();
};
main();
