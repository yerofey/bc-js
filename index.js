import {
  options,
  zeroOptions,
} from './src/options.js';
import Chain from './src/chain.js';

const main = async () => {
  const chain = new Chain();
  await chain.init(options.scan);
  // send rewards
  if (options.airdrop || options.reward) {
    await chain.sendRewards(options.airdrop);
  }
  // create custom transfer
  if (options.transfer) {
    await chain.createTransfer(options.transfer);
  }
  // create random transfer or multiple transfers
  if (zeroOptions) {
    await chain.append(options.count || 1);
  }
  await chain.updateFiles();
  await chain.printAccountsBalances();
  chain.printChainData();
};
main();
