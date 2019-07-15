require("babel-polyfill");
const LedgerHQ_TransportNodeHid = require("@ledgerhq/hw-transport-node-hid");
//const LedgerHQ_Errors = require("@ledgerhq/errors");
const BN = require('bn.js');
const tx = require('../tx');
const addresses = require('../addresses');

const CLA = 0x80;
const INS_GET_PUBLIC_KEY = 0x03;
const INS_SIGN_PAYMENT_V2 = 0x04;
const INS_SIGN_KEYREG_V2 = 0x05;

const STATUS_OK = 0x90;
const STATUS_APP_NOT_LOADED = 0x6E;
const STATUS_DEVICE_LOCKED = 0x0468;
const STATUS_OPERATION_CANCELED = 0x8569;

//------------------------------------------------------------------------------

class LedgerHQ {
	constructor() {
		this.transport = null;
	}

	async getAddress() {
		if (!this.transport) {
			this.transport = await open_ledger();
		}
		const addr = await send_to_ledger(this.transport, Buffer.from([ CLA, INS_GET_PUBLIC_KEY ]));
		return addresses.encode(addr);
	}

	async sign(to_sign_tx) {
		let tx_info = tx.getInfo(to_sign_tx);
		let msg = [];

		if (tx_info.type === 'pay') {
			msg.push(Buffer.from([ CLA, INS_SIGN_PAYMENT_V2 ]));
		}
		else if (tx_info.type === 'keyreg') {
			msg.push(Buffer.from([ CLA, INS_SIGN_KEYREG_V2 ]));
		}
		else {
			throw new Error("Unknown transaction type " + tx_info.type);
		}
		msg.push(Buffer.from(addresses.decode(tx_info.from)));
		msg.push(uint64ToBuffer(tx_info.fee));
		msg.push(uint64ToBuffer(tx_info.first_round));
		msg.push(uint64ToBuffer(tx_info.last_round));
		msg.push(padBuffer(tx_info.genesis_id, 32));
		msg.push(Buffer.from(tx_info.genesis_hash, 'base64'));
		if (tx_info.type === 'pay') {
			msg.push(Buffer.from(addresses.decode(tx_info.to)));
			msg.push(uint64ToBuffer(tx_info.amount));
			if (typeof tx_info.close === 'string') {
				msg.push(Buffer.from(addresses.decode(tx_info.close)));
			}
			else {
				msg.push(Buffer.alloc(32, 0));
			}
		}

		/*
		else if (txType === 'keyreg') {
			msg.push(padBuffer(txn["votekey"], 32)); //votepk
			msg.push(padBuffer(txn["selkey"], 32));  //vrfpk
		}
		*/

		const msg_to_sign = Buffer.concat(msg);

		if (!this.transport) {
			this.transport = await open_ledger();
		}
		const signature = await send_to_ledger(this.transport, msg_to_sign);

		return signature;
	}
}

async function open_ledger() {
	let transport = await LedgerHQ_TransportNodeHid.default.open("");
	return transport;
}

async function send_to_ledger(transport, val) {
	const data = await transport.exchange(val);
	if (data.length < 2) {
		throw new Error("Invalid response [" + data + "]");
	}
	const status = data.slice(data.length - 2, data.length).readUInt16LE();
	if (status != STATUS_OK) {
		if (status == STATUS_APP_NOT_LOADED) {
			throw new Error("The Algorand application is not loaded.");
		}
		if (status == STATUS_OPERATION_CANCELED) {
			throw new Error("The operation was canceled.");
		}
		if (status == STATUS_DEVICE_LOCKED) {
			throw new Error("Device is locked.");
		}
		throw new Error("Invalid response status [0x" + status.toString(16) + "]");
	}
	return data.slice(0, data.length - 2);
}

function padBuffer(str, size) {
	let ret = Buffer.alloc(size, 0);
	if (str) {
		if (str.length > size) {
			throw new Error("String too long (" + str.length + " > " + size + ")");
		}
		ret.write(str, 0);
	}
	return ret;
}

function uint64ToBuffer(value) {
	return (new BN(value)).toArrayLike(Buffer, 'le', 8);
}

module.exports = {
	LedgerHQ
};
