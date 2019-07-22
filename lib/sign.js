const algosdk = require('algosdk');
const algosdk_transaction = require("algosdk/src/transaction");
const algosdk_enc_address = require("algosdk/src/encoding/address");
const nacl = require('tweetnacl');
const addresses = require('./addresses');
const mnemonics = require('./mnemonics');
const utils = require('./helpers/utils');

//------------------------------------------------------------------------------

const MULTISIG_VERSION = 1;

//------------------------------------------------------------------------------

/**
 * Takes a txobject and add signature if the parameter mnemonic matchs
 * 
 * @param {Object} _tx Transaction from Algorand
 * @param {string} mnemonic String of 25 algorand words
 * @param {Number} multisig_threshold Number of required signatures
 * @param {Array} multisig_addresses Addresses which form the multi sig address.
 */

async function addSignature(_tx, mnemonic_or_signer, multisig_threshold /*= undefined*/, multisig_addresses /*= undefined*/) {
	if (!(utils.isObject(_tx) && utils.isObject(_tx.txn))) {
		throw new Error("Invalid tx (tx-sign).");
	}
	if (typeof _tx.sig != 'undefined') {
		throw new Error("Transaction already signed with a non-multisig signature.");
	}

	if (!(typeof _tx.txn.snd != "undefined" && Buffer.isBuffer(_tx.txn.snd))) {
		throw new Error("Unable to sign transaction with no sender.");
	}
	let sender = addresses.encode(_tx.txn.snd);

	let signer_info;
	if (typeof mnemonic_or_signer === 'string') {
		signer_info = mnemonics.decode(mnemonic_or_signer);
		if (!signer_info) {
			throw new Error("Invalid mnemonic (tx-sign).");
		}

		let algo_tx = algosdk_transaction.Transaction.from_obj_for_encoding(_tx.txn);
		signer_info.signature = algo_tx.rawSignTxn(signer_info.secret_key);
	}
	else if (typeof mnemonic_or_signer === 'object') {
		let address = await mnemonic_or_signer.getAddress();
		let signature = await mnemonic_or_signer.sign(_tx);
		signer_info = {
			address,
			signature
		};
	}
	else {
		throw new Error("Invalid menomic or signer.");
	}

	//if no threshold was passeg, check if the tx has a multisig template
	if (!multisig_threshold) {
		if (utils.isObject(_tx.msig)) {
			if (utils.isInteger(_tx.msig.thr)) {
				multisig_threshold = _tx.msig.thr;
			}
		}
	}

	//if no threshold, assume a simple signature
	if (!multisig_threshold) {
		if (typeof _tx.msig != 'undefined') {
			throw new Error("Transaction signed with a multisig signature.");
		}

		if (signer_info.address != sender) {
			throw new Error("Mnemonic does not match sender address.");
		}

		_tx.sig = signer_info.signature;
	}
	else {
		let new_msig = {
			v: MULTISIG_VERSION,
			thr: multisig_threshold,
			subsig: []
		};
		let prev_signatures = new Map();

		//validate some parameters
		if ((!utils.isInteger(multisig_threshold)) || multisig_threshold < 1) {
			throw new Error("Invalid threshold value (tx-sign).");
		}

		//if the _tx has a valid multi-signature object, then we are adding
		if (utils.isObject(_tx.msig)) {
			//override version if present
			if (typeof _tx.msig.v === 'number') {
				new_msig.v = _tx.msig.v;
			}
			//check threshold
			if (typeof _tx.msig.thr === 'number' && _tx.msig.thr != multisig_threshold) {
				throw new Error("Multisignature threshold mismatch (tx-sign).");
			}
			if (Array.isArray(_tx.msig.subsig)) {
				if (!multisig_addresses) {
					multisig_addresses = [];
					for (let idx = 0; idx < _tx.msig.subsig.length; idx++) {
						if (typeof _tx.msig.subsig[idx].pk != "undefined") {
							let address = addresses.encode(_tx.msig.subsig[idx].pk);

							multisig_addresses.push(address);

							if (typeof _tx.msig.subsig[idx].s != "undefined" && Buffer.isBuffer(_tx.msig.subsig[idx].s)) {
								prev_signatures.set(address, _tx.msig.subsig[idx].s);
							}
						}
					}

					multisig_addresses = getMultiSignatureSigners(_tx);
				}
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
			let pk;

			try {
				pk = Buffer.from(addresses.decode(addr));
			}
			catch (err) {
				throw new Error("Invalid address in multisig addresses (tx-sign).");
			}
			let sig = {
				pk
			};
			if (addr == signer_info.address) {
				sig.s = signer_info.signature;
			}
			else {
				let signature = prev_signatures.get(addr);
				if (signature) {
					sig.s = signature;
				}
			}

			new_msig.subsig.push(sig);
		}

		_tx.msig = new_msig;
	}
}

/**
 * Merge signatures from a same tx
 * 
 * @param {Array} txs Array of multisig txs with same parameters but with different sigs
 *
 */

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
		let algo_tx = algosdk_transaction.Transaction.from_obj_for_encoding(txs[i].txn);
		tx_ids.push(algo_tx.txID().toString());
	}

	for (i = 0; i < txs.length - 1; i++) {
		j = i + 1;
		while (j < txs.length) {
			if (tx_ids[i] == tx_ids[j]) {
				if (typeof txs[i].msig !== 'undefined') {
					if (typeof txs[j].msig !== 'undefined') {
						//both items have multi-signatures, merge them

						//in order to use algosdk code, we must encode txs, merge and decode them
						let encoded_tx_i = algosdk.encodeObj(txs[i]);
						let encoded_tx_j = algosdk.encodeObj(txs[j]);

						let encoded_merged = algosdk.mergeMultisigTransactions([
							encoded_tx_i,
							encoded_tx_j
						]);

						txs[i] = algosdk.decodeObj(encoded_merged);
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
						let encoded_tx_i = algosdk.encodeObj(txs[i]);
						let encoded_tx_j = algosdk.encodeObj(txs[j]);

						if (encoded_tx_i.length == encoded_tx_j.length) {
							for (let idx = 0; idx < encoded_tx_i.length; idx++) {
								if (encoded_tx_i[idx] != encoded_tx_j[idx]) {
									throw new Error("Unable to merge different non-multisig signed transactions.");
								}
							}

							//if we reach here, then both txs are the same
						}
						else {
							throw new Error("Unable to merge different non-multisig signed transactions.");
						}
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
				txs.splice(j, 1);
				tx_ids.splice(j, 1);
			}
			else {
				j += 1;
			}
		}
	}
}

/**
 * Remove all signatures from a given tx
 * 
 * @param {Object} _tx Algorand Transaction object
 */

function removeAllSignatures(_tx) {
	if (!(utils.isObject(_tx) && utils.isObject(_tx.txn))) {
		throw new Error("Invalid tx (tx-sign).");
	}

	if (_tx.sig) {
		Reflect.deleteProperty(_tx, 'sig');
	}
	if (_tx.msig) {
		Reflect.deleteProperty(_tx, 'msig');
	}
}

/**
 * For a given tx it adds the sig or msig template.
 * 
 * @param {Object} _tx Algorand Transaction format
 * @param {Number} multisig_threshold Required signatures
 * @param {Array} multisig_addresses Array of public keys
 */

function addSignatureTemplate(_tx, multisig_threshold /*= undefined*/, multisig_addresses /*= undefined*/) {
	if (!(utils.isObject(_tx) && utils.isObject(_tx.txn))) {
		throw new Error("Invalid tx (tx-sign).");
	}

	if (_tx.sig || _tx.msig) {
		throw new Error("Signature already present (tx-sign).");
	}

	if (!Array.isArray(multisig_addresses)) {
		throw new Error("Invalid multisig addresses (tx-sign).");
	}
	for (let addr of multisig_addresses) {
		if (!addresses.isValid(addr)) {
			throw new Error("Invalid multisig addresses (tx-sign).");
		}
	}
	if ((!utils.isInteger(multisig_threshold)) || multisig_threshold < 1 || multisig_threshold > multisig_addresses.length) {
		throw new Error("Invalid multisig threshold (tx-sign).");
	}

	const preimg_params = {
		version: 1,
		threshold: multisig_threshold,
		pks: multisig_addresses.map((addr) => {
			return addresses.decode(addr);
		})
	};
	let mergedAccountPk = algosdk_enc_address.fromMultisigPreImg(preimg_params);
	if (addresses.encode(mergedAccountPk) !== addresses.encode(_tx.txn.snd)) {
		throw new Error("Addresses does not belong to the sender or they are unordered (tx-sign).");
	}

	_tx.msig = {
		v: 1,
		thr: multisig_threshold,
		subsig: []
	};
	for (let pk of preimg_params.pks) {
		_tx.msig.subsig.push({
			pk: Buffer.from(pk)
		});
	}
}

/**
 * Returns an account from a mnemonic
 * 
 * @param {Object} _tx Algorand Transaction
 * @returns {Array} Array of signers public keys
 */

function getMultiSignatureSigners(_tx) {
	let _addresses = [];

	if (!(utils.isObject(_tx) && utils.isObject(_tx.txn))) {
		throw new Error("Invalid tx (tx-sign).");
	}

	if (_tx.msig) {
		if (_tx.msig.subsig) {
			for (let idx = 0; idx < _tx.msig.subsig.length; idx++) {
				if (typeof _tx.msig.subsig[idx].pk != "undefined") {
					_addresses.push(addresses.encode(_tx.msig.subsig[idx].pk));
				}
			}
		}
	}
	return _addresses;
}

/**
 * Verify if a signature is valid
 * 
 * @param {Object} _tx Algorand Transaction
 * @param {Object} signature specific address to verify
 * @param {Object} address Signer address
 * @returns {Boolean} Array of signers public keys
 */

function verifySignature(_tx, signature, address) {
	if (!(utils.isObject(_tx) && utils.isObject(_tx.txn))) {
		return false;
	}

	let algo_tx;
	try {
		algo_tx = algosdk_transaction.Transaction.from_obj_for_encoding(_tx.txn);
	}
	catch (err) {
		return false;
	}
	return rawVerify(algo_tx.bytesToSign(), signature, address);
}

/**
 * Sign any kind of data
 * 
 * @param {Uint8Array} data Data to sign
 * @param {String} mnemonic 25 words from Algorand
 * @returns {Buffer} Signed data
 */

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

/**
 * Verify signed data
 * 
 * @param {Uint8Array} data Data to sign
 * @param {String} signature Signed data
 * @param {String} address Algorand Address
 * @returns {Boolean}
 */

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
	addSignatureTemplate,
	verifySignature,
	rawSign,
	rawVerify
};
