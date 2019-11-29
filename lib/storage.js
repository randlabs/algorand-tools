const fs = require('fs');
const msgpack = require('msgpack-lite');
const tx = require('./tx');

//------------------------------------------------------------------------------

/**
 * Return transactions saved in a file
 *
 * @param {String} filename Filename of txs
 * @returns {Array} Array of Algorand Transaction Objects
 */

async function loadTransactionsFromFile(filename) {
	let txs = [];

	if (typeof filename !== 'string' || filename.length == 0) {
		throw new Error('Invalid filename (tx-storage).');
	}

	//create decoder stream
	let decodeStream = msgpack.createDecodeStream();
	decodeStream.on('data', (_tx) => {
		txs.push(_tx);
	});

	//NOTE: The decoder does not accept partial reads
	let buffer = fs.readFileSync(filename);
	decodeStream.write(buffer);
	decodeStream.end();

	await new Promise((resolve, reject) => {
		decodeStream.once('end', () => {
			resolve(txs);
		}).once('error', reject);
	});

	return txs;
}

/**
 * Save transactions in a file
 *
 * @param {String} filename Filename of txs
 * @param {Array} Array of Algorand Transaction Objects
 */

async function saveTransactionsToFile(filename, txs) {
	if (typeof filename !== 'string' || filename.length == 0) {
		throw new Error('Invalid filename (tx-storage).');
	}
	if (!Array.isArray(txs)) {
		throw new Error('Invalid transactions (tx-storage).');
	}
	for (let _tx of txs) {
		if (!tx.isValid(_tx)) {
			throw new Error('Invalid transactions (tx-storage).');
		}
	}

	let outputStream = fs.createWriteStream(filename);
	let outputEncoderStream = msgpack.createEncodeStream();
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
