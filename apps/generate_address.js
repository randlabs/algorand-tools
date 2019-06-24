const algosdk = require('algosdk');
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
	if (cmdline.keyexists("help")) {
		console.log("Use: generate_address.js single-account-parameters");
		console.log(" Or: generate_address.js  --multisig multisig-account-parameters");
		console.log("");
		console.log("Where 'single-account-parameters' is:");
		console.log("  --count {NUMBER} : Number of addresses to generate.");
		console.log("");
		console.log("And 'multisig-account-parameters' are:");
		console.log("  --size {NUMBER} : Amount of addresses envolved in the multisig account.");
		console.log("  --req {NUMBER}  : Required amount signatures to validate a multisig transaction.");
		return;
	}

	let options = await parseCmdLineParams();

	if (options.multisig) {
		let addresses = [];

		for (let idx = 1; idx <= options.size; idx++) {
			let addr = algosdk.generateAccount();

			addresses.push(addr.addr);

			console.log("Account #" + idx.toString() + ": " + addr.addr);
			console.log("Mnemonic:", algosdk.secretKeyToMnemonic(addr.sk));
			console.log("-----------------------------------------");
		}

		let multiSigAddr = tools.addresses.generateMultisig(addresses, options.required);
		console.log("Multi-sig Account: " + multiSigAddr);
	}
	else {
		for (let idx = 1; idx <= options.count; idx++) {
			let addr = algosdk.generateAccount();

			if (idx > 1) {
				console.log("-----------------------------------------");
			}

			console.log("Account #" + idx.toString() + ": " + addr.addr);
			console.log("Mnemonic:", algosdk.secretKeyToMnemonic(addr.sk));
		}
	}
}

function parseCmdLineParams() {
	return new Promise((resolve, reject) => {
		if (cmdline.keyexists('multisig')) {
			let size = cmdline.get('size');
			if (size === null) {
				reject(new Error("ERROR: Missing value in '--size' parameter."));
				return;
			}
			size = parseInt(size, 10);
			if (Number.isNaN(size) || size < 1 || size > 1000) {
				reject(new Error("ERROR: Invalid value in '--size' parameter. It must be between 2 and 100."));
				return;
			}

			let required = cmdline.get('req');
			if (required === null) {
				reject(new Error("ERROR: Missing value in '--req' parameter."));
				return;
			}
			required = parseInt(required, 10);
			if (Number.isNaN(required) || required < 1 || required > size) {
				reject(new Error("ERROR: Invalid value in '--req' parameter. It must be between 1 and 'size'."));
				return;
			}

			resolve({
				multisig: true,
				size,
				required
			});
		}
		else {
			let count = cmdline.get('count');
			if (count === null) {
				reject(new Error("ERROR: Missing value in '--count' parameter."));
				return;
			}
			count = parseInt(count, 10);
			if (Number.isNaN(count) || count < 1 || count > 1000) {
				reject(new Error("ERROR: Invalid value in '--count' parameter. It must be between 1 and 100"));
				return;
			}

			resolve({
				multisig: false,
				count
			});
		}
	});
}
