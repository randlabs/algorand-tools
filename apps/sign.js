const cmdlineParser = require('./common/cmdline_parser');
const path = require('path');
const tools = require('../index');
const rl = require('readline-sync');
const LedgerHQ = require('../lib/helpers/ledger');

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
	let device;

	if (cmdlineParser.askingHelp()) {
		console.log('Use: sign.js parameters [options]');
		console.log('');
		console.log('Where \'parameters\' are:');
		console.log('  --input {FILENAME} or {FOLDERNAME} : Folder and/or file with transactions to sign. Wildcards accepted on filename.');
		console.log('  --output {FILENAME}                : Output file to create with signed transactions. Can be used only if input ' +
					'is only one file.');
		console.log('');
		console.log('And \'options\' are:');
		console.log('  --mnemonic \'{MNEMONIC}\'                     : Signer\'s mnemonic. Enclose the 25-word passphrase in quotes. ' +
					'If not provided, the app will ask for it.');
		console.log('  --ledger                                    : Use an USB plugged Ledger device to sign the transactions.');
		console.log('  --multisig-threshold {NUMBER}               : Required signatures for a multsig account.');
		console.log('  --multisig-addresses {ADDRESS[,ADDRESS...]} : A comma separated list of addresses that make up the multisig ' +
					'account. Required only for the first signature.');
		console.log('  --remove-existing                           : Remove any previously existing signature from the transaction.');
		return;
	}

	let options = await parseCmdLineParams();

	if (!(options.remove_signature || options.mnemonic || options.use_ledger)) {
		//ask for mnemonic
		options.mnemonic = rl.question('Enter mnemonic: ');
	}

	if (options.use_ledger) {
		device = new LedgerHQ.LedgerHQ();
		mnemonic_address = await device.getAddress();
	}
	else if (options.mnemonic) {
		let decoded = tools.mnemonics.decode(options.mnemonic);
		if (!decoded) {
			throw new Error('ERROR: Invalid mnemonic.');
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
			await tools.sign.addSignature(
				txs[tx_idx],
				(device) ? device : options.mnemonic,
				options.multisig_threshold,
				options.multisig_addresses
			);
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
		let options = {};

		try {
			options.input = cmdlineParser.getFilesByFilemask('input');

			if (options.input.length == 1) {
				options.output = cmdlineParser.getFilename('output', { optional: true });
			}
			else {
				if (cmdlineParser.paramIsPresent('output')) {
					throw new Error('ERROR: Cannot use \'--output\' parameter if input is more than one file.');
				}
			}

			options.mnemonic = cmdlineParser.getMnemonic('mnemonic', { dontDecode: true });

			options.use_ledger = cmdlineParser.paramIsPresent('ledger');

			options.multisig_threshold = cmdlineParser.getUint('multisig-threshold', { optional: true, min: 1 });
			options.remove_signature = cmdlineParser.paramIsPresent('remove-existing');
			options.multisig_addresses = cmdlineParser.getAddressList('multisig-addresses', { optional: true });

			if (options.multisig_threshold && (!options.multisig_addresses)) {
				throw new Error('ERROR: \'--multisig-addresses\' parameter must be specified if \'--multisig-threshold\' is present.');
			}
			if (options.multisig_addresses && (!options.multisig_threshold)) {
				throw new Error('ERROR: \'--multisig-threshold\' parameter must be specified if \'--multisig-addresses\' is present.');
			}

			if (options.multisig_addresses !== null && options.multisig_threshold > options.multisig_addresses.length) {
				throw new Error('ERROR: Invalid value in \'--multisig-threshold\' parameter. It must be less than or equal to the ' +
								'number of addresses.');
			}
		}
		catch (err) {
			reject(err);
			return;
		}

		resolve(options);
	});
}
