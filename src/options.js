import { program } from 'commander';

program.option(
  '-a, --airdrop <amount>',
  'Send custom amount to everyone'
);
program.option(
  '-b, --balances',
  'List accounts with balances'
);
program.option(
  '-c, --count <count>',
  'New transactions count'
);
program.option(
  '-e, --erase',
  'Erase chain db data'
);
program.option(
  '-r, --reward',
  'Send 1000 to everyone'
);
program.option(
  '-s, --scan',
  'Run full transactions scan'
);
program.option(
  '-t, --transfer <data>',
  'Create transfer transaction (format: from,to,amount)'
);
program.parse();

export const options = program.opts();
export const zeroOptions = Object.keys(options).length === 0;
