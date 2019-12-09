const algosdk = require('algosdk');
const algosdk_txn_builder = require('algosdk/src/transaction');
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
 * Creates a payment transaction
 *
 * @param {Object} options Parameters of Algorand Tx
 * @return {Object} Algorand Transaction Format
 */

async function createPaymentTransaction(options) {
	options = await validateCommonTxOptions(options);

	if (typeof options.to === 'undefined' && typeof options.close === 'string') {
		options.to = options.close;
	}

	options.to = validateAddress(options.to, false, 'Invalid receiver address.');

	options.amount = validateUint(options.amount, false, 'Invalid amount.');

	options.close = validateAddress(options.close, true, 'Invalid close address.');

	let tx_params = buildTxParamsBase(options, 'pay');
	tx_params.to = options.to;
	tx_params.amount = options.amount;
	if (options.close !== null) {
		tx_params.closeRemainderTo = options.close;
	}

	return buildTx(tx_params);
}

/**
 * Creates a keyreg transaction
 *
 * @param {Object} options Parameters of Algorand Tx
 * @return {Object} Algorand Transaction Format
 */

async function createKeyregTransaction(options) {
	options = await validateCommonTxOptions(options);

	options.vote_key = validateBuffer(options.vote_key, true, true, 'Invalid vote key.');
	options.selection_key = validateBuffer(options.selection_key, true, true, 'Invalid selection key.');
	options.vote_first = validateUint(options.vote_first, true, 'Invalid vote first round.');
	options.vote_last = validateUint(options.vote_last, true, 'Invalid vote last round.');
	options.vote_key_dilution = validateUint(options.vote_key_dilution, true, 'Invalid vote key dilution.');

	if (options.vote_key !== null || options.selection_key !== null || options.vote_first !== null || options.vote_last !== null ||
			options.vote_key_dilution !== null) {
		if (options.vote_key === null) {
			throw new Error('Missing vote key.');
		}
		if (options.selection_key === null) {
			throw new Error('Missing selection key.');
		}
		if (options.vote_first === null) {
			throw new Error('Missing vote first round.');
		}
		if (options.vote_last === null) {
			throw new Error('Missing vote last round.');
		}
		if (options.vote_key_dilution === null) {
			throw new Error('Missing vote key dislution.');
		}
	}

	let tx_params = buildTxParamsBase(options, 'keyreg');
	tx_params.voteKey = (options.vote_key !== null) ? options.vote_key : (new Uint8Array(32));
	tx_params.selectionKey = (options.selection_key !== null) ? options.selection_key : (new Uint8Array(32));
	tx_params.voteFirst = (options.vote_first !== null) ? options.vote_first : 1;
	tx_params.voteLast = (options.vote_last !== null) ? options.vote_last : 1;
	tx_params.voteKeyDilution = (options.vote_key_dilution !== null) ? options.vote_key_dilution : (new Uint8Array(32));

	return buildTx(tx_params);
}

/**
 * Creates an asset creation transaction
 *
 * @param {Object} options Parameters of Algorand Tx
 * @return {Object} Algorand Transaction Format
 */

