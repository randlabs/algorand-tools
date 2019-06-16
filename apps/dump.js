const cmdline = require('node-cmdline-parser');
const tools = require('../index');

//------------------------------------------------------------------------------

main().then(() => {
	process.exit(0);
}).catch((err) => {
	if (err.stack)
		console.error(err.stack);
	else
		console.error(err);
	process.exit(1);
});

async function main() {
	if (cmdline.keyexists("help")) {
		console.log("Use: dump.js parameters");
		console.log("");
		console.log("Where 'parameters' are:");
		console.log("  --input filename.tx : Transaction input for taking transactions.");
		console.log("  --from {NUMBER}     : First transaction index. Starts at 1.");
		console.log("  --to {NUMBER}       : Last transaction index.");
		console.log("  --index {NUMBER}    : Single transaction index to dump.");
		return;
	}

	let options = await parseCmdLineParams();

	let txs = await tools.storage.loadTransactionsFromFile(options.input);
	if (options.first > txs.length) {
		throw new Error("NOTHING TO DUMP!!!");
	}
	if ((!options.last) || options.last > txs.length) {
		options.last = txs.length;
	}

	for (let idx = options.first; idx <= options.last; idx++) {
		print_tx(txs[idx - 1], idx);
	}
}

function parseCmdLineParams() {
	return new Promise((resolve, reject) => {
		let input = cmdline.get('input');
		if (input === null) {
			reject(new Error("ERROR: Missing value in '--input' parameter."));
			return;
		}
		try {
			input = tools.utils.normalizeFilename(input);
		}
		catch (err) {
			reject(err);
			return;
		}
		if (input.length == 0) {
			reject(new Error("ERROR: Invalid value in '--input' parameter."));
			return;
		}

		let first = cmdline.get('index');
		let last = null;
		if (first !== null) {
			first = parseInt(first, 10);
			if (isNaN(first) || first < 1) {
				reject(new Error("ERROR: Invalid value in '--first' parameter. It must be greater or equal to 1."));
				return;
			}
			last = first;
		}
		else {
			first = cmdline.get('from');
			if (first !== null) {
				first = parseInt(first, 10);
				if (isNaN(first) || first < 1) {
					reject(new Error("ERROR: Invalid value in '--first' parameter. It must be greater or equal to 1."));
					return;
				}
			}
			else {
				first = 1;
			}

			last = cmdline.get('to');
			if (last !== null) {
				last = parseInt(last, 10);
				if (isNaN(last) || last < first) {
					reject(new Error("ERROR: Invalid value in '--to' parameter. It must be greater or equal to 'from'."));
					return;
				}
			}
		}

		resolve({
			input,
			first,
			last
		});
	});
}

function print_tx(_tx, tx_idx) {
	let sender;

	if (typeof _tx.txn !== 'object') {
		console.log("Unknown object stored");
		return;
	}

	console.log("Algorand transaction #" + tx_idx.toString() + ":");
	if (typeof _tx.txn.type != "undefined") {
		console.log("  Type:", _tx.txn.type);
	}
	if (typeof _tx.txn.amt != "undefined") {
		console.log("  Amount:", _tx.txn.amt);
	}
	if (typeof _tx.txn.fee != "undefined") {
		console.log("  Fee:", _tx.txn.fee);
	}
	if (typeof _tx.txn.fv != "undefined") {
		console.log("  First round:", _tx.txn.fv);
	}
	if (typeof _tx.txn.lv != "undefined") {
		console.log("  Last round:", _tx.txn.lv);
	}
	if (typeof _tx.txn.snd != "undefined" && Buffer.isBuffer(_tx.txn.snd)) {
		sender = tools.addresses.encode(_tx.txn.snd);
		console.log("  Sender address:", sender);
	}
	if (typeof _tx.txn.rcv != "undefined" && Buffer.isBuffer(_tx.txn.rcv)) {
		console.log("  Receiver address:", tools.addresses.encode(_tx.txn.rcv));
	}
	if (typeof _tx.txn.note != "undefined" && Buffer.isBuffer(_tx.txn.note)) {
		console.log("  Note:", tools.utils.buffer2string(_tx.txn.note, 32));
	}
	if (typeof _tx.txn.gen != "undefined") {
		console.log("  Genesis ID:", _tx.txn.gen);
	}
	if (typeof _tx.txn.gh != "undefined" && Buffer.isBuffer(_tx.txn.snd)) {
		console.log("  Genesis hash:", _tx.txn.gh.toString('base64'));
	}

	if (typeof _tx.sig != "undefined" && Buffer.isBuffer(_tx.sig)) {
		let valid_msg = tools.sign.verifySignature(_tx, _tx.sig, sender) ? "(VALID)" : "(INVALID!!!!)";

		console.log("  Algorand Signature:");
		console.log("    Sign:", tools.utils.buffer2string(_tx.sig, 64), valid_msg);
	}

	if (typeof _tx.msig != "undefined") {
		console.log("  Algorand Multi-Signature:");

		if (typeof _tx.msig.v != "undefined") {
			console.log("    Version:", _tx.msig.v);
		}
		if (typeof _tx.msig.thr != "undefined") {
			console.log("    Threshold:", _tx.msig.thr);
		}

		if (typeof _tx.msig.subsig != "undefined") {
			console.log("    Signatures:");
			for (let idx = 0; idx < _tx.msig.subsig.length; idx++) {
				let address;

				console.log("      Signer #" + (idx + 1).toString() + ":");
				if (typeof _tx.msig.subsig[idx].pk != "undefined") {
					address = tools.addresses.encode(_tx.msig.subsig[idx].pk);
					console.log("        Address:", address);
				}
				if (typeof _tx.msig.subsig[idx].s != "undefined" && Buffer.isBuffer(_tx.msig.subsig[idx].s)) {
					let valid_msg = tools.sign.verifySignature(_tx, _tx.msig.subsig[idx].s, address) ? "(VALID)" : "(INVALID!!!!)";

					console.log("        Sign:", tools.utils.buffer2string(_tx.msig.subsig[idx].s, 64), valid_msg);
				}
			}
		}

		if (sender && typeof _tx.msig.thr != "undefined" && typeof _tx.msig.subsig != "undefined") {
			let addresses = [];

			for (let idx = 0; idx < _tx.msig.subsig.length; idx++) {
				if (typeof _tx.msig.subsig[idx].pk != "undefined") {
					addresses.push(tools.addresses.encode(_tx.msig.subsig[idx].pk));
				}
			}
			if (sender == tools.addresses.generateMultisig(addresses, _tx.msig.thr)) {
				console.log("    Signers MATCH sender");
			}
			else {
				console.log("    WARNING: Signers seems to mismatch sender");
			}
		}
		else {
			console.log("    Unable to verify if signers belong to sender");
		}
	}
}
