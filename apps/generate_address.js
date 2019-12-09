const cmdlineParser = require('./common/cmdline_parser');
const tools = require('../index');
const cmdline = require('node-cmdline-parser');

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
	if (cmdlineParser.askingHelp()) {
		console.log('Use: generate_address.js single-account-parameters');
		console.log(' Or: generate_address.js  --multisig multisig-account-parameters');
		console.log('');
		console.log('Where \'single-account-parameters\' is:');
		console.log('  --count {NUMBER} : Number of addresses to generate.');
		console.log('');
		console.log('And \'multisig-account-parameters\' are:');
		console.log('  --size {NUMBER} : Amount of addresses envolved in the multisig account.');
		console.log('  --req {NUMBER}  : Required amount signatures to validate a multisig transaction.');
		return;
	}

	let options = await parseCmdLineParams();

	if (options.multisig) {
		let addresses = [];

		for (let idx = 1; idx <= options.size; idx++) {
			let account = tools.addresses.generate();

			addresses.push(account.address);

			console.log('Account #' + idx.toString() + ': ' + account.address);
			console.log('Mnemonic:', account.mnemonic);
			console.log('-----------------------------------------');
		}

		let multiSigAddr = tools.addresses.generateMultisig(addresses, options.required);
		console.log('Multi-sig Account: ' + multiSigAddr);
	}
	else {
		for (let idx = 1; idx <= options.count; idx++) {
			let account = tools.addresses.generate();

			if (idx > 1) {
				console.log('-----------------------------------------');
			}

			console.log('Account #' + idx.toString() + ': ' + account.address);
			console.log('Mnemonic:', account.mnemonic);
		}
	}
}

function parseCmdLineParams() {
	return new Promise((resolve, reject) => {
		let options = {};

		try {
			if (cmdlineParser.paramIsPresent('multisig')) {
				options.multisig = true;

				options.size = cmdlineParser.getUint('size', { min: 2, max: 100 });

				options.required = cmdlineParser.getUint('req', { min: 1, max: options.size });
			}
			else {
				options.multisig = false;

				options.count = cmdlineParser.getUint('count', { min: 1, max: 1000 });
			}
		}
		catch (err) {
			reject(err);
			return;
		}

		resolve(options);
	});
}
