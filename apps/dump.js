const cmdlineParser = require('./common/cmdline_parser');
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
	if (cmdlineParser.askingHelp()) {
		console.log('Use: dump.js parameters');
		console.log('');
		console.log('Where \'parameters\' are:');
		console.log('  --input {FILENAME} : File with transactions to show.');
		console.log('  --from {NUMBER}    : First transaction index. Starts at 1.');
		console.log('  --to {NUMBER}      : Last transaction index.');
		console.log('  --index {NUMBER}   : Dumps a single transaction located at the specified index.');
		return;
	}

	let options = await parseCmdLineParams();

	let txs = await tools.storage.loadTransactionsFromFile(options.input);
	if (options.first > txs.length) {
		throw new Error('NOTHING TO DUMP!!!');
	}
	if ((!options.last) || options.last > txs.length) {
		options.last = txs.length;
	}

	for (let idx = options.first; idx <= options.last; idx++) {
		print_tx(txs[idx - 1], idx);
	}
}

function parseCmdLineParams() {
	return new Promise((resolve, reject) => {
		let options = {};

		try {
			options.input = cmdlineParser.getFilename('input');

			options.first = cmdlineParser.getUint('index', { optional: true, min: 1 });
			options.last = null;
			if (options.first !== null) {
				options.last = options.first;
			}
			else {
				options.first = cmdlineParser.getUint('from', { optional: true, min: 1 });
				if (options.first === null) {
					options.first = 1;
				}

				options.last = cmdlineParser.getUint('from', { optional: true, min: options.first });
			}
		}
		catch (err) {
			reject(err);
			return;
		}

		resolve(options);
	});
}

