const algosdk = require('algosdk');
const algosdk_txn_builder = require("algosdk/src/transaction");
const addresses = require('./addresses');
const node = require('./helpers/node');
const utils = require('./helpers/utils');

//------------------------------------------------------------------------------

/**
 * Check if a transaction has a valid format
 * 
 * @param {String} tx
 * @return {Boolean}
 */

function isValid(tx) {
	return (utils.isObject(tx) && utils.isObject(tx.txn));
}

/**
 * Save transactions in a file
 * 
 * @param {Object} options Parameters of Algorand Tx
 * @return {Object} Algorand Transaction Format
 */

async function createPaymentTransaction(options) {
	if (!utils.isObject(options)) {
		throw new Error("Invalid options (tx).");
	}
	let _options = { ...options };

	if (typeof _options.from !== 'string') {
		throw new Error("Invalid sender address (tx).");
	}
	_options.from = _options.from.toUpperCase();
	if (!addresses.isValid(_options.from)) {
		throw new Error("Invalid sender address (tx).");
	}

	if (typeof _options.to === 'undefined' && typeof _options.close === 'string') {
		_options.to = _options.close;
	}
	if (typeof _options.to !== 'string') {
		throw new Error("Invalid receiver address (tx).");
	}
	_options.to = _options.to.toUpperCase();
	if (!addresses.isValid(_options.to)) {
		throw new Error("Invalid receiver address (tx).");
	}

	if ((!utils.isInteger(_options.amount)) || _options.amount < 0) {
		throw new Error("Invalid amount (tx).");
	}

	if ((!utils.isInteger(_options.fee)) || _options.fee < 1) {
		throw new Error("Invalid fee (tx).");
	}

	if ((!utils.isInteger(_options.first_round)) || _options.first_round < 1) {
		throw new Error("Invalid first round (tx).");
	}

	if (typeof _options.last_round === 'undefined') {
		_options.last_round = _options.first_round + 1000;
	}
	else if ((!utils.isInteger(_options.last_round)) || _options.last_round < _options.first_round) {
		throw new Error("Invalid last round (tx).");
	}

	if (typeof _options.close !== 'undefined') {
		if (typeof _options.close !== 'string') {
			throw new Error("Invalid close address (tx).");
		}
		_options.close = _options.to.toUpperCase();
		if (!addresses.isValid(_options.close)) {
			throw new Error("Invalid close address (tx).");
		}
	}

	if (typeof _options.genesis_hash !== 'undefined') {
		if (_options.genesis_hash.constructor === Uint8Array) {
			_options.genesis_hash = Buffer.from(_options.genesis_hash).toString('base64');
		}
		else if (Buffer.isBuffer(_options.genesis_hash)) {
			_options.genesis_hash = _options.genesis_hash.toString('base64');
		}
		else {
			let buf;

			try {
				buf = Buffer.from(_options.genesis_hash, 'base64');
			}
			catch (err) {
				throw new Error("Invalid genesis hash (tx).");
			}
			if (buf.length == 0) {
				throw new Error("Invalid genesis hash (tx).");
			}
		}
		if (_options.genesis_hash.length == 0) {
			throw new Error("Invalid genesis hash (tx).");
		}
	}

	if (typeof _options.genesis_id !== 'undefined') {
		if (typeof _options.genesis_id !== 'string' || _options.genesis_id.length == 0) {
			throw new Error("Invalid close address (tx).");
		}
	}

	if (typeof _options.note !== 'undefined') {
		try {
			if (Buffer.isBuffer(_options.note)) {
				_options.note = new Uint8Array(_options.note);
			}
			else if (_options.note.constructor !== Uint8Array) {
				_options.note = new Uint8Array(Buffer.from(_options.note, 'base64'));
			}
		}
		catch (err) {
			throw new Error("Invalid note (tx).");
		}
	}
	else {
		_options.note = new Uint8Array(0);
	}

	if (typeof _options.genesis_hash === 'undefined' || typeof _options.genesis_id === 'undefined') {
		let res = await node.getGenesisInfo(_options.node_url, _options.node_api_token);

		if (typeof _options.genesis_hash === 'undefined') {
			_options.genesis_hash = res.hash;
		}
		if (typeof _options.genesis_id === 'undefined') {
			_options.genesis_id = res.id;
		}
	}

	let tx_params = {
		from: _options.from,
		to: _options.to,
		amount: _options.amount,
		fee: (_options.feeIsFixed) ? 1 : _options.fee, //fees will be overridden below
		firstRound: _options.first_round,
		lastRound: _options.last_round,
		genesisHash: _options.genesis_hash,
		genesisID: _options.genesis_id,
		note: _options.note
	};
	if (_options.close !== null) {
		tx_params.closeRemainderTo = _options.close;
	}

	let algoTxn = new algosdk_txn_builder.Transaction(tx_params);

	let tx = {
		txn: algoTxn.get_obj_for_encoding()
	};

	if (_options.feeIsFixed) {
		tx.txn.fee = _options.fee; //override TX's fee
	}

	return tx;
}

