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
		console.log("Use: send.js parameters");
		console.log("");
		console.log("Where 'parameters' are:");
		console.log("  --input filename.tx : Filename with transactions to send.");
		console.log("  --wait              : Wait for the network's current round to match transactions' first round if required.");
		return;
	}

	let options = await parseCmdLineParams();

	let txs = await tools.storage.loadTransactionsFromFile(options.input);

	let txs_status = [];
	for (let idx = 0; idx < txs.length; idx++) {
		txs_status.push({
			processed: false,
			tx_id: tools.tx.getTxID(txs[idx]),
			tx_info: tools.tx.getInfo(txs[idx])
		});
	}

	let loop = true;
	while (loop) {
		let last_round = await tools.node.getLastRound();

		let rounds_to_wait = null;
		for (let idx = 0; idx < txs.length; idx++) {
			if (!txs_status[idx].processed) {
				loop = true;
				if (txs_status[idx].tx_info.first_round >= last_round) {
					let diff = txs_status[idx].tx_info.first_round - last_round;

					if (rounds_to_wait === null || diff < rounds_to_wait) {
						rounds_to_wait = diff;
					}
				}
			}
		}
		if (rounds_to_wait !== null) {
			let msg = "Next in " + rounds_to_wait.toString() + " round" + ((rounds_to_wait != 1) ? "s" : "") + "   ";
			process.stdout.write(msg + "\b".repeat(msg.length));
		}

		loop = false;
		for (let idx = 0; idx < txs.length; idx++) {
			if (!txs_status[idx].processed) {
				loop = true;
				if (txs_status[idx].tx_info.first_round > last_round) {
					//wait
				}
				else if (last_round >= txs_status[idx].tx_info.last_round) {
					//wait
					txs_status[idx].processed = true;
					printStatus(txs_status[idx].tx_id, txs_status[idx].tx_info, 'Due');
				}
				else {
					//can send now
					txs_status[idx].processed = true;
					console.log("Sending transaction " + txs_status[idx].tx_id);
					try {
						await tools.node.sendTransaction(txs[idx]);
						printStatus(txs_status[idx].tx_id, txs_status[idx].tx_info, 'Successfully sent');
					}
					catch (err) {
						printStatus(txs_status[idx].tx_id, txs_status[idx].tx_info, err.message);
					}
				}
			}
		}
		if (!options.wait) {
			break;
		}
		if (loop) {
			await sleep(1000);
		}
	}

	//dump not processed transactions
	for (let idx = 0; idx < txs.length; idx++) {
		if (!txs_status[idx].processed) {
			printStatus(txs_status[idx].tx_id, txs_status[idx].tx_info, 'Not processed');
		}
	}
}

function printStatus(tx_id, tx_info, status) {
	console.log(tx_id + ': ' + status + ' [From:' + tx_info.from + ' / To:' + tx_info.to + ' / Amount:' + tx_info.amount.toString() +
				' / Fee:' + tx_info.fee.toString() + ' / fr:' + tx_info.first_round.toString() + ']');
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

		let wait = cmdline.keyexists('wait');

		resolve({
			input,
			wait
		});
	});
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
