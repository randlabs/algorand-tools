# Algorand Tools
A set of useful apps and snippets to handle Algorand transactions.
# Installation

```sh
$ npm install algorand-tools
```
# Use
### build.js
algorand-tools has useful apps and snippets to handle Algorand Transactions.
Run with:
```sh
$ node apps/build.js parameters [options]
```
It generates an input file with an unsigned tx in Algorand format. Input parameters are the following:

#### Parameters

* `--output {FILENAME}`     : Transaction output filename

* `--from {ADDRESS}`         : Sender address

* `--to {ADDRESS}`          : Receiver address

* `--amount {NUMBER}`         : Amount to send in microalgos

* `--fee  {NUMBER}`            : Fees to pay (the value is multiplied by the tx size)

* `--first-round  [+]{NUMBER}` : First round to send transaction. Use +NUMBER to calculate the round based on the network's current round

##### Options

* `--note {BASE64-STRING}`                     : Not to add to transaction.

* `--last-round last-round [+]{NUMBER}`                    : First round to send transaction. Defaults to 1000 after first round. Use +NUMBER to calculate the round based on the network's current round

* `--close  {ADDRESS}`       : Close address

* `--genesis-hash  {BASE64-STRING}`              : Network's genesis hash. Retrieved from network if not passed

* `--genesis-id {STRING}`                       : Network's genesis ID. Retrieved from network if not passed

* `--multisig-threshold {NUMBER}`               : Required signatures for a multsig account template

* `--multisig-addresses {ADDRESS[,ADDRESS...]}` : A comma separated list of addresses that make up the multisig account template

* `--node-url http://address:port  {URL}`              : Node's url if
a access to network is required. If not specified the ALGOTOOLS_NODE_URL environment variable is used

* `--node-api-token {TOKEN}`                       : Node's api token if a access to network is required. If not specified the ALGOTOOLS_NODE_API_TOKEN environment variable is used

## dump.js 

It deletes specified transactions from a file of transactions.
Run with:
```sh
$ node apps/dump.js parameters
```
#### Parameters

* `--input {FILENAME}` : Transaction input for taking transactions.

* `--from {NUMBER}`     : First transaction index. Starts at 1.

* `--to {NUMBER}`       : Last transaction index.
 
* `--index {NUMBER}`    : Single transaction index to dump.
 
## generate_address.js

Generate an normal or multisig address.
For single signature address run with:
```sh
$ node apps/generate_address.js single-account-parameters
```
For multi signature address run with:
```sh
$ node apps/generate_address.js  --multisig multisig-account-parameters
```
#### Parameters

##### single-account-parameters

* `--count {NUMBER}` : Number of addresses to generate.

##### multisig-account-parameters are:

* `--size {NUMBER}` : Amount of addresses envolved in the multisig account.

* `--req {NUMBER}`  : Required amount signatures to validate a multisig transaction.

## merge.js 
Merge signatures and throws the multisig merged tx in a file.
Run with:
```sh
$ node apps/merge.js parameters
```
#### Parameters

* `--output {FILENAME}`         : File to store the merged transactions.

* `--source {FILENAME} or {FOLDERNAME}` : Folder and/or file with transactions to merge. Wildcards accepted on filename.

* `--merge-signatures {FLAG}`          : Merge signatures if two or more transactions match. If this flag is not specified, transactions are just concatenated.

## raw_signer.js 
It signs every type of data or validating a signed file to verify if the signature is correct.

Use next command as signer
```sh
$ node apps/raw_signer.js sign-parameters
```
or next for validating
```sh
$ node apps/raw_signer.js --verify verify-parameters
```
#### Parameters
* `--data {TEXT}`       : Sign/verify the passed data. Cannot be used with '--filename'.
* `--filename {FILENAME}` : File to sign/verify. Cannot be used with '--data'.
        
##### sign-parameters' are
* `--output {FILENAME}`   : Signature file to generate.

* `--mnemonic \"{MNEMONIC}\"` : Signer's mnemonic. (enclose the 25-word passphrase in quotes)

##### verify-parameters are:

* `--signature {FILENAME.sig}` : Signature file to validate.

* `--address {ADDRESS}`      : Address of signer.

## send.js
Send an transaction in a specific round.
Run with:
```sh
$ node apps/send.js parameters
```
#### Parameters

* `--input {FILENAME}` : Filename with transactions to send.

* `--wait {NUMBER}`              : Wait for the network's current round to match transactions' first round if required.

## sign.js

It returns a file of signed Transactions originated by other Transactions-input-file.
Run with:
```sh
$ node apps/sign.js parameters [options]
```
#### Parameters
* `--input {FILENAME}`     : Transaction(s) input filename.

* `--output {FILENAME}`    : Transaction(s) output filename.

* `--mnemonic \"{MNEMONIC}\"` : Signer's mnemonic. (enclose the 25-word passphrase in quotes)

##### And 'options' are:

* `--multisig-threshold {NUMBER}`               : Required signatures for a multsig account.

* `--multisig-addresses {ADDRESS[,ADDRESS...]}` : A comma separated list of addresses that make up the multisig account. Required only for the first signature.

* `--remove-existing   {FLAG}`                       : Removed any previously existing signature from the transaction.
