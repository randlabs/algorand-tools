const path = require('path');
const algosdk = require('algosdk');
let algosdk_basepath = require.resolve('algosdk');
algosdk_basepath = algosdk_basepath.substring(0, algosdk_basepath.lastIndexOf(path.sep));
const algosdk_txn_builder = require(algosdk_basepath + "/src/transaction");
const algosdk_encoding = require(algosdk_basepath + "/src/encoding/encoding");
const nacl = require('tweetnacl');
const tx = require('./tx');
const addresses = require('./addresses');
const mnemonics = require('./mnemonics');
const utils = require('./helpers/utils');

//------------------------------------------------------------------------------

function addSignature(_tx, mnemonic, multisig_threshold /*= undefined*/, multisig_addresses /*= undefined*/) {
	const version = 1;

	if (!(utils.isObject(_tx) && utils.isObject(_tx.txn))) {
		throw new Error("Invalid _tx (_tx-sign).");
	}
	if (typeof _tx.sig != 'undefined') {
		throw new Error("Transaction already signed with a non-multisig signature.");
	}

	if (!(typeof _tx.txn.snd != "undefined" && Buffer.isBuffer(_tx.txn.snd))) {
		throw new Error("Unable to sign transaction with no sender.");
	}
	let sender = addresses.encode(_tx.txn.snd);

	let pair = mnemonics.decode(mnemonic);
	if (!pair) {
		throw new Error("Invalid mnemonic (_tx-sign).");
	}

	if (!multisig_threshold) {
		if (typeof _tx.msig != 'undefined') {
			throw new Error("Transaction signed with a multisig signature.");
		}

		if (pair.address != sender) {
			throw new Error("Mnemonic does not match sender address.");
		}

		let algo_tx = algosdk_txn_builder.Transaction.from_obj_for_encoding(_tx.txn);
		_tx.sig = algo_tx.rawSignTxn(pair.secret_key);
	}
	else {
		let to_append_blob = null;
		let new_tx;

		//validate some parameters
		if ((!utils.isInteger(multisig_threshold)) || multisig_threshold < 1) {
			throw new Error("Invalid threshold value (_tx-sign).");
		}

		//if the _tx has a valid multi-signature object, then we are adding
		if (utils.isObject(_tx.msig)) {
			if (Array.isArray(_tx.msig.subsig)) {
				if (!multisig_addresses) {
					multisig_addresses = getMultiSignatureSigners(_tx);
				}

				to_append_blob = new Uint8Array(algosdk_encoding.encode(_tx));
			}
			else {
				Reflect.deleteProperty(_tx, 'msig');
			}
		}

		//if we reach here, we assume we are the first signer
		if ((!Array.isArray(multisig_addresses)) || multisig_addresses.length == 0) {
			throw new Error("Addresses belonging to the multisig account are required.");
		}
		if (multisig_threshold > multisig_addresses.length) {
			throw new Error("Threshold value is greater than the number of accounts.");
		}
		for (let addr of multisig_addresses) {
			if (!addresses.isValid(addr)) {
				throw new Error("Invalid address in multisig addresses (_tx-sign).");
			}
		}

		const sign_params = {
			version,
			threshold: multisig_threshold,
			addrs: multisig_addresses
		};
		if (to_append_blob) {
			new_tx = algosdk.appendSignMultisigTransaction(to_append_blob, sign_params, pair.secret_key);
		}
		else {
			let tx_info = tx.getInfo(_tx);

			let tx_params = {
				from: tx_info.from,
				to: tx_info.to,
				amount: tx_info.amount,
				fee: tx_info.fee,
				firstRound: tx_info.first_round,
				lastRound: tx_info.last_round,
				genesisHash: tx_info.genesis_hash,
				genesisID: tx_info.genesis_id,
				note: tx_info.note
			};
			new_tx = algosdk.signMultisigTransaction(tx_params, sign_params, pair.secret_key);
		}

		new_tx = algosdk_encoding.decode(new_tx.blob);

		_tx.txn = new_tx.txn;
		_tx.msig = new_tx.msig;
	}
}

