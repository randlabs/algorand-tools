const fs = require('fs');
const msgpack = require("msgpack-lite");
const tx = require('./tx');

//------------------------------------------------------------------------------

async function loadTransactionsFromFile(filename) {
	let txs = [];

	if (typeof filename !== 'string' || filename.length == 0) {
		throw new Error("Invalid filename (tx-storage).");
	}

	//create decoder stream
	let decodeStream = msgpack.createDecodeStream();
	decodeStream.on("data", (_tx) => {
		txs.push(_tx);
	});

	//NOTE: The decoder does not accept partial reads
	let buffer = fs.readFileSync(filename);
	decodeStream.write(buffer);

	/*
	let fd = fs.openSync(filename, 'r');
	let buffer = new Uint8Array(8192);
	let bytesRead;
	do {
		bytesRead = fs.readSync(fd, buffer, 0, 8192);
		if (bytesRead == 8192) {
			decodeStream.write(buffer);
		}
		else if (bytesRead > 0) {
			decodeStream.write(buffer.slice(0, bytesRead));
		}
	}
	while (bytesRead == 8192);
	fs.closeSync(fd);
	*/

	decodeStream.end();

	await new Promise((resolve, reject) => {
		decodeStream.once('end', () => {
			resolve(txs);
		}).once('error', reject);
	});

	return txs;
}

async function saveTransactionsToFile(filename, txs) {
	if (typeof filename !== 'string' || filename.length == 0) {
		throw new Error("Invalid filename (tx-storage).");
	}
	if (!Array.isArray(txs)) {
		throw new Error("Invalid transactions (tx-storage).");
	}
	for (let _tx of txs) {
		if (!tx.isValid(_tx)) {
			throw new Error("Invalid transactions (tx-storage).");
		}
	}

	let outputStream = fs.createWriteStream(filename);
	let outputEncoderStream = msgpack.createEncodeStream({
		codec: msgpack.createCodec({ //to match algosdk encoding options
			canonical: true
		})
	});
	outputEncoderStream.pipe(outputStream);

	for (let _tx of txs) {
		outputEncoderStream.write(_tx);
	}
	outputEncoderStream.end();

	await new Promise((resolve, reject) => {
		outputStream.once('finish', () => {
			resolve();
		}).once('error', reject);
	});
}

module.exports = {
	loadTransactionsFromFile,
	saveTransactionsToFile
};
