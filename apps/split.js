const cmdline = require('node-cmdline-parser');
const path = require('path');
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

//------------------------------------------------------------------------------

async function main() {
	if (cmdline.keyexists("help")) {
		console.log("Use: split.js parameters");
		console.log("");
		console.log("Where 'parameters' are:");
		console.log("  --input {FILENAME}     : File with transactions to split.");
		console.log("  --by-count {NUMBER}    : Splits in files of 'count' transactions each.");
		console.log("  --by-quantity {NUMBER} : Splits all transactions in the specified 'quantity' of files.");
		console.log("  --by-sender            : Splits all transactions by sender address.");
		console.log("  --by-receiver          : Splits all transactions by receiver address.");
		return;
	}

	let options = await parseCmdLineParams();

	let path_comps = path.parse(options.input);

	let txs = await tools.storage.loadTransactionsFromFile(options.input);
	if (txs.length < 1) {
		throw new Error('Nothing to process');
	}

	if (options.by_count) {
		let files_count = Math.ceil(txs.length / options.by_count);
		for (let idx = 0; idx < files_count; idx++) {
			let split_txs = txs.slice(idx * options.by_count, (idx + 1) * options.by_count);

			let output_filename = path.format({
				dir: path_comps.dir,
				name: path_comps.name + '-' + (idx + 1).toString(),
				ext: path_comps.ext
			});

			await tools.storage.saveTransactionsToFile(output_filename, split_txs);
		}
	}
	else if (options.by_quantity) {
		let start_idx = 0;
		let end_idx;

		for (let idx = 0; idx < options.by_quantity; idx++) {
			if (idx < options.by_quantity - 1) {
				end_idx = Math.floor(idx * (txs.length / options.by_quantity));
				if (end_idx < start_idx) {
					end_idx = start_idx + 1;
				}
				if (end_idx > txs.length) {
					end_idx = txs.length;
				}
			}
			else {
				end_idx = txs.length;
			}
			if (start_idx >= end_idx) {
				break;
			}

			let split_txs = txs.slice(start_idx, end_idx);

			let output_filename = path.format({
				dir: path_comps.dir,
				name: path_comps.name + '-' + (idx + 1).toString(),
				ext: path_comps.ext
			});

			await tools.storage.saveTransactionsToFile(output_filename, split_txs);

			start_idx = end_idx + 1;
		}
	}
	else if (options.by_sender || options.by_receiver) {
		let split_txs = new Map();

		for (let tx_idx = 0; tx_idx < txs.length; tx_idx++) {
			let tx_info = tools.tx.getInfo(txs[tx_idx]);

			let address = options.by_sender ? tx_info.from : tx_info.to;

			let indexes = split_txs.get(address);
			if (!indexes) {
				indexes = [];
				split_txs.set(address, indexes);
			}
			indexes.push(tx_idx);
		}

		for (let address of split_txs.keys()) {
			let indexes = split_txs.get(address);

			let this_set_txs = indexes.map((tx_idx) => {
				return txs[tx_idx];
			});

			let output_filename = path.format({
				dir: path_comps.dir,
				name: path_comps.name + '-' + address,
				ext: path_comps.ext
			});

			await tools.storage.saveTransactionsToFile(output_filename, this_set_txs);
		}
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

		let methods_count = 0;
		if (cmdline.keyexists('by-count')) {
			methods_count += 1;
		}
		if (cmdline.keyexists('by-quantity')) {
			methods_count += 1;
		}
		if (cmdline.keyexists('by-sender')) {
			methods_count += 1;
		}
		if (cmdline.keyexists('by-receiver')) {
			methods_count += 1;
		}
		if (methods_count == 0) {
			reject(new Error("ERROR: No split method specified."));
			return;
		}
		if (methods_count != 1) {
			reject(new Error("ERROR: More than one split method has been specified."));
			return;
		}

		let by_count = null;
		let by_quantity = null;
		let by_sender = null;
		let by_receiver = null;
		if (cmdline.keyexists('by-count')) {
			by_count = cmdline.get('by-count');
			if (by_count === null) {
				reject(new Error("ERROR: Missing value in '--by-count' parameter."));
				return;
			}
			by_count = parseInt(by_count, 10);
			if (Number.isNaN(by_count) || by_count < 1) {
				reject(new Error("ERROR: Invalid value in '--by-count' parameter. It must be greater or equal to 1."));
				return;
			}
		}
		else if (cmdline.keyexists('by-quantity')) {
			by_quantity = cmdline.get('by-quantity');
			if (by_quantity === null) {
				reject(new Error("ERROR: Missing value in '--by-quantity' parameter."));
				return;
			}
			by_quantity = parseInt(by_quantity, 10);
			if (Number.isNaN(by_quantity) || by_quantity < 2) {
				reject(new Error("ERROR: Invalid value in '--by-quantity' parameter. It must be greater or equal to 2."));
				return;
			}
		}
		else if (cmdline.keyexists('by-sender')) {
			by_sender = true;
		}
		else if (cmdline.keyexists('by-receiver')) {
			by_receiver = true;
		}

		resolve({
			input,
			by_count,
			by_quantity,
			by_sender,
			by_receiver
		});
	});
}
