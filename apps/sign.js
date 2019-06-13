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
		console.log("Use: sign.js parameters [options]");
		console.log("");
		console.log("Where 'parameters' are:");
		console.log("  --input filename.tx     : Transaction(s) input filename");
		console.log("  --output filename.tx    : Transaction(s) output filename");
		console.log("  --mnemonic \"{MNEMONIC}\" : Signer's mnemonic (enclose the 25-word passphrase in quotes)");
		console.log("");
		console.log("And 'options' are:");
		console.log("  --multisig-threshold {NUMBER}               : Required signatures for a multsig account.");
		console.log("  --multisig-addresses {ADDRESS[,ADDRESS...]} : A comma separated list of addresses that make up the multisig account. Required only for the first signature.");
		console.log("  --remove-existing                           : Removed any previously existing signature from the transaction.");
		return;
	}

	let options = await parseCmdLineParams();

	let txs = await tools.storage.loadTransactionsFromFile(options.input);

	for (let idx = 0; idx < txs.length; idx++) {
		if (options.remove_signature) {
			tools.sign.removeAllSignatures(txs[idx]);
		}
		tools.sign.addSignature(txs[idx], options.mnemonic, options.multisig_threshold, options.multisig_addresses);
	}

	await tools.storage.saveTransactionsToFile(options.output, txs);
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

		let mnemonic = cmdline.get('mnemonic');
		if (mnemonic === null) {
			reject(new Error("ERROR: Missing value in '--mnemonic' parameter."));
			return;
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

		let remove_signature = cmdline.keyexists('remove-existing');

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

		resolve({
			input,
			output,
			mnemonic,
			multisig_threshold,
			multisig_addresses,
			remove_signature
		});
	});
}
