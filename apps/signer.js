const fs = require('fs');
const cmdline = require('node-cmdline-parser');
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
	let hash;

	let options = await parseCmdLineParams();

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
		}

		let signature = tools.sign.rawSign(hash, options.mnemonic);
		if (!signature) {
			throw new Error("Invalid mnemonic.");
		}

		address = tools.mnemonics.decode(options.mnemonic).address;

		fs.writeFileSync(options.output, signature);

		console.log("Data signed with key of " + address);
	}
	else {
		let signature = fs.readFileSync(options.signature);

		if (!options.address) {
			options.address = readlineSync.question('Enter your address: ');
		}

		if (tools.sign.rawVerify(hash, new Uint8Array(signature), options.address)) {
			console.log("Validation SUCCEEDED!!!");
		}
		else {
			console.log("Validation FAILED!!!");
		}
	}
}

function parseCmdLineParams() {
	return new Promise((resolve, reject) => {
		let verify = cmdline.keyexists('verify');
		let data;
		let filename;
		let output;
		let mnemonic;
		let signature;
		let address;

		if (cmdline.keyexists('data')) {
			data = cmdline.get('data');
			if (data === null) {
				reject(new Error("ERROR: Missing value in '--data' parameter."));
				return;
			}
		}
		if (cmdline.keyexists('filename')) {
			if (data) {
				reject(new Error("ERROR: Cannot use '--filename' parameter when '--data' is present."));
				return;
			}
			filename = cmdline.get('filename');
			if (filename === null) {
				reject(new Error("ERROR: Missing value in '--filename' parameter."));
				return;
			}
			try {
				filename = tools.utils.normalizeFilename(filename);
			}
			catch (err) {
				reject(err);
				return;
			}
			if (filename.length == 0) {
				reject(new Error("ERROR: Invalid value in '--filename' parameter."));
				return;
			}
		}

		if (!verify) {
			output = cmdline.get('output');
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

			if (cmdline.keyexists('mnemonic')) {
				mnemonic = cmdline.get('mnemonic');
				if (mnemonic !== null) {
					reject(new Error("ERROR: Missing value in '--mnemonic' parameter."));
					return;
				}
			}
		}
		else {
			signature = cmdline.get('signature');
			if (signature === null) {
				reject(new Error("ERROR: Missing value in '--signature' parameter."));
				return;
			}
			try {
				signature = tools.utils.normalizeFilename(signature);
			}
			catch (err) {
				reject(err);
				return;
			}
			if (signature.length == 0) {
				reject(new Error("ERROR: Invalid value in '--signature' parameter."));
				return;
			}

			if (cmdline.keyexists('address')) {
				address = cmdline.get('address');
				if (address === null) {
					reject(new Error("ERROR: Missing value in '--address' parameter."));
					return;
				}
			}
		}
		resolve({
			verify,
			data,
			filename,
			output,
			mnemonic,
			signature,
			address
		});
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