async function createAssetCreationTransaction(options) {
	options = await validateCommonTxOptions(options);

	options.asset_manager = validateAddress(options.asset_manager, true, 'Invalid asset manager address.');
	options.asset_reserve = validateAddress(options.asset_reserve, true, 'Invalid asset reserve address.');
	options.asset_freeze = validateAddress(options.asset_freeze, true, 'Invalid asset freeze address.');
	options.asset_clawback = validateAddress(options.asset_clawback, true, 'Invalid asset clawback address.');

	options.asset_metahash_data = validateBuffer(options.asset_metahash_data, true, false, 'Invalid asset metahash data.');

	if (typeof options.asset_name !== 'string' || options.asset_name.length == 0) {
		throw new Error('Invalid asset name.');
	}

	if (typeof options.asset_unit_name !== 'string' || options.asset_unit_name.length == 0) {
		throw new Error('Invalid asset unit name.');
	}

	options.asset_total = validateUint(options.asset_total, false, 'Invalid asset total.');

	options.asset_default_frozen = validateBoolean(options.asset_default_frozen, false, 'Invalid asset default frozen state.');

	if (options.asset_url) {
		if (typeof options.asset_url !== 'string') {
			throw new Error('Invalid asset URL.');
		}
	}

	let tx_params = buildTxParamsBase(options, 'acfg');
	if (options.asset_manager !== null) {
		tx_params.assetManager = options.asset_manager;
	}
	if (options.asset_reserve !== null) {
		tx_params.assetReserve = options.asset_reserve;
	}
	if (options.asset_freeze !== null) {
		tx_params.assetFreeze = options.asset_freeze;
	}
	if (options.asset_clawback !== null) {
		tx_params.assetClawback = options.asset_clawback;
	}
	if (options.asset_metahash_data !== null) {
		tx_params.assetMetadataHash = options.asset_metahash_data;
	}
	tx_params.assetName = options.asset_name;
	tx_params.assetUnitName = options.asset_unit_name;
	tx_params.assetTotal = options.asset_total;
	tx_params.assetDefaultFrozen = options.asset_default_frozen;
	if (options.asset_url) {
		tx_params.assetURL = options.asset_url;
	}

	return buildTx(tx_params);
}

/**
 * Creates an asset destruction transaction
 *
 * @param {Object} options Parameters of Algorand Tx
 * @return {Object} Algorand Transaction Format
 */

async function createAssetDestructionTransaction(options) {
	options = await validateCommonTxOptions(options);

	options.asset_index = validateUint(options.asset_index, false, 'Invalid asset index.');

	let tx_params = buildTxParamsBase(options, 'acfg');
	tx_params.assetIndex = options.asset_index;

	return buildTx(tx_params);
}

/**
 * Creates an asset configuration transaction
 *
 * @param {Object} options Parameters of Algorand Tx
 * @return {Object} Algorand Transaction Format
 */

async function createAssetConfigurationTransaction(options) {
	options = await validateCommonTxOptions(options);

	options.asset_index = validateUint(options.asset_index, false, 'Invalid asset index.');

	options.asset_manager = validateAddress(options.asset_manager, true, 'Invalid asset manager address.');
	options.asset_reserve = validateAddress(options.asset_reserve, true, 'Invalid asset reserve address.');
	options.asset_freeze = validateAddress(options.asset_freeze, true, 'Invalid asset freeze address.');
	options.asset_clawback = validateAddress(options.asset_clawback, true, 'Invalid asset clawback address.');

	if (options.asset_manager === null && options.asset_reserve === null && options.asset_freeze === null &&
			options.asset_clawback === null) {
		throw new Error('No asset addresses to reconfigure.');
	}

	let tx_params = buildTxParamsBase(options, 'acfg');
	tx_params.assetIndex = options.asset_index;
	if (options.asset_manager !== null) {
		tx_params.assetManager = options.asset_manager;
	}
	if (options.asset_reserve !== null) {
		tx_params.assetReserve = options.asset_reserve;
	}
	if (options.asset_freeze !== null) {
		tx_params.assetFreeze = options.asset_freeze;
	}
	if (options.asset_clawback !== null) {
		tx_params.assetClawback = options.asset_clawback;
	}
	if (options.asset_metahash_data !== null) {
		tx_params.assetMetadataHash = options.asset_metahash_data;
	}

	return buildTx(tx_params);
}

/**
 * Creates an asset freeze transaction
 *
 * @param {Object} options Parameters of Algorand Tx
 * @return {Object} Algorand Transaction Format
 */

