# bc-js

> Simple blockchain written in JavaScript to run on Node.js

## Install

```bash
# via NPM
$ npm i

# via PNPM
$ pnpm i

# via Yarn
$ yarn
```

## Run

```bash
# just show the chain data
$ node index.js

# create 10 transactions
$ node index.js -c 10

# create an airdrop of 1234 coins
$ node index.js -a 1234

# send rewards to everyone (1000 per account)
$ node index.js -r

# create new transaction
$ node index.js -t

# run full scan
$ node index.js -s

# erase chain data
$ node index.js -e
```

## Options

- `-c` or `--count`: Create that many random transactions
- `-a` or `--airdrop` with `<amount>`: Send this amount of coins to everyone
- `-r` or `--reward`: Send predefined reward amount to everyone (1,000 coins)
- `-s` or `--scan`: Run full chain scan to recalculate balances
- `-t` or `--transfer`: Create new coins transfer
- `-e` or `--erase`: Erase chain data completely
