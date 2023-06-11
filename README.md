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
# start
$ node index.js

# create 10 transactions
$ node index.js -c 10

# create an airdrop of 1234 coins
$ node index.js -a 1234

# send rewards to everyone
$ node index.js -r

# create a custom transaction (account 1 sends 5,000 coins to account 4)
$ node index.js -t 1,4,5000

# run full scan
$ node index.js -s
```

## Options

- `-c` or `--count`: Create that many random transactions
- `-a` or `--airdrop` with `<amount>`: Send this amount of coins to everyone
- `-r` or `--reward`: Send predefined reward amount to everyone (1,000 coins)
- `-s` or `--scan`: Run full chain scan to recalculate balances
- `-t` or `--transfer` with `<from,to,amount>`: Create a new transaction
