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

//------------------------------------------------------------------------------

async function main() {
	if (cmdlineParser.askingHelp()) {
		console.log('Use: merge.js parameters');
		console.log('');
		console.log('Where \'parameters\' are:');
		console.log('  --source {FILENAME} or {FOLDERNAME} : Folder and/or file with transactions to merge. Wildcards accepted on ' +
					'filename.');
		console.log('  --output {FILENAME}                 : File to store the merged transactions.');
		console.log('  --merge-signatures                  : Merge signatures if two or more transactions matches. If this flag is not ' +
					'set, transactions are just concatenated.');
		return;
	}

	let options = await parseCmdLineParams();

	let txs = [];
	for (let file of options.source) {
		let _txs = await tools.storage.loadTransactionsFromFile(file);

		txs = txs.concat(_txs);
	}
	if (txs.length == 0) {
		throw new Error('Nothing to process');
	}

	if (options.merge_signatures) {
		tools.sign.mergeSignatures(txs);
	}

	await tools.storage.saveTransactionsToFile(options.output, txs);
}

function parseCmdLineParams() {
	return new Promise((resolve, reject) => {
		let options = {};

		try {
			options.output = cmdlineParser.getFilename('output');

			options.source = cmdlineParser.getFilesByFilemask('source');

			options.merge_signatures = cmdlineParser.paramIsPresent('merge-signatures');
		}
		catch (err) {
			reject(err);
			return;
		}

		resolve(options);
	});
}
