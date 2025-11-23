### Pyth Feed

https://insights.pyth.network/price-feeds/Crypto.SHIB%2FUSD/publishers (wrong)
https://docs.pyth.network/price-feeds/core/price-feeds/price-feed-ids

### Install workflow dependencies:

npm install -g bun
bun install --cwd ./my-onchain-data
cre workflow simulate my-onchain-data
cre workflow deploy my-onchain-data

bun install --cwd ./my-workflow
cre workflow simulate my-workflow
cre workflow simulate my-workflow --broadcast

--

### Counter
```bash
source .env && rm -rf cache out && forge build && forge script --chain 84532 script/Counter.s.sol:CounterScript --rpc-url https://sepolia.base.org --broadcast --verify -vvvv --private-key ${PRIVATE_KEY}
```
