
import options from './src/options.js';
import Chain from './src/chain.js';

const main = async () => {
  const chain = new Chain();
  await chain.init(options.scan);
  if (options.airdrop || options.reward) {
    await chain.sendRewards(options.airdrop);
  } else {
    await chain.append(options.count || 1);
  }
  await chain.updateFiles();
  await chain.printAccountsBalances();
  chain.printChainData();
};
main();
