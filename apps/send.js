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
		console.log("Use: send.js multisig input");
		console.log("");
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
		let last_round = tools.node.getLastRound();

		loop = false;
		for (let idx = 0; idx < txs.length; idx++) {
			if (!txs_status[idx].processed) {
				loop = true;
				if (txs_status[idx].tx_info.first_round < last_round) {
					//wait
				}
				else if (txs_status[idx].tx_info.first_round > last_round) {
					//wait
					txs_status[idx].processed = true;
					txs_status[idx].status_message = 'Due';
				}
				else {
					//can send now
					txs_status[idx].processed = true;
					try {
						await tools.node.sendTransaction(txs[idx]);
						txs_status[idx].status_message = 'Successfully sent';
					}
					catch (err) {
						txs_status[idx].status_message = err.stack;
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

	//dump status
	for (let idx = 0; idx < txs.length; idx++) {
		let status;
		if (txs_status[idx].processed) {
			status = txs_status[idx].status_message;
		}
		else {
			status = 'Not processed';
		}
		console.log(txs_status[idx].tx_id + ': ' + status + ' [From:' + txs_status[idx].tx_info.from +
						' / To:' + txs_status[idx].tx_info.to + ' / Amount:' + txs_status[idx].tx_info.amount.toString() +
						' / Fee:' + txs_status[idx].tx_info.fee.toString() + ' / fr:' + txs_status[idx].tx_info.first_round.toString() + ']');
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
