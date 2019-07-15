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

//------------------------------------------------------------------------------

async function main() {
	if (cmdline.keyexists("help")) {
		console.log("Use: merge.js parameters");
		console.log("");
		console.log("Where 'parameters' are:");
		console.log("  --source {FILENAME} or {FOLDERNAME} : Folder and/or file with transactions to merge. Wildcards accepted on filename.");
		console.log("  --output {FILENAME}                 : File to store the merged transactions.");
		console.log("  --merge-signatures                  : Merge signatures if two or more transactions matches. If this flag is not set, transactions are just concatenated.");
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

	if (options.mergesignatures) {
		tools.sign.mergeSignatures(txs);
	}

	await tools.storage.saveTransactionsToFile(options.output, txs);
}

function parseCmdLineParams() {
	return new Promise((resolve, reject) => {
		let idx, idx2;

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

		let filemask = cmdline.get('source');
		if (filemask === null) {
			reject(new Error("ERROR: Missing value in '--source' parameter."));
			return;
		}
		idx = filemask.lastIndexOf('/');
		idx2 = filemask.lastIndexOf('\\');
		if (idx2 > idx) {
			idx = idx2;
		}
		let _source = {
			folder: filemask.substr(0, idx + 1),
			filemask: filemask.substr(idx + 1)
		};
		if (_source.folder.indexOf('*') >= 0 || _source.folder.indexOf('?') >= 0) {
			reject(new Error("ERROR: Wildcards are not allowed in the folder part of the '--source' parameter."));
			return;
		}
		try {
			_source.folder = tools.utils.normalizeFolder(_source.folder);
		}
		catch (err) {
			reject(err);
			return;
		}
		if (_source.folder.length == 0) {
			reject(new Error("ERROR: Invalid value in '--source' parameter."));
			return;
		}
		if (_source.filemask.length == 0) {
			_source.filemask = '*.tx';
		}
		let source = tools.utils.getFileList(_source.folder, _source.filemask);

		let mergesignatures = cmdline.keyexists('merge-signatures');

		resolve({
			output,
			source,
			mergesignatures
		});
	});
}
