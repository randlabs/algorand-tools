# Algorand Tools

A set of useful apps and snippets to handle Algorand transactions. The package can be used as a library for other applications or as a standalone set of utilities.

# Installation

To install the library, use the following command:
```sh
$ npm install algorand-tools
```

# Usage

## As a library

Import the library in your application by adding the following command:

```javascript
const algotools = require('algorand-tools');
```

## Applications

### build.js

Creates Algorand unsigned transaction.

```sh
$ node apps/build.js parameters [options]
```

#### Parameters:

* `--output {FILENAME}` : Transaction file to create.
* `--from {ADDRESS}` : Sender address.
* `--to {ADDRESS}` : Receiver address.
* `--amount {NUMBER}` : Amount to send in microalgos.
* `--fee {NUMBER}` : Fees to pay (the value is multiplied by the transaction size unless `--fixed-fee` is specified).
* `--first-round  [+]{NUMBER}` : First round where the transaction should be sent. Use +NUMBER to calculate the round based on the network's current round.

##### Options:

* `--note {BASE64-STRING}` : Note to add.
* `--last-round last-round [+]{NUMBER}` : Last round where the transaction should be sent. Defaults to 1000 after first round. Use +NUMBER to calculate the round based on the network's current round.
* `--close  {ADDRESS}` : Close address. Remaining account funds will be transferred to this address.
* `--genesis-hash  {BASE64-STRING}` : Network's genesis hash. Retrieved from network if not specified.
* `--genesis-id {STRING}` : Network's genesis ID. Retrieved from network if not stated.
* `--multisig-threshold {NUMBER}` : Required signatures for a multsig account template.
* `--multisig-addresses {ADDRESS[,ADDRESS...]}` : A comma separated list of addresses that make up the multisig account template.
* `--fixed-fee` : Sets the fee as a fixed value (does not multiply fee by the size of the transaction).
* `--node-url http://address:port` : Node's url if an access to the network is required. If not specified the `ALGOTOOLS_NODE_URL` environment variable is used.
* `--node-api-token {TOKEN}` : Node's api token if an access to network is required. If not specified the `ALGOTOOLS_NODE_API_TOKEN` environment variable is used.

## sign.js

Signs a set of transactions.

```sh
$ node apps/sign.js parameters [options]
```

#### Parameters:
* `--input {FILENAME}` : File with transactions to sign.
* `--output {FILENAME}` : Output file to create with signed transactions.
* `--mnemonic "{MNEMONIC}"` : Signer's mnemonic. Enclose the 25-word passphrase in quotes.

##### Options:
* `--multisig-threshold {NUMBER}` : Required signatures for a multsig account.
* `--multisig-addresses {ADDRESS[,ADDRESS...]}` : A comma separated list of addresses that make up the multisig account. Required only for the first signature.
* `--remove-existing` : Remove any previously existing signature from the transaction.

## dump.js 

Show details about transactions stored in a file.

```sh
$ node apps/dump.js parameters
```

#### Parameters:

* `--input {FILENAME}` : File with transactions to show.
* `--from {NUMBER}` : First transaction index. Starts at 1.
* `--to {NUMBER}` : Last transaction index.
* `--index {NUMBER}` : Dumps a single transaction located at the specified index.

## generate_address.js

Generates standard or multisig accounts.

```sh
$ node apps/generate_address.js single-account-parameters
```

```sh
$ node apps/generate_address.js --multisig multisig-account-parameters
```

#### Single account parameters:

* `--count {NUMBER}` : Number of addresses to generate.

#### Multisig account parameters:

* `--size {NUMBER}` : Amount of addresses envolved in the multisig account.
* `--req {NUMBER}` : Required amount signatures to validate a multisig transaction.

## merge.js 

Merges transactions of one or more files and, optionally, combines signatures.

```sh
$ node apps/merge.js parameters
```

#### Parameters:

* `--source {FILENAME} or {FOLDERNAME}` : Folder and/or file with transactions to merge. Wildcards accepted on filename.
* `--output {FILENAME}` : File to store the merged transactions.
* `--merge-signatures` : Merge signatures if two or more transactions matches. If this flag is not set, transactions are just concatenated.

## raw_signer.js

Signs raw data or file or verifies if the signature is correct.

```sh
$ node apps/raw_signer.js sign-parameters
```

```sh
$ node apps/raw_signer.js --verify verify-parameters
```

#### Sign parameters:

* `--data {TEXT}` : Sign the passed data. Cannot be used with '--filename'.
* `--filename {FILENAME}` : File to sign. Cannot be used with '--data'.
* `--output {FILENAME}` : Signature file to generate.
* `--mnemonic "{MNEMONIC}"` : Signer's mnemonic. Enclose the 25-word passphrase in quotes.

#### Verify parameters:

* `--data {TEXT}` : Verify the passed data. Cannot be used with '--filename'.
* `--filename {FILENAME}` : File to verify. Cannot be used with '--data'.
* `--signature {FILENAME}` : Signature file to validate.
* `--address {ADDRESS}` : Address of signer.

## send.js

Sends a set of transactions to the network.

```sh
$ node apps/send.js parameters
```

#### Parameters

* `--input {FILENAME}` : File with transactions to send.
* `--wait` : Wait for the network's current round to match transactions' first round if required.
