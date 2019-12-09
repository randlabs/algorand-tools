require('babel-polyfill');
const LedgerHQ_TransportNodeHid = require('@ledgerhq/hw-transport-node-hid');
const Queue = require('promise-queue');
const addresses = require('../addresses');

//------------------------------------------------------------------------------

const SUBPACKET_LENGTH = 254;

const CLA = 0x80;

const INS_GET_PUBLIC_KEY = 0x03;
const INS_SIGN_MSGPACK = 0x08;

const P1_FIRST = 0x00;
const P1_MORE = 0x80;
const P2_LAST = 0x00;
const P2_MORE = 0x80;

const STATUS_OK = 0x90;
const STATUS_APP_NOT_LOADED = 0x6E;
const STATUS_DEVICE_LOCKED = 0x0468;
const STATUS_OPERATION_CANCELED = 0x8569;

//------------------------------------------------------------------------------

class LedgerHQ {
	constructor() {
		this.transport = null;
		this.commandQueue = new Queue(1, Infinity);
	}

	async getAddress() {
		await openLedger(this);

		try {
			const publicKey = await queueCommand(this, INS_GET_PUBLIC_KEY, 0, 0);
			return addresses.encode(publicKey);
		}
		catch (err) {
			this.transport = null;
			throw err;
		}
	}

	async signRawTransaction(rawTx) {
		if (!rawTx || rawTx.length === 0) {
			throw new Error('Invalid transaction.');
		}

		await openLedger(this);

		try {
			let ofs = 0;
			let p1 = P1_FIRST;
			while (ofs + SUBPACKET_LENGTH < rawTx.length) {
				await queueCommand(this, INS_SIGN_MSGPACK, p1, P2_MORE, rawTx.slice(ofs, SUBPACKET_LENGTH));
				ofs += SUBPACKET_LENGTH;
				p1 = P1_MORE;
			}

			let signature = await queueCommand(this, INS_SIGN_MSGPACK, p1, P2_LAST, rawTx.slice(ofs, rawTx.length - ofs));
			return signature;
		}
		catch (err) {
			this.transport = null;
			throw err;
		}
	}
}

async function openLedger(_this) {
	if (!_this.transport) {
		_this.transport = await LedgerHQ_TransportNodeHid.default.open('');
	}
}

async function sendToLedger(transport, buffer) {
	const data = await transport.exchange(buffer);
	if (data.length < 2) {
		throw new Error('Invalid response [' + data + ']');
	}
	const status = data.slice(data.length - 2, data.length).readUInt16LE();
	if (status != STATUS_OK) {
		if (status == STATUS_APP_NOT_LOADED) {
			throw new Error('The Algorand application is not loaded.');
		}
		if (status == STATUS_OPERATION_CANCELED) {
			throw new Error('The operation was canceled.');
		}
		if (status == STATUS_DEVICE_LOCKED) {
			throw new Error('Device is locked.');
		}
		throw new Error('Invalid response status [0x' + status.toString(16) + ']');
	}
	return data.slice(0, data.length - 2);
}

function queueCommand(_this, ins, p1, p2, data) {
	const command = [];

	if (!data) {
		data = Buffer.alloc(0);
	}
	else if (Array.isArray(data)) {
		data = Buffer.from(data);
	}

	command.push(Buffer.from([ CLA, ins, p1, p2 ]));

	if (data.byteLength === 0) {
		command.push(Buffer.from([ 0 ]));
	}
	else if (data.byteLength <= 255) {
		command.push(Buffer.from([ data.byteLength ]));
		command.push(Buffer.from(data));
	}
	else {
		throw new Error("Data too long");
	}

	const _command = Buffer.concat(command);

	return new Promise((resolve, reject) => {
		const _that = _this;
		_this.commandQueue.add(() => {
			return sendToLedger(_that.transport, _command);
		}).then((result) => {
			resolve(result);
		}).catch((err) => {
			reject(err);
		});
	});
}

module.exports = {
	LedgerHQ
};
