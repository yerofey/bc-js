import Chain from './src/chain.js';

const main = async () => {
  const chain = new Chain();
  await chain.init();
  chain.printChainLength();
  await chain.append(10, 1);
  // await chain.sendRewards(333);
  await chain.printAccountsBalances();
};
main();
