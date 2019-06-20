const cmdline = require('node-cmdline-parser');
const path = require('path');
const tools = require('../index');
const rl = require('readline-sync');

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
	let mnemonic_address;

	if (cmdline.keyexists("help")) {
		console.log("Use: sign.js parameters [options]");
		console.log("");
		console.log("Where 'parameters' are:");
		console.log("  --input {FILENAME} or {FOLDERNAME} : Folder and/or file with transactions to sign. Wildcards accepted on filename.");
		console.log("  --output {FILENAME}                : Output file to create with signed transactions. Can be used only if input is only one file.");
		console.log("");
		console.log("And 'options' are:");
		console.log("  --mnemonic \"{MNEMONIC}\"                     : Signer's mnemonic. Enclose the 25-word passphrase in quotes. If not provided, the app will ask for it.");
		console.log("  --multisig-threshold {NUMBER}               : Required signatures for a multsig account.");
		console.log("  --multisig-addresses {ADDRESS[,ADDRESS...]} : A comma separated list of addresses that make up the multisig account. Required only for the first signature.");
		console.log("  --remove-existing                           : Remove any previously existing signature from the transaction.");
		return;
	}

	let options = await parseCmdLineParams();

	if (!(options.remove_signature || options.mnemonic)) {
		//ask for mnemonic
		options.mnemonic = rl.question('Enter mnemonic: ');
	}

	if (options.mnemonic) {
		let decoded = tools.mnemonics.decode(options.mnemonic);
		if (!decoded) {
			throw new Error("ERROR: Invalid mnemonic.");
		}
		mnemonic_address = decoded.address;
	}

	for (let idx = 0; idx < options.input.length; idx++) {
		console.log('Loading ' + options.input[idx] + '...');
		let txs = await tools.storage.loadTransactionsFromFile(options.input[idx]);

		for (let tx_idx = 0; tx_idx < txs.length; tx_idx++) {
			let msg = 'Processing ' + (tx_idx + 1).toString() + ' of ' + txs.length.toString() + '...';
			console.log(msg);

			if (options.remove_signature) {
				tools.sign.removeAllSignatures(txs[tx_idx]);
			}
			tools.sign.addSignature(txs[tx_idx], options.mnemonic, options.multisig_threshold, options.multisig_addresses);
		}

		let output_filename;
		if (options.output !== null) {
			output_filename = options.output[idx];
		}
		else {
			let path_comps = path.parse(options.input[idx]);

			output_filename = path.format({
				dir: path_comps.dir,
				name: path_comps.name + ((mnemonic_address) ? '-' + mnemonic_address.substr(0, 8) : ''),
				ext: '.sig'
			});
		}

		console.log('Saving ' + output_filename + '...');
		await tools.storage.saveTransactionsToFile(output_filename, txs);
	}
}

function parseCmdLineParams() {
	return new Promise((resolve, reject) => {
		let idx, idx2;

		let filemask = cmdline.get('input');
		if (filemask === null) {
			reject(new Error("ERROR: Missing value in '--input' parameter."));
			return;
		}
		idx = filemask.lastIndexOf('/');
		idx2 = filemask.lastIndexOf('\\');
		if (idx2 > idx) {
			idx = idx2;
		}
		let _input = {
			folder: filemask.substr(0, idx + 1),
			filemask: filemask.substr(idx + 1)
		};
		if (_input.folder.indexOf('*') >= 0 || _input.folder.indexOf('?') >= 0) {
			reject(new Error("ERROR: Wildcards are not allowed in the folder part of the '--input' parameter."));
			return;
		}
		try {
			_input.folder = tools.utils.normalizeFolder(_input.folder);
		}
		catch (err) {
			reject(err);
			return;
		}
		if (_input.folder.length == 0) {
			reject(new Error("ERROR: Invalid value in '--input' parameter."));
			return;
		}
		if (_input.filemask.length == 0) {
			_input.filemask = '*.tx';
		}
		let _inputHasWildcards = (_input.filemask.indexOf('*') >= 0 || _input.filemask.indexOf('?') >= 0);
		let input = tools.utils.getFileList(_input.folder, _input.filemask);

		let output = cmdline.get('output');
		if (_inputHasWildcards || output === null) {
			if (output !== null) {
				reject(new Error("ERROR: Cannot use '--output' parameter if input is a folder or has wildcards."));
				return;
			}
		}
		else {
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
			if (input.length > 0) {
				if (input.length > 1) {
					input.splice(1, input.length - 1); //NOTE: This should not happen
				}
				output = [ output ];
			}
			else {
				output = [];
			}
		}

		let mnemonic = cmdline.get('mnemonic');

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
				for (idx = 0; idx < multisig_addresses.length; idx++) {
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
