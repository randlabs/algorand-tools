const cmdline = require('node-cmdline-parser');
const utils = require('../lib/helpers/utils');
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
		console.log("  --output filename.tx         : Transaction output filename");
		console.log("  --source filename.tx         : File for taking txs to merge");
		console.log("  --merge-signatures {Boolean} : Merge signatures");
		return;
	}
	let options = await parseCmdLineParams();

	let file_list = tools.utils.getFileList(options.source.folder, options.source.filemask);

	let txs = [];
	for (let file of file_list) {
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
			output = utils.normalizeFilename(output);
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
		let source = {
			folder: filemask.substr(0, idx + 1),
			filemask: filemask.substr(idx + 1)
		};
		if (source.folder.indexOf('*') >= 0 || source.folder.indexOf('?') >= 0) {
			reject(new Error("ERROR: Wildcards are not allowed in the folder part of the '--source' parameter."));
			return;
		}
		try {
			source.folder = utils.normalizeFolder(source.folder);
		}
		catch (err) {
			reject(err);
			return;
		}
		if (source.folder.length == 0) {
			reject(new Error("ERROR: Invalid value in '--filemask' parameter."));
			return;
		}
		if (source.filemask.length == 0) {
			source.filemask = '*.tx';
		}
		source.filemask = utils.globStringToRegex(source.filemask);

		let mergesignatures = cmdline.keyexists('merge-signatures');

		resolve({
			output,
			source,
			mergesignatures
		});
	});
}