async function createAssetFreezeTransaction(options) {
	options = await validateCommonTxOptions(options);

	options.asset_index = validateUint(options.asset_index, false, 'Invalid asset index.');

	options.freeze_account = validateAddress(options.freeze_account, false, 'Invalid asset freeze account address.');

	options.freeze_state = validateBoolean(options.freeze_state, false, 'Invalid asset freeze state.');

	let tx_params = buildTxParamsBase(options, 'afrz');
	tx_params.assetIndex = options.asset_index;
	tx_params.freezeAccount = options.freeze_account;
	tx_params.freezeState = options.freeze_state;

	return buildTx(tx_params);
}

/**
 * Creates an asset transfer transaction
 *
 * @param {Object} options Parameters of Algorand Tx
 * @return {Object} Algorand Transaction Format
 */

async function createAssetTransferTransaction(options) {
	options = await validateCommonTxOptions(options);

	options.asset_index = validateUint(options.asset_index, false, 'Invalid asset index.');

	options.to = validateAddress(options.to, false, 'Invalid receiver address.');

	options.amount = validateUint(options.amount, false, 'Invalid amount.');

	options.close = validateAddress(options.close, true, 'Invalid close address.');

	options.revocation_address = validateAddress(options.revocation_address, true, 'Invalid revocation address.');

	let tx_params = buildTxParamsBase(options, 'axfer');
	tx_params.assetIndex = options.asset_index;
	tx_params.to = options.to;
	tx_params.amount = options.amount;
	if (options.close !== null) {
		tx_params.closeRemainderTo = options.close;
	}
	if (options.revocation_address !== null) {
		tx_params.assetRevocationTarget = options.revocation_address;
	}

	return buildTx(tx_params);
}

/**
 * Save transactions in a file
 *
 * @param {Object} tx Signed Algorand Tx
 * @return {String} Tx Hash
 */

