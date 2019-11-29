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
	let tx;

	if (cmdlineParser.askingHelp()) {
		console.log('Use: build.js parameters [options]');
		console.log('');
		console.log('Where \'parameters\' are:');
		console.log('  --output {FILENAME}       : Transaction file to create.');
		console.log('  --from {ADDRESS}          : Sender address.');
		console.log('  --to {ADDRESS}            : Receiver address. Can be ommited if a close account is specified.');
		console.log('  --amount {NUMBER}         : Amount to send in microalgos.');
		console.log('  --fee {NUMBER}            : Fees to pay (the value is multiplied by the transaction size unless `--fixed-fee` ' +
					'is specified).');
		console.log('  --first-round [+]{NUMBER} : First round where the transaction should be sent. Use +NUMBER to calculate the ' +
					'round based on the network\'s current round.');
		console.log('');
		console.log('And \'options\' are:');
		console.log('  --note {BASE64-STRING}                      : Note to add.');
		console.log('  --last-round [+]{NUMBER}                    : Last round where the transaction should be sent. Defaults to ' +
					'1000 after first round. Use +NUMBER to calculate the round based on the network\'s current round.');
		console.log('  --close {ADDRESS}                           : Close address. Remaining account funds will be transferred to ' +
					'this address.');
		console.log('  --genesis-hash {BASE64-STRING}              : Network\'s genesis hash. Retrieved from network if not specified.');
		console.log('  --genesis-id {STRING}                       : Network\'s genesis ID. Retrieved from network if not stated.');
		console.log('  --multisig-threshold {NUMBER}               : Required signatures for a multsig account template.');
		console.log('  --multisig-addresses {ADDRESS[,ADDRESS...]} : A comma separated list of addresses that make up the multisig ' +
					'account template.');
		console.log('  --fixed-fee                                 : Sets the fee as a fixed value (does not multiply fee by the size ' +
					'of the transaction).');
		console.log('  --node-url http://address:port              : Node\'s url if an access to the network is required. If not ' +
					'specified the ALGOTOOLS_NODE_URL environment variable is used.');
		console.log('  --node-api-token {TOKEN}                    : Node\'s api token if an access to network is required. If not ' +
					'specified the `ALGOTOOLS_NODE_API_TOKEN` environment variable is used.');
		return;
	}

	let options = await parseCmdLineParams();

	if (options.first_round < 0 || (typeof options.last_round !== 'undefined' && options.last_round < 0)) {
		let round = await tools.node.getLastRound();

		if (options.first_round < 0) {
			options.first_round = round + (-options.first_round);
		}
		if (typeof options.last_round !== 'undefined' && options.last_round < 0) {
			options.last_round = round + (-options.last_round);
		}
	}

	const tx_options = {
		from: options.from_address,
		to: options.to_address,
		amount: options.amount,
		fee: options.fee,
		fixed_fee: options.fixed_fee,
		first_round: options.first_round,
		last_round: options.last_round,
		close: options.close_address,
		genesis_hash: options.genesis_hash,
		genesis_id: options.genesis_id,
		note: options.note
	};

	if (options.tx_type == 'keyreg') {
		tx = await tools.tx.createKeyregTransaction(tx_options);
	}
	else if (options.tx_type == 'asset-config') {
		if (options.asset_id === null) {
			tx = await tools.tx.createAssetCreationTransaction(tx_options);
		}
		else if (options.asset_manager || options.asset_reserve || options.asset_freeze || options.asset_clawback) {
			tx = await tools.tx.createAssetConfigurationTransaction(tx_options);
		}
		else {
			tx = await tools.tx.createAssetDestructionTransaction(tx_options);
		}
	}
	else if (options.tx_type == 'asset-freeze') {
		tx = await tools.tx.createAssetFreezeTransaction(tx_options);
	}
	else {
		if (options.asset_id === null) {
			tx = await tools.tx.createPaymentTransaction(tx_options);
		}
		else {
			tx = await tools.tx.createAssetTransferTransaction(tx_options);
		}
	}

	if (options.multisig_threshold && options.multisig_addresses) {
		tools.sign.addSignatureTemplate(tx, options.multisig_threshold, options.multisig_addresses);
	}

	await tools.storage.saveTransactionsToFile(options.output, [ tx ]);
	console.log('Generated transaction ID: ' + tools.tx.getTxID(tx));
}