/**
 * Save transactions in a file
 * 
 * @param {Object} tx Signed Algorand Tx
 * @return {String} Tx Hash
 */

function getTxID(tx) {
	if (!(utils.isObject(tx) && utils.isObject(tx.txn))) {
		throw new Error("Invalid tx (tx).");
	}
	let algoTxn = algosdk_txn_builder.Transaction.from_obj_for_encoding(tx.txn);
	return algoTxn.txID().toString();
}

/**
 * Get encoded tx bytes
 * 
 * @param {Object} tx Signed Algorand Tx
 * @return {UInt8Array} Encoded Tx
 */

function getBytes(tx) {
	if (!(utils.isObject(tx) && utils.isObject(tx.txn))) {
		throw new Error("Invalid tx (tx).");
	}
	return algosdk.encodeObj(tx);
}

/**
 * Get tx options
 * 
 * @param {Object} tx Signed Algorand Tx
 * @return {Object}
 */

function getInfo(tx) {
	if (!(utils.isObject(tx) && utils.isObject(tx.txn))) {
		throw new Error("Invalid tx (tx).");
	}

	let params = {};
	if (typeof tx.txn.type != "undefined") {
		params.type = tx.txn.type;
	}
	params.amount = (typeof tx.txn.amt != "undefined") ? tx.txn.amt : 0;
	params.fee = (typeof tx.txn.fee != "undefined") ? tx.txn.fee : 0;
	params.first_round = (typeof tx.txn.fv != "undefined") ? tx.txn.fv : 0;
	params.last_round = (typeof tx.txn.lv != "undefined") ? tx.txn.lv : 0;
	if (typeof tx.txn.snd != "undefined" && Buffer.isBuffer(tx.txn.snd)) {
		params.from = addresses.encode(tx.txn.snd);
	}
	if (typeof tx.txn.rcv != "undefined" && Buffer.isBuffer(tx.txn.rcv)) {
		params.to = addresses.encode(tx.txn.rcv);
	}
	if (typeof tx.txn.note != "undefined" && Buffer.isBuffer(tx.txn.note)) {
		params.note = tx.txn.note.toString('base64');
	}
	if (typeof tx.txn.gen != "undefined") {
		params.genesis_id = tx.txn.gen;
	}
	if (typeof tx.txn.gh != "undefined" && Buffer.isBuffer(tx.txn.snd)) {
		params.genesis_hash = tx.txn.gh.toString('base64');
	}
	if (typeof tx.txn.close != "undefined" && Buffer.isBuffer(tx.txn.close)) {
		params.close = addresses.encode(tx.txn.close);
	}
	return params;
}

module.exports = {
	isValid,
	createPaymentTransaction,
	getTxID,
	getBytes,
	getInfo
};
