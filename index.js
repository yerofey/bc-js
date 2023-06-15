import { options } from './src/options.js';
import Chain from './src/chain.js';

const main = async () => {
  const chain = new Chain(true);
  await chain.init(options);
};
main();