function mergeSignatures(txs) {
	let i, j;
	let tx_ids = [];

	if (!Array.isArray(txs)) {
		throw new Error("Invalid transactions (_tx-sign).");
	}
	if (txs.length < 2) {
		return;
	}

	for (i = 0; i < txs.length; i++) {
		let algo_tx = algosdk_txn_builder.Transaction.from_obj_for_encoding(txs[i].txn);
		tx_ids.push(algo_tx.txID());
	}

	for (i = 0; i < txs.length; i++) {
		j = i + 1;
		while (j < txs.length) {
			if (tx_ids[i] == tx_ids[j]) {
				if (typeof txs[i].msig !== 'undefined') {
					if (typeof txs[j].msig !== 'undefined') {
						//both items have multi-signatures, merge them

						//in order to use algosdk code, we must encode txs, merge and decode them
						let encoded_tx_i = new Uint8Array(algosdk_encoding.encode(txs[i]));
						let encoded_tx_j = new Uint8Array(algosdk_encoding.encode(txs[j]));

						let encoded_merged = algosdk.mergeMultisigTransactions([
							encoded_tx_i,
							encoded_tx_j
						]);

						txs[i] = algosdk_encoding.decode(encoded_merged);
					}
					else if (typeof txs[j].sig !== 'undefined') {
						throw new Error("Unable to merge a non-multisig signed transaction with a multisig signed transaction.");
					}
					else {
						//leave 'i' as is
					}
				}
				else if (typeof txs[i].sig !== 'undefined') {
					if (typeof txs[j].msig !== 'undefined') {
						throw new Error("Unable to merge a non-multisig signed transaction with a multisig signed transaction.");
					}
					else if (typeof txs[j].sig !== 'undefined') {
						throw new Error("Unable to merge two non-multisig signed transactions.");
					}
					else {
						//leave 'i' as is
					}
				}
				else {
					//because 'i' does not have a signature, use 'j's
					if (typeof txs[j].msig !== 'undefined') {
						txs[i].msig = { ...txs[j].msig };
					}
					else if (typeof txs[j].sig !== 'undefined') {
						txs[i].sig = { ...txs[j].sig };
					}
				}
				//delete item from array
				txs = txs.splice(j, 1);
				tx_ids = tx_ids.splice(j, 1);
			}
			else {
				j += 1;
			}
		}
	}
}

function removeAllSignatures(_tx) {
	if (!(utils.isObject(_tx) && utils.isObject(_tx.txn))) {
		throw new Error("Invalid _tx (_tx-sign).");
	}

	if (_tx.sig) {
		Reflect.deleteProperty(_tx, 'sig');
	}
	if (_tx.msig) {
		Reflect.deleteProperty(_tx, 'msig');
	}
}

function getMultiSignatureSigners(_tx) {
	let _addresses = [];

	if (!(utils.isObject(_tx) && utils.isObject(_tx.txn))) {
		throw new Error("Invalid _tx (_tx-sign).");
	}

	if (_tx.msig) {
		if (_tx.msig.subsig) {
			for (let idx = 0; idx < _tx.msig.subsig.length; idx++) {
				if (typeof _tx.msig.subsig[idx].pk != "undefined") {
					_addresses.push(addresses.getEncoded(_tx.msig.subsig[idx].pk));
				}
			}
		}
	}
	return _addresses;
}

function verifySignature(_tx, signature, address) {
	if (!(utils.isObject(_tx) && utils.isObject(_tx.txn))) {
		return false;
	}

	let algo_tx;
	try {
		algo_tx = algosdk_txn_builder.Transaction.from_obj_for_encoding(_tx.txn);
	}
	catch (err) {
		return false;
	}
	return rawVerify(algo_tx.bytesToSign(), signature, address);
}

function rawSign(data, mnemonic) {
	let signature;

	if (!(data instanceof Uint8Array) || data.length == 0) {
		return null;
	}

	let pair = mnemonics.decode(mnemonic);
	if (!pair) {
		return null;
	}

	try {
		signature = nacl.sign.detached(data, pair.secret_key);
	}
	catch (err) {
		return null;
	}
	return signature;
}

function rawVerify(data, signature, address) {
	if (data instanceof Buffer) {
		data = new Uint8Array(data);
	}
	if (!(data instanceof Uint8Array) || data.length == 0) {
		return false;
	}
	if (signature instanceof Buffer) {
		signature = new Uint8Array(signature);
	}
	if (!(signature instanceof Uint8Array) || signature.length == 0) {
		return false;
	}
	if (!addresses.isValid(address)) {
		return false;
	}

	try {
		if (nacl.sign.detached.verify(data, signature, addresses.decode(address))) {
			return true;
		}
	}
	catch (err) {
		//keep ESLint happy
	}
	return false;
}

module.exports = {
	addSignature,
	mergeSignatures,
	removeAllSignatures,
	getMultiSignatureSigners,
	verifySignature,
	rawSign,
	rawVerify
};