function parseCmdLineParams() {
	return new Promise((resolve, reject) => {
		let options = {};

		try {
			options.output = cmdlineParser.getFilesByFilemask('output');

			options.tx_type = cmdlineParser.getString('type', { optional: true });
			if (options.tx_type !== null) {
				options.tx_type = options.tx_type.toLowerCase();
				if (options.tx_type != 'pay' && options.tx_type != 'keyreg' && options.tx_type != 'asset-config' &&
						options.tx_type != 'asset-freeze') {
					throw new Error('ERROR: Invalid value in \'--type\' parameter.');
				}
			}
			else {
				//guess
				options.tx_type = 'pay'; //assume default

				if (cmdlineParser.paramIsPresent('vote-key') || cmdlineParser.paramIsPresent('sel-key') ||
						cmdlineParser.paramIsPresent('vote-first-round') || cmdlineParser.paramIsPresent('vote-last-round') ||
						cmdlineParser.paramIsPresent('vote-key-dilution')) {
					options.tx_type = 'keyreg';
				}
				else if (cmdlineParser.paramIsPresent('account') || cmdlineParser.paramIsPresent('state')) {
					options.tx_type = 'asset-freeze';
				}
				else if (cmdlineParser.paramIsPresent('manager') || cmdlineParser.paramIsPresent('reserve') ||
						cmdlineParser.paramIsPresent('freeze') || cmdlineParser.paramIsPresent('clawback')) {
					options.tx_type = 'asset-config';
				}
			}

			options.from = cmdlineParser.getAddress('from', { optional: cmdlineParser.paramIsPresent('multisig-addresses') });

			if (options.tx_type == 'pay' || options.tx_type == 'asset-config' || options.tx_type == 'asset-freeze') {
				options.asset_id = cmdlineParser.getUint('asset-id', { optional: true, min: 1 });
			}

			if (options.tx_type == 'pay') {
				options.to = cmdlineParser.getAddress('to', { optional: cmdlineParser.paramIsPresent('close') });

				options.close = cmdlineParser.getAddress('close', { optional: true });

				options.amount = cmdlineParser.getUint('amount');

				if (options.asset_id !== null) {
					options.revocation_address = cmdlineParser.getAddress('revocation', { optional: true });
				}
			}

			if (options.tx_type == 'keyreg') {
				options.vote_key = cmdlineParser.getString('vote-key', { optional: true });

				options.selection_key = cmdlineParser.getString('sel-key', { optional: true });

				options.vote_first = cmdlineParser.getRound('vote-first-round', { optional: true });

				options.vote_last = cmdlineParser.getRound('vote-last-round', { optional: true });

				options.vote_key_dilution = cmdlineParser.getString('vote-key-dilution', { optional: true });
			}

			if (options.tx_type == 'asset-config') {
				options.asset_manager = cmdlineParser.getAddress('manager', { optional: true });

				options.asset_reserve = cmdlineParser.getAddress('reserve', { optional: true });

				options.asset_freeze = cmdlineParser.getAddress('freeze', { optional: true });

				options.asset_clawback = cmdlineParser.getAddress('clawback', { optional: true });

				if (options.asset_id === null) {
					options.asset_metahash_data = cmdlineParser.getString('metahash-data', { optional: true });

					options.asset_name = cmdlineParser.getString('name', { optional: true });

					options.asset_unit_name = cmdlineParser.getString('units-name', { optional: true });

					options.asset_url = cmdlineParser.getString('url', { optional: true });

					options.asset_total = cmdlineParser.getUint('total');

					options.asset_default_frozen = cmdlineParser.getBoolean('default-frozen', { optional: true });
					if (options.asset_default_frozen === null) {
						options.asset_default_frozen = false;
					}
				}
			}

			if (options.tx_type == 'asset-freeze') {
				if (options.asset_id === null) {
					throw new Error('ERROR: Missing  \'--asset-id\' parameter.');
				}

				options.freeze_account = cmdlineParser.getAddress('account');

				options.freeze_state = cmdlineParser.getBoolean('state');
			}

			options.fee = cmdlineParser.getUint('fee', { optional: true, min: 1000 });
			if (options.fee === null) {
				options.fee = 1000;
			}

			options.fixed_fee = cmdlineParser.paramIsPresent('fixed-fee');

			options.first_round = cmdlineParser.getRound('first-round');

			options.last_round = cmdlineParser.getRound('last-round', { optional: true });
			if (options.last_round === null) {
				options.last_round = {
					round: options.first_round.round + 1000,
					isRelative: options.first_round.isRelative
				};
			}
			else {
				if (options.first_round.isRelative == options.last_round.isRelative) {
					if (options.first_last.round < options.first_round.round) {
						throw new Error('ERROR: Round specified in \'--last-round\' is lower than the one specified in \'--first-round\'.');
					}
				}
			}

			options.genesis_hash = cmdlineParser.getBuffer('genesis-hash', { optional: true });

			options.genesis_id = cmdlineParser.getString('genesis-id', { optional: true });

			options.note = cmdlineParser.getBuffer('note', { optional: true });

			options.lease = cmdlineParser.getBuffer('lease', { optional: true });

			options.multisig_threshold = cmdlineParser.getUint('multisig-threshold', { optional: true, min: 1 });
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

			if (options.multisig_addresses) {
				let multisig_addr = tools.addresses.generateMultisig(options.multisig_addresses, options.multisig_threshold);
				if (!options.from) {
					options.from = multisig_addr;
				}
				else if (options.from != multisig_addr) {
					throw new Error('ERROR: Sender address is not related to the multisig addresses.');
				}
			}
		}
		catch (err) {
			reject(err);
			return;
		}

		resolve(options);
	});
}