function getTxID(tx) {
	if (!(utils.isObject(tx) && utils.isObject(tx.txn))) {
		throw new Error('Invalid tx.');
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
		throw new Error('Invalid tx.');
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
		throw new Error('Invalid tx.');
	}

	let params = {};
	if (typeof tx.txn.type === 'string') {
		params.type = tx.txn.type;

		//common parameters
		params.fee = (typeof tx.txn.fee != 'undefined') ? tx.txn.fee : 0;
		params.first_round = (typeof tx.txn.fv != 'undefined') ? tx.txn.fv : 0;
		params.last_round = (typeof tx.txn.lv != 'undefined') ? tx.txn.lv : 0;
		if (typeof tx.txn.snd != 'undefined') {
			params.from = addresses.encode(tx.txn.snd);
		}
		if (typeof tx.txn.note != 'undefined') {
			params.note = tx.txn.note.toString('base64');
		}
		if (typeof tx.txn.lx != 'undefined') {
			params.lease = tx.txn.lx.toString('base64');
		}
		if (typeof tx.txn.gen != 'undefined') {
			params.genesis_id = tx.txn.gen;
		}
		if (typeof tx.txn.gh != 'undefined') {
			params.genesis_hash = tx.txn.gh.toString('base64');
		}
		if (typeof tx.txn.group != 'undefined') {
			params.group = tx.txn.gh.toString('base64');
		}

		if (tx.txn.type === 'pay') {
			if (typeof tx.txn.rcv != 'undefined') {
				params.to = addresses.encode(tx.txn.rcv);
			}
			params.amount = (typeof tx.txn.amt != 'undefined') ? tx.txn.amt : 0;
			if (typeof tx.txn.close != 'undefined') {
				params.close = addresses.encode(tx.txn.close);
			}
		}
		else if (tx.txn.type == 'keyreg') {
			if (typeof tx.txn.votekey != 'undefined') {
				params.vote_key = tx.txn.votekey.toString('base64');
			}
			if (typeof tx.txn.selkey != 'undefined') {
				params.selection_key = tx.txn.selkey.toString('base64');
			}
			params.vote_first = (typeof tx.txn.votefst != 'undefined') ? tx.txn.votefst : 0;
			params.vote_last = (typeof tx.txn.votelst != 'undefined') ? tx.txn.votelst : 0;
			params.vote_key_dilution = (typeof tx.txn.votekd != 'undefined') ? tx.txn.votekd : 0;
		}
		else if (tx.txn.type == 'acfg') {
			params.asset_index = (typeof tx.txn.caid != 'undefined') ? tx.txn.caid : 0;
			if (typeof tx.txn.apar != 'undefined') {
				if (typeof tx.txn.apar.m != 'undefined') {
					params.asset_manager = tx.txn.apar.m.toString('base64');
				}
				if (typeof tx.txn.apar.r != 'undefined') {
					params.asset_reserve = tx.txn.apar.m.toString('base64');
				}
				if (typeof tx.txn.apar.f != 'undefined') {
					params.asset_freeze = tx.txn.apar.m.toString('base64');
				}
				if (typeof tx.txn.apar.c != 'undefined') {
					params.asset_clawback = tx.txn.apar.m.toString('base64');
				}
				if (typeof tx.txn.apar.am != 'undefined') {
					params.asset_metahash_data = tx.txn.apar.m.toString('base64');
				}
				if (typeof tx.txn.apar.t != 'undefined') {
					params.asset_total = tx.txn.apar.t;
				}
				if (typeof tx.txn.apar.an == 'string') {
					params.asset_name = tx.txn.apar.an;
				}
				if (typeof tx.txn.apar.un == 'string') {
					params.asset_unit_name = tx.txn.apar.un;
				}
				if (typeof tx.txn.apar.au == 'string') {
					params.asset_url = tx.txn.apar.un;
				}
				if (typeof tx.txn.apar.df != 'undefined') {
					params.asset_default_frozen = Boolean(tx.txn.apar.df);
				}
			}
		}
		else if (tx.txn.type == 'afrz') {
			params.asset_index = (typeof tx.txn.faid != 'undefined') ? tx.txn.faid : 0;
			params.freeze_account = addresses.encode(tx.txn.fadd);
			params.freeze_state = (typeof tx.txn.afrz != 'undefined') ? Boolean(tx.txn.afrz) : false;
		}
		else if (tx.txn.type == 'axfer') {
			params.asset_index = (typeof tx.txn.xaid != 'undefined') ? tx.txn.xaid : 0;
			if (typeof tx.txn.arcv != 'undefined') {
				params.to = addresses.encode(tx.txn.arcv);
			}
			params.amount = (typeof tx.txn.aamt != 'undefined') ? tx.txn.aamt : 0;
			if (typeof tx.txn.aclose != 'undefined') {
				params.close = addresses.encode(tx.txn.aclose);
			}
			if (typeof tx.txn.asnd != 'undefined') {
				params.revocation_address = addresses.encode(tx.txn.asnd);
			}
		}
	}
	return params;
}

module.exports = {
	isValid,
	createPaymentTransaction,
	createKeyregTransaction,
	createAssetCreationTransaction,
	createAssetDestructionTransaction,
	createAssetConfigurationTransaction,
	createAssetFreezeTransaction,
	createAssetTransferTransaction,
	getTxID,
	getBytes,
	getInfo
};

//------------------------------------------------------------------------------