function print_tx(tx, tx_idx) {
	let sender;

	if (typeof tx.txn !== 'object') {
		console.log('Unknown object stored');
		return;
	}

	console.log('Algorand transaction #' + tx_idx.toString() + ': [TX-ID: ' + tools.tx.getTxID(tx) + ']');
	if (typeof tx.txn.type === 'string') {
		console.log('  Type:', tx.txn.type);

		if (typeof tx.txn.fee != 'undefined') {
			console.log('  Fee:', tx.txn.fee);
		}
		if (typeof tx.txn.fv != 'undefined') {
			console.log('  First round:', tx.txn.fv);
		}
		if (typeof tx.txn.lv != 'undefined') {
			console.log('  Last round:', tx.txn.lv);
		}
		if (typeof tx.txn.snd != 'undefined') {
			sender = tools.addresses.encode(tx.txn.snd);
			console.log('  Sender address:', sender);
		}

		if (tx.txn.type === 'pay') {
			if (typeof tx.txn.rcv != 'undefined') {
				console.log('  Receiver address:', tools.addresses.encode(tx.txn.rcv));
			}
			if (typeof tx.txn.amt != 'undefined') {
				console.log('  Amount:', tx.txn.amt);
			}
			if (typeof tx.txn.close != 'undefined') {
				console.log('  Close address:', tools.addresses.encode(tx.txn.close));
			}
		}
		else if (tx.txn.type == 'keyreg') {
			if (typeof tx.txn.votekey != 'undefined') {
				console.log('  Vote key:', tx.txn.votekey.toString('base64'));
			}
			if (typeof tx.txn.selkey != 'undefined' && Buffer.isBuffer(tx.txn.selkey)) {
				console.log('  Select key:', tx.txn.selkey.toString('base64'));
			}
			if (typeof tx.txn.votefst != 'undefined') {
				console.log('  Vote first:', tx.txn.votefst);
			}
			if (typeof tx.txn.votelst != 'undefined') {
				console.log('  Vote last:', tx.txn.votelst);
			}
			if (typeof tx.txn.votevotekdlst != 'undefined') {
				console.log('  Vote key dilution:', tx.txn.votekd);
			}
		}
		else if (tx.txn.type == 'acfg') {
			if (typeof tx.txn.caid != 'undefined') {
				console.log('  Asset ID:', tx.txn.caid);
			}
			if (typeof tx.txn.apar != 'undefined') {
				if (typeof tx.txn.apar.m != 'undefined' && Buffer.isBuffer(tx.txn.apar.m)) {
					console.log('  Manager address:', tools.addresses.encode(tx.txn.apar.m));
				}
				if (typeof tx.txn.apar.r != 'undefined' && Buffer.isBuffer(tx.txn.apar.r)) {
					console.log('  Reserve address:', tools.addresses.encode(tx.txn.apar.r));
				}
				if (typeof tx.txn.apar.f != 'undefined' && Buffer.isBuffer(tx.txn.apar.f)) {
					console.log('  Freeze address:', tools.addresses.encode(tx.txn.apar.f));
				}
				if (typeof tx.txn.apar.c != 'undefined' && Buffer.isBuffer(tx.txn.apar.c)) {
					console.log('  Clawback address:', tools.addresses.encode(tx.txn.apar.c));
				}
				if (typeof tx.txn.apar.am != 'undefined' && Buffer.isBuffer(tx.txn.apar.am)) {
					console.log('  Metahash data:', tx.txn.apar.am.toString('base64'));
				}
				if (typeof tx.txn.apar.t != 'undefined') {
					console.log('  Total amount:', tx.txn.apar.t);
				}
				if (typeof tx.txn.apar.an == 'string' && tx.txn.apar.an.length > 0) {
					console.log('  Name:', tx.txn.apar.an);
				}
				if (typeof tx.txn.apar.un == 'string' && tx.txn.apar.un.length > 0) {
					console.log('  Unit name:', tx.txn.apar.un);
				}
				if (typeof tx.txn.apar.au == 'string' && tx.txn.apar.au.length > 0) {
					console.log('  Url:', tx.txn.apar.au);
				}
				if (typeof tx.txn.apar.df != 'undefined') {
					console.log('  Default frozen:', tx.txn.apar.df ? 'TRUE' : 'FALSE');
				}
			}
		}
		else if (tx.txn.type == 'afrz') {
			if (typeof tx.txn.faid != 'undefined') {
				console.log('  Asset ID:', tx.txn.faid);
			}
			if (typeof tx.txn.fadd != 'undefined' && Buffer.isBuffer(tx.txn.fadd)) {
				console.log('  Freeze address:', tools.addresses.encode(tx.txn.fadd));
			}
			if (typeof tx.txn.afrz != 'undefined') {
				console.log('  Freeze state:', tx.txn.afrz ? 'TRUE' : 'FALSE');
			}
		}
		else if (tx.txn.type == 'axfer') {
			if (typeof tx.txn.xaid != 'undefined') {
				console.log('  Asset ID:', tx.txn.xaid);
			}
			if (typeof tx.txn.arcv != 'undefined' && Buffer.isBuffer(tx.txn.arcv)) {
				console.log('  Receiver address:', tools.addresses.encode(tx.txn.arcv));
			}
			if (typeof tx.txn.aamt != 'undefined') {
				console.log('  Amount:', tx.txn.aamt);
			}
			if (typeof tx.txn.aclose != 'undefined' && Buffer.isBuffer(tx.txn.aclose)) {
				console.log('  Close address:', tools.addresses.encode(tx.txn.aclose));
			}
			if (typeof tx.txn.asnd != 'undefined' && Buffer.isBuffer(tx.txn.asnd)) {
				console.log('  Revocation address:', tools.addresses.encode(tx.txn.asnd));
			}
		}

		if (typeof tx.txn.note != 'undefined' && Buffer.isBuffer(tx.txn.note)) {
			console.log('  Note:', tools.utils.buffer2string(tx.txn.note, 32));
		}
		if (typeof tx.txn.lx != 'undefined' && Buffer.isBuffer(tx.txn.lx)) {
			console.log('  Lease:', tools.utils.buffer2string(tx.txn.lx, 32));
		}
		if (typeof tx.txn.gen != 'undefined') {
			console.log('  Genesis ID:', tx.txn.gen);
		}
		if (typeof tx.txn.gh != 'undefined' && Buffer.isBuffer(tx.txn.snd)) {
			console.log('  Genesis hash:', tx.txn.gh.toString('base64'));
		}
		if (typeof tx.txn.group != 'undefined' && Buffer.isBuffer(tx.txn.group)) {
			console.log('  Group:', tx.txn.group.toString('base64'));
		}
	}

	if (typeof tx.sig != 'undefined' && Buffer.isBuffer(tx.sig)) {
		let valid_msg = tools.sign.verifySignature(tx, tx.sig, sender) ? '(VALID)' : '(INVALID!!!!)';

		console.log('  Algorand Signature:');
		console.log('    Sign:', tools.utils.buffer2string(tx.sig, 64), valid_msg);
	}

	if (typeof tx.msig != 'undefined') {
		console.log('  Algorand Multi-Signature:');

		if (typeof tx.msig.v != 'undefined') {
			console.log('    Version:', tx.msig.v);
		}
		if (typeof tx.msig.thr != 'undefined') {
			console.log('    Threshold:', tx.msig.thr);
		}

		if (typeof tx.msig.subsig != 'undefined') {
			console.log('    Signatures:');
			for (let idx = 0; idx < tx.msig.subsig.length; idx++) {
				let address;

				console.log('      Signer #' + (idx + 1).toString() + ':');
				if (typeof tx.msig.subsig[idx].pk != 'undefined') {
					address = tools.addresses.encode(tx.msig.subsig[idx].pk);
					console.log('        Address:', address);
				}
				if (typeof tx.msig.subsig[idx].s != 'undefined' && Buffer.isBuffer(tx.msig.subsig[idx].s)) {
					let valid_msg = tools.sign.verifySignature(tx, tx.msig.subsig[idx].s, address) ? '(VALID)' : '(INVALID!!!!)';

					console.log('        Sign:', tools.utils.buffer2string(tx.msig.subsig[idx].s, 64), valid_msg);
				}
			}
		}

		if (sender && typeof tx.msig.thr != 'undefined' && typeof tx.msig.subsig != 'undefined') {
			let addresses = [];

			for (let idx = 0; idx < tx.msig.subsig.length; idx++) {
				if (typeof tx.msig.subsig[idx].pk != 'undefined') {
					addresses.push(tools.addresses.encode(tx.msig.subsig[idx].pk));
				}
			}
			if (sender == tools.addresses.generateMultisig(addresses, tx.msig.thr)) {
				console.log('    Signers MATCH sender');
			}
			else {
				console.log('    WARNING: Signers seems to mismatch sender');
			}
		}
		else {
			console.log('    Unable to verify if signers belong to sender');
		}
	}
}
