import { program } from 'commander';

program.option(
  '-c, --count <count>',
  'New transactions count'
);
program.option(
  '-a, --airdrop <amount>',
  'Send custom amount to everyone'
);
program.option(
  '-r, --reward',
  'Send 1000 to everyone'
);
program.option(
  '-s, --scan',
  'Run full transactions scan'
);
program.parse();

const options = program.opts();
export default options;
