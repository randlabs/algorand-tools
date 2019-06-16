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
		console.log("Use: build.js parameters [options]");
		console.log("");
		console.log("Where 'parameters' are:");
		console.log("  --output filename.tx      : Transaction output filename");
		console.log("  --from {ADDRESS}          : Sender address");
		console.log("  --to {ADDRESS}            : Receiver address");
		console.log("  --amount {NUMBER}         : Amount to send in microalgos");
		console.log("  --fee {NUMBER}            : Fees to pay (the value is multiplied by the tx size).");
		console.log("  --first-round [+]{NUMBER} : First round to send transaction. Use +NUMBER to calculate the round based on the network's current round.");
		console.log("");
		console.log("And 'options' are:");
		console.log("  --note {BASE64-STRING}                      : Not to add to transaction.");
		console.log("  --last-round [+]{NUMBER}                    : First round to send transaction. Defaults to 1000 after first round. Use +NUMBER to calculate the round based on the network's current round.");
		console.log("  --close {ADDRESS}                           : Close address.");
		console.log("  --fixed-fee                                 : Fees are not multiplied by tx size.");
		console.log("  --genesis-hash {BASE64-STRING}              : Network's genesis hash. Retrieved from network if not passed.");
		console.log("  --genesis-id {STRING}                       : Network's genesis ID. Retrieved from network if not passed.");
		console.log("  --multisig-threshold {NUMBER}               : Required signatures for a multsig account template.");
		console.log("  --multisig-addresses {ADDRESS[,ADDRESS...]} : A comma separated list of addresses that make up the multisig account template.");
		console.log("  --node-url http://address:port              : Node's url if a access to network is required. If not specified the ALGOTOOLS_NODE_URL environment variable is used.");
		console.log("  --node-api-token token                      : Node's api token if a access to network is required. If not specified the ALGOTOOLS_NODE_API_TOKEN environment variable is used.");
		return;
	}

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
		feeIsFixed: options.feeIsFixed,
		first_round: options.first_round,
		last_round: options.last_round,
		close: options.close_address,
		genesis_hash: options.genesis_hash,
		genesis_id: options.genesis_id,
		note: options.note
	});

	if (options.multisig_threshold && options.multisig_addresses) {
		tools.sign.addSignatureTemplate(pay_tx, options.multisig_threshold, options.multisig_addresses);
	}

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
			if (!cmdline.keyexists('multisig-addresses')) {
				reject(new Error("ERROR: Missing value in '--from' parameter."));
				return;
			}
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

		let feeIsFixed = cmdline.keyexists('fixed-fee');

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

		let multisig_threshold;
		if (cmdline.keyexists('multisig-threshold')) {
			multisig_threshold = cmdline.get('multisig-threshold');
			if (multisig_threshold !== null) {
				multisig_threshold = parseInt(multisig_threshold, 10);
				if (isNaN(multisig_threshold) || multisig_threshold < 1) {
					reject(new Error("ERROR: Invalid value in '--multisig-threshold' parameter. It must be greater than or equal to 1."));
					return;
				}
			}
		}

		let multisig_addresses;
		if (cmdline.keyexists('multisig-addresses')) {
			multisig_addresses = cmdline.get('multisig-addresses');
			if (multisig_addresses !== null) {
				multisig_addresses = multisig_addresses.split(',');
				if (multisig_addresses.length == 0) {
					reject(new Error("ERROR: Invalid value in '--multisig-addresses' parameter. It must be a comma-separated list of addresses."));
					return;
				}
				for (let idx = 0; idx < multisig_addresses.length; idx++) {
					multisig_addresses[idx] = multisig_addresses[idx].trim();
					if (multisig_addresses[idx].length == 0) {
						reject(new Error("ERROR: Invalid value in '--multisig-addresses' parameter. Addresses can not be empty."));
						return;
					}
				}

				if (multisig_threshold > multisig_addresses.length) {
					reject(new Error("ERROR: Invalid value in '--multisig-threshold' parameter. It must be less than or equal to the number of addresses."));
					return;
				}
			}
		}

		if (multisig_threshold && (!multisig_addresses)) {
			reject(new Error("ERROR: '--multisig-addresses' parameter must be specified if '--multisig-threshold' is present."));
			return;
		}
		if (multisig_addresses && (!multisig_threshold)) {
			reject(new Error("ERROR: '--multisig-threshold' parameter must be specified if '--multisig-addresses' is present."));
			return;
		}
		if (multisig_addresses && multisig_threshold) {
			let multisig_addr = tools.addresses.generateMultisig(multisig_addresses, multisig_threshold);
			if (from_address === null) {
				from_address = multisig_addr;
			}
			else if (from_address != multisig_addr) {
				reject(new Error("ERROR: Sender address is not related to the multisig addresses."));
				return;
			}
		}

		resolve({
			output,
			from_address,
			to_address,
			amount,
			fee,
			feeIsFixed,
			first_round,
			last_round,
			close_address,
			genesis_hash,
			genesis_id,
			note,
			multisig_threshold,
			multisig_addresses
		});
	});
}
