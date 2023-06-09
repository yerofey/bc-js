import Chain from './src/chain.js';

const main = async () => {
  const chain = new Chain();
  await chain.init();
  await chain.append(1);
  // await chain.sendRewards(333);
  await chain.updateFiles();
  await chain.printAccountsBalances();
  chain.printChainData();
};
main();
