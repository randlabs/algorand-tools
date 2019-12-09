const cmdlineParser = require('./common/cmdline_parser');
const fs = require('fs');
const sha512 = require('js-sha512').sha512;
const tools = require('../index');
const readlineSync = require('readline-sync');

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
		console.log('Use: raw_signer.js sign-parameters');
		console.log(' Or: raw_signer.js --verify verify-parameters');
		console.log('');
		console.log('Where \'sign-parameters\' are:');
		console.log('  --data {TEXT}           : Sign the passed data. Cannot be used with \'--filename\'.');
		console.log('  --filename {FILENAME}   : File to sign. Cannot be used with \'--data\'.');
		console.log('  --output {FILENAME}     : Signature file to generate.');
		console.log('  --mnemonic \'{MNEMONIC}\' : Signer\'s mnemonic. Enclose the 25-word passphrase in quotes.');
		console.log('');
		console.log('And \'verify-parameters\' are:');
		console.log('  --data {TEXT}          : Verify the passed data. Cannot be used with \'--filename\'.');
		console.log('  --filename {FILENAME}  : File to verify. Cannot be used with \'--data\'.');
		console.log('  --signature {FILENAME} : Signature file to validate.');
		console.log('  --address {ADDRESS}    : Address of signer.');
		return;
	}

	let options = await parseCmdLineParams();
	let hash;

	if (options.filename) {
		hash = getHashOfFile(options.filename);
	}
	else if (options.data) {
		hash = getHashOfString(options.data);
	}
	else {
		let value = readlineSync.question('Enter a message to ' + (options.verify ? 'verify' : 'sign') + ': ');
		hash = getHashOfString(value);
	}

	if (!options.verify) {
		let address;

		if (!options.mnemonic) {
			options.mnemonic = readlineSync.question('Enter your mnemonic pass phrase: ');

			if (!tools.mnemonics.isValid(options.mnemonic)) {
				throw new Error("ERROR: Invalid mnemonic value entered.");
			}
		}

		let signature = tools.sign.rawSign(hash, options.mnemonic);
		if (!signature) {
			throw new Error("ERROR: Invalid mnemonic value entered.");
		}

		address = tools.mnemonics.decode(options.mnemonic).address;

		fs.writeFileSync(options.output, signature);

		console.log('Data signed with key of ' + address);
	}
	else {
		let signature = fs.readFileSync(options.signature);

		if (!options.address) {
			options.address = readlineSync.question('Enter your address: ');
		}

		if (tools.sign.rawVerify(hash, new Uint8Array(signature), options.address)) {
			console.log('Validation SUCCEEDED!!!');
		}
		else {
			console.log('Validation FAILED!!!');
		}
	}
}

function parseCmdLineParams() {
	return new Promise((resolve, reject) => {
		let options = {};

		try {
			options.verify = cmdlineParser.paramIsPresent('verify');

			if (cmdlineParser.paramIsPresent('data')) {
				if (cmdlineParser.paramIsPresent('filename')) {
					throw new Error('ERROR: Cannot use \'--filename\' parameter when \'--data\' is present.');
				}

				options.data = cmdlineParser.getString('data');
			}
			else if (cmdlineParser.paramIsPresent('filename')) {
				options.filename = cmdlineParser.getFilename('filename');
			}
			else {
				throw new Error('ERROR: Missing \'--data\' and \'--filename\' parameter.');
			}

			if (!options.verify) {
				options.output = cmdlineParser.getFilename('output');

				options.mnemonic = cmdlineParser.getMnemonic('mnemonic', { optional: true, dontDecode: true });
			}
			else {
				options.signature = cmdlineParser.getFilename('signature');

				options.address = cmdlineParser.getAddress('address', { optional: true });
			}
		}
		catch (err) {
			reject(err);
			return;
		}

		resolve(options);
	});
}

function getHashOfString(str) {
	let hash = sha512.create();
	hash.update(str);
	return new Uint8Array(hash.arrayBuffer());
}

function getHashOfFile(filename) {
	let bytesRead;

	let fd = fs.openSync(filename, 'r');
	let hash = sha512.create();
	let buffer = new Uint8Array(4096);
	do {
		bytesRead = fs.readSync(fd, buffer, 0, 4096);
		if (bytesRead == 4096) {
			hash.update(buffer);
		}
		else if (bytesRead > 0) {
			hash.update(buffer.slice(0, bytesRead));
		}
	}
	while (bytesRead == 4096);

	fs.closeSync(fd);

	return new Uint8Array(hash.arrayBuffer());
}
