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
	let options = await parseCmdLineParams();

	if (options.first_round < 0 || (typeof options.last_round !== 'undefined' && options.last_round < 0)) {
		let round = await tools.node.getLastRound();

		if (options.first_round < 0) {
			options.first_round = round + (-options.first_round);
		}
		if (typeof options.last_round !== 'undefined' && options.last_round < 0) {
			options.last_round = round + (-options.last_round);
		}
	}

	let pay_tx = await tools.tx.createPaymentTransaction({
		from: options.from_address,
		to: options.to_address,
		amount: options.amount,
		fee: options.fee,
		first_round: options.first_round,
		last_round: options.last_round,
		close: options.close_address,
		genesis_hash: options.genesis_hash,
		genesis_id: options.genesis_id,
		note: options.note
	});

	await tools.storage.saveTransactionsToFile(options.output, [ pay_tx ]);
	console.log("Generated transaction ID: " + tools.tx.getTxID(pay_tx));
}

function parseCmdLineParams() {
	return new Promise((resolve, reject) => {
		let output = cmdline.get('output');
		if (output === null) {
			reject(new Error("ERROR: Missing value in '--output' parameter."));
			return;
		}
		try {
			output = tools.utils.normalizeFilename(output);
		}
		catch (err) {
			reject(err);
			return;
		}
		if (output.length == 0) {
			reject(new Error("ERROR: Invalid value in '--output' parameter."));
			return;
		}

		let from_address = cmdline.get('from');
		if (from_address === null) {
			reject(new Error("ERROR: Missing value in '--from' parameter."));
			return;
		}

		let to_address = cmdline.get('to');
		if (to_address === null) {
			reject(new Error("ERROR: Missing value in '--to' parameter."));
			return;
		}

		let amount = cmdline.get('amount');
		if (amount === null) {
			reject(new Error("ERROR: Missing value in '--amount' parameter."));
			return;
		}
		amount = parseInt(amount, 10);

		let fee = cmdline.get('fee');
		if (fee === null) {
			reject(new Error("ERROR: Missing value in '--fee' parameter."));
			return;
		}
		fee = parseInt(fee, 10);

		let first_round = cmdline.get('first-round');
		if (first_round === null) {
			reject(new Error("ERROR: Missing value in '--first-round' parameter."));
			return;
		}
		if (first_round.startsWith('+')) {
			first_round = parseInt(first_round.substr(1), 10);
			if (first_round < 0) {
				reject(new Error("ERROR: Invalid value in '--first-round' parameter."));
				return;
			}
			first_round = -first_round;
		}
		else {
			first_round = parseInt(first_round, 10);
			if (first_round < 0) {
				reject(new Error("ERROR: Invalid value in '--first-round' parameter."));
				return;
			}
		}

		let last_round;
		if (cmdline.keyexists('last-round')) {
			last_round = cmdline.get('last-round');
			if (last_round.startsWith('+')) {
				last_round = parseInt(last_round.substr(1), 10);
				if (last_round < 0) {
					reject(new Error("ERROR: Invalid value in '--last-round' parameter."));
					return;
				}
				last_round = -last_round;
			}
			else {
				last_round = parseInt(last_round, 10);
				if (last_round < 0) {
					reject(new Error("ERROR: Invalid value in '--last-round' parameter."));
					return;
				}
			}
		}

		let close_address;
		if (cmdline.keyexists('close')) {
			close_address = cmdline.get('close');
		}

		let genesis_hash;
		if (cmdline.keyexists('genesis-hash')) {
			genesis_hash = cmdline.get('genesis-hash');
		}

		let genesis_id;
		if (cmdline.keyexists('genesis-id')) {
			genesis_id = cmdline.get('genesis-id');
		}

		let note;
		if (cmdline.keyexists('note')) {
			note = cmdline.get('note');
		}

		resolve({
			output,
			from_address,
			to_address,
			amount,
			fee,
			first_round,
			last_round,
			close_address,
			genesis_hash,
			genesis_id,
			note
		});
	});
}
