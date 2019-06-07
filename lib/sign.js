const path = require('path');
const algosdk = require('algosdk');
let algosdk_basepath = require.resolve('algosdk');
algosdk_basepath = algosdk_basepath.substring(0, algosdk_basepath.lastIndexOf(path.sep));
const algosdk_txn_builder = require(algosdk_basepath + "/src/transaction");
const algosdk_encoding = require(algosdk_basepath + "/src/encoding/encoding");
const nacl = require('tweetnacl');
const addresses = require('./addresses');
const mnemonics = require('./mnemonics');
const utils = require('./helpers/utils');

//------------------------------------------------------------------------------

function addSignature(tx, mnemonic, multisig_threshold /*= undefined*/, multisig_addresses /*= undefined*/) {
	const version = 1;

	if (!(utils.isObject(tx) && utils.isObject(tx.txn))) {
		throw new Error("Invalid tx (tx-sign).");
	}
	if (typeof tx.sig != 'undefined') {
		throw new Error("Transaction signed with a non-multisig signature.");
	}

	let pair = mnemonics.decide(mnemonic);
	if (!pair) {
		throw new Error("Invalid mnemonic (tx-sign).");
	}

	if (!multisig_threshold) {
		if (typeof tx.msig != 'undefined') {
			throw new Error("Transaction signed with a multisig signature.");
		}

		let algo_tx = algosdk_txn_builder.Transaction.from_obj_for_encoding(tx.txn);
		tx.sig = algo_tx.rawSignTxn(pair.sk);
	}
	else {
		let to_append_blob = null;
		let new_tx;

		//validate some parameters
		if ((!utils.isInteger(multisig_threshold)) || multisig_threshold < 1) {
			throw new Error("Invalid threshold value (tx-sign).");
		}

		//if the tx has a valid multi-signature object, then we are adding
		if (utils.isObject(tx.msig)) {
			if (Array.isArray(tx.msig.subsig)) {
				if (!multisig_addresses) {
					multisig_addresses = getMultiSignatureSigners(tx);
				}

				to_append_blob = new Uint8Array(algosdk_encoding.encode(tx));
			}
			else {
				Reflect.deleteProperty(tx, 'msig');
			}
		}

		//if we reach here, we assume we are the first signer
		if ((!Array.isArray(multisig_addresses)) || multisig_addresses.length == 0) {
			throw new Error("Addresses belonging to the multisig account are required.");
		}
		if (multisig_threshold > multisig_addresses.length) {
			throw new Error("Threshold value is greater than the number of accounts.");
		}

		let publicKeys = [];
		for (let addr of multisig_addresses) {
			if (!addresses.isValid(addr)) {
				throw new Error("Invalid address in multisig addresses (tx-sign).");
			}
			publicKeys.push(addresses.decode(addr));
		}

		if (to_append_blob) {
			new_tx = algosdk.appendSignMultisigTransaction(to_append_blob, {
				version,
				multisig_threshold,
				publicKeys
			}, pair.sk);
		}
		else {
			new_tx = algosdk.signMultisigTransaction(tx.txn, {
				version,
				multisig_threshold,
				publicKeys
			}, pair.sk);
		}

		new_tx = algosdk_encoding.decode(new_tx.blob);

		tx.msig = new_tx.msig;
	}
}

function mergeSignatures(txs) {
	let i, j;
	let tx_ids = [];

	if (!Array.isArray(txs)) {
		throw new Error("Invalid transactions (tx-sign).");
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

function removeAllSignatures(tx) {
	if (!(utils.isObject(tx) && utils.isObject(tx.txn))) {
		throw new Error("Invalid tx (tx-sign).");
	}

	if (tx.sig) {
		Reflect.deleteProperty(tx, 'sig');
	}
	if (tx.msig) {
		Reflect.deleteProperty(tx, 'msig');
	}
}

function getMultiSignatureSigners(tx) {
	let _addresses = [];

	if (!(utils.isObject(tx) && utils.isObject(tx.txn))) {
		throw new Error("Invalid tx (tx-sign).");
	}

	if (tx.msig) {
		if (tx.msig.subsig) {
			for (let idx = 0; idx < tx.msig.subsig.length; idx++) {
				if (typeof tx.msig.subsig[idx].pk != "undefined") {
					_addresses.push(addresses.getEncoded(tx.msig.subsig[idx].pk));
				}
			}
		}
	}
	return _addresses;
}

function verifySignature(tx, signature, address) {
	if (!(utils.isObject(tx) && utils.isObject(tx.txn))) {
		return false;
	}

	let algo_tx;
	try {
		algo_tx = algosdk_txn_builder.Transaction.from_obj_for_encoding(tx.txn);
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
