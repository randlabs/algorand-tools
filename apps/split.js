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
		console.log("  --input {FILENAME}  : File with transactions to split.");
		console.log("  --from {NUMBER}     : Include transactions starting from the specified round. If first round is less than 'from' but last round is greater or equal, it is also included.");
		console.log("  --to {NUMBER}       : Include transactions until the specified round. If first round is less or equal to 'to' but last round is greater , it is also included.");
		console.log("  --count {NUMBER}    : Splits in files of 'count' transactions each.");
		console.log("  --quantity {NUMBER} : Splits all transactions in the specified 'quantity' of files.");
		return;
	}

	let options = await parseCmdLineParams();

	let path_comps = path.parse(options.input);

	let txs = await tools.storage.loadTransactionsFromFile(options.input);
	if (txs.length < 1) {
		throw new Error('Nothing to process');
	}

	if (options.count) {
		let files_count = Math.ceil(txs.length / options.count);
		for (let idx = 0; idx < files_count; idx++) {
			let split_txs = txs.slice(idx * options.count, (idx + 1) * options.count);

			let output_filename = path.format({
				dir: path_comps.dir,
				name: path_comps.name + '-' + (idx + 1).toString(),
				ext: path_comps.ext
			});

			await tools.storage.saveTransactionsToFile(output_filename, split_txs);
		}
	}
	else if (options.quantity) {
		let start_idx = 0;
		let end_idx;

		for (let idx = 0; idx < options.quantity; idx++) {
			if (idx < options.quantity - 1) {
				end_idx = Math.floor(idx * (txs.length / options.quantity));
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
	else {
		let indexes = [];
		for (let tx_idx = 0; tx_idx < txs.length; tx_idx++) {
			let tx_info = tools.tx.getInfo(txs[tx_idx]);
			if (tx_info.first_round < options.to && tx_info.last_round > options.from) {
				indexes.push(tx_idx);
			}
		}

		let split_txs = indexes.map((tx_idx) => {
			return txs[tx_idx];
		});

		let output_filename = path.format({
			dir: path_comps.dir,
			name: path_comps.name + '-' + options.from.toString() + '-' + options.to.toString(),
			ext: path_comps.ext
		});

		await tools.storage.saveTransactionsToFile(output_filename, split_txs);
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

		let count = null;
		let quantity = null;
		let _from = null;
		let _to = null;
		if (cmdline.keyexists('count')) {
			if (cmdline.keyexists('quantity')) {
				reject(new Error("ERROR: '--quantity' cannot be used with '--count' parameter."));
				return;
			}
			if (cmdline.keyexists('from')) {
				reject(new Error("ERROR: '--from' cannot be used with '--count' parameter."));
				return;
			}
			if (cmdline.keyexists('to')) {
				reject(new Error("ERROR: '--to' cannot be used with '--count' parameter."));
				return;
			}

			count = cmdline.get('count');
			if (count === null) {
				reject(new Error("ERROR: Missing value in '--count' parameter."));
				return;
			}
			count = parseInt(count, 10);
			if (Number.isNaN(count) || count < 1) {
				reject(new Error("ERROR: Invalid value in '--count' parameter. It must be greater or equal to 1."));
				return;
			}
		}
		else if (cmdline.keyexists('quantity')) {
			if (cmdline.keyexists('count')) {
				reject(new Error("ERROR: '--count' cannot be used with '--quantity' parameter."));
				return;
			}
			if (cmdline.keyexists('from')) {
				reject(new Error("ERROR: '--from' cannot be used with '--quantity' parameter."));
				return;
			}
			if (cmdline.keyexists('to')) {
				reject(new Error("ERROR: '--to' cannot be used with '--quantity' parameter."));
				return;
			}

			quantity = cmdline.get('quantity');
			if (quantity === null) {
				reject(new Error("ERROR: Missing value in '--quantity' parameter."));
				return;
			}
			quantity = parseInt(quantity, 10);
			if (Number.isNaN(quantity) || quantity < 2) {
				reject(new Error("ERROR: Invalid value in '--quantity' parameter. It must be greater or equal to 2."));
				return;
			}
		}
		else {
			if (cmdline.keyexists('quantity')) {
				reject(new Error("ERROR: '--quantity' cannot be used with '--from' and '--to' parameters."));
				return;
			}
			if (cmdline.keyexists('count')) {
				reject(new Error("ERROR: '--count' cannot be used with '--from' and '--to' parameters."));
				return;
			}

			_from = cmdline.get('from');
			if (_from === null) {
				reject(new Error("ERROR: Missing value in '--from' parameter."));
				return;
			}
			_from = parseInt(_from, 10);
			if (Number.isNaN(_from) || _from < 0) {
				reject(new Error("ERROR: Invalid value in '--from' parameter. It must be greater or equal to 0."));
				return;
			}

			_to = cmdline.get('to');
			if (_to === null) {
				reject(new Error("ERROR: Missing value in '--to' parameter."));
				return;
			}
			_to = parseInt(_to, 10);
			if (Number.isNaN(_to) || _to < _from) {
				reject(new Error("ERROR: Invalid value in '--to' parameter. It must be greater or equal to '--from'."));
				return;
			}
		}

		resolve({
			input,
			count,
			quantity,
			from: _from,
			to: _to,
		});
	});
}