async function validateCommonTxOptions(options) {
	if (!utils.isObject(options)) {
		throw new Error('Invalid options.');
	}
	options = { ...options };

	options.from = validateAddress(options.from, false, 'Invalid sender address.');

	if ((!utils.isInteger(options.fee)) || options.fee < 1) {
		throw new Error('Invalid fee.');
	}

	options.fixed_fee = validateBoolean(options.fixed_fee, true, 'Invalid fixed fee.');
	if (options.fixed_fee === null) {
		options.fixed_fee = false;
	}

	if ((!utils.isInteger(options.first_round)) || options.first_round < 1) {
		throw new Error('Invalid first round.');
	}

	if (typeof options.last_round === 'undefined' || options.last_round === null) {
		options.last_round = options.first_round + 1000;
	}
	else if ((!utils.isInteger(options.last_round)) || options.last_round < options.first_round) {
		throw new Error('Invalid last round.');
	}

	options.genesis_hash = validateBuffer(options.genesis_hash, true, true, 'Invalid genesis hash.');

	if (options.genesis_id) {
		if (typeof options.genesis_id !== 'string' || options.genesis_id.length == 0) {
			throw new Error('Invalid genesis id.');
		}
	}

	options.note = validateBuffer(options.note, true, false, 'Invalid note.');
	if (!options.note) {
		options.note = new Uint8Array(0);
	}

	options.lease = validateBuffer(options.lease, true, false, 'Invalid lease.');
	if (!options.lease) {
		delete options.lease;
	}

	if (!(options.genesis_hash && options.genesis_id)) {
		let res = await node.getGenesisInfo(options.node_url, options.node_api_token);

		if (!options.genesis_hash) {
			options.genesis_hash = res.hash;
		}
		if (!options.genesis_id) {
			options.genesis_id = res.id;
		}
	}

	options.group = validateBuffer(options.group, true, false, 'Invalid group.');

	return options;
}

function validateAddress(address, canBeNull, invalidMessage) {
	if (!address) {
		if (!canBeNull) {
			throw new Error(invalidMessage);
		}
		return null;
	}
	if (typeof address !== 'string') {
		throw new Error(invalidMessage);
	}
	address = address.toUpperCase();
	if (!addresses.isValid(address)) {
		throw new Error(invalidMessage);
	}
	return address;
}

function validateUint(value, canBeNull, invalidMessage) {
	if (typeof value === 'undefined' || value === null) {
		if (!canBeNull) {
			throw new Error(invalidMessage);
		}
		return null;
	}
	if ((!utils.isInteger(value)) || value < 0) {
		throw new Error(invalidMessage);
	}
	return value;
}

function validateBuffer(value, canBeNull, asBase64, invalidMessage) {
	if (typeof value === 'undefined' || value === null) {
		if (!canBeNull) {
			throw new Error(invalidMessage);
		}
		return null;
	}
	if (value.constructor === Uint8Array) {
		if (asBase64) {
			value = Buffer.from(value).toString('base64');
		}
	}
	else if (Buffer.isBuffer(value)) {
		if (asBase64) {
			value = value.toString('base64');
		}
		else {
			value = new Uint8Array(value);
		}
	}
	else {
		let buf;

		try {
			buf = Buffer.from(value, 'base64');
		}
		catch (err) {
			throw new Error(invalidMessage);
		}
		if (!asBase64) {
			value = new Uint8Array(buf);
		}
	}
	if (value.length == 0) {
		throw new Error(invalidMessage);
	}
	return value;
}

function validateBoolean(value, canBeNull, invalidMessage) {
	if (typeof value === 'undefined' || value === null) {
		if (!canBeNull) {
			throw new Error(invalidMessage);
		}
		return null;
	}
	if (typeof value !== 'number' && typeof value !== 'boolean') {
		throw new Error(invalidMessage);
	}
	return Boolean(value);
}

function buildTxParamsBase(options, type) {
	return {
		type,
		from: options.from,
		fee: options.fee,
		flatFee: options.fixed_fee,
		firstRound: options.first_round,
		lastRound: options.last_round,
		genesisHash: options.genesis_hash,
		genesisID: options.genesis_id,
		note: options.note,
		lease: options.lease
	};
}

function buildTx(tx_params) {
	const algoTxn = new algosdk_txn_builder.Transaction(tx_params);
	const tx = {
		txn: algoTxn.get_obj_for_encoding()
	};
	if (tx_params.group) {
		tx.txn.group = tx_params.group;
	}
	return tx;
}
