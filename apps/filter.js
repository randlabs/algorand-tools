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
		console.log('Use: filter.js parameters filters');
		console.log('');
		console.log('Where \'parameters\' are:');
		console.log('  --input {FILENAME}  : File with transactions to filter.');
		console.log('  --output {FILENAME} : File with filtered transactions.');
		console.log('');
		console.log('And \'filters\' are:');
		console.log('  --genesis-id {STRING}               : Include transactions with the specified genesis id. Wildcards accepted.');
		console.log('  --not-genesis-id {STRING}           : Include transactions with genesis id different than the specified. ' +
					'Wildcards accepted.');
		console.log('  --from {ADDRESS}                    : Include transactions coming from the specified address.');
		console.log('  --not-from {ADDRESS}                : Include transactions coming from an address different than the specified.');
		console.log('  --to {ADDRESS}                      : Include transactions sent to the specified address.');
		console.log('  --not-to {ADDRESS}                  : Include transactions sent to a different address from the specified.');
		console.log('  --#COMPARATOR#-amount {NUMBER}      : Include transactions where transaction\'s amount fullfills the specified ' +
					'comparator condition.');
		console.log('  --#COMPARATOR#-fee {NUMBER}         : Include transactions where transaction\'s fees fullfills the specified ' +
					'comparator condition.');
		console.log('  --#COMPARATOR#-first-round {NUMBER} : Include transactions where transaction\'s first round fullfills the ' +
					'specified comparator condition.');
		console.log('  --#COMPARATOR#-last-round {NUMBER}  : Include transactions where transaction\'s last round  fullfills the ' +
					'specified comparator condition.');
		console.log('');
		console.log('And \'COMPARATOR\' can be: less, less-equal, equal, not-equal, greater, greater-equal');
		console.log('  I.e.: ---less-equal-amount 2000 includes all txs where the amount is less or equal to 2000 microalgos.');
		return;
	}

	let options = await parseCmdLineParams();

	let txs = await tools.storage.loadTransactionsFromFile(options.input);

	let filters = setupFilters(options);
	if (filters.length == 0) {
		throw new Error('ERROR: No filters were specified.');
	}

	let indexes = [];
	for (let tx_idx = 0; tx_idx < txs.length; tx_idx++) {
		let tx_info = tools.tx.getInfo(txs[tx_idx]);

		let include = true;
		for (let filter of filters) {
			if (filter(tx_info) == false) {
				include = false;
				break;
			}
		}

		if (include) {
			indexes.push(tx_idx);
		}
	}

	let filtered_txs = indexes.map((tx_idx) => {
		return txs[tx_idx];
	});

	await tools.storage.saveTransactionsToFile(options.output, filtered_txs);
}

function parseCmdLineParams() {
	return new Promise((resolve, reject) => {
		const comparators = [ 'less', 'less-equal', 'equal', 'not-equal', 'greater', 'greater-equal' ];
		let options = {};

		try {
			options.input = cmdlineParser.getFilename('input');

			options.output = cmdlineParser.getFilename('output');

			options.filter_genesis_id = cmdlineParser.getString('genesis-id', { optional: true });
			if (options.filter_genesis_id !== null) {
				options.filter_genesis_id = tools.utils.globStringToRegex(options.filter_genesis_id);
			}

			options.filter_not_genesis_id = cmdlineParser.getString('not-genesis-id', { optional: true });
			if (options.filter_not_genesis_id !== null) {
				options.filter_not_genesis_id = tools.utils.globStringToRegex(options.filter_not_genesis_id);
			}

			options.filter_from = cmdlineParser.getAddress('from', { optional: true });

			options.filter_not_from = cmdlineParser.getAddress('not-from', { optional: true });

			options.filter_to = cmdlineParser.getAddress('to', { optional: true });

			options.filter_not_to = cmdlineParser.getAddress('not-to', { optional: true });

			for (let comparator of comparators) {
				let filter_name;

				filter_name = 'filter_' + comparator.replace('-', '_') + '_amount';
				options[filter_name] = cmdlineParser.getUint(comparator + '-amount', { optional: true });

				filter_name = 'filter_' + comparator.replace('-', '_') + '_fee';
				options[filter_name] = cmdlineParser.getUint(comparator + '-fee', { optional: true, min: 1 });

				filter_name = 'filter_' + comparator.replace('-', '_') + '_first_round';
				options[filter_name] = cmdlineParser.getUint(comparator + '-first-round', { optional: true, min: 1 });

				filter_name = 'filter_' + comparator.replace('-', '_') + '_last_round';
				options[filter_name] = cmdlineParser.getUint(comparator + '-last-round', { optional: true, min: 1 });
			}
		}
		catch (err) {
			reject(err);
			return;
		}

		resolve(options);
	});
}

function setupFilters(options) {
	let filters = [];

	if (options.filter_genesis_id) {
		filters.push(function (tx_info) {
			return (options.filter_genesis_id.test(tx_info.genesis_id));
		});
	}
	if (options.filter_not_genesis_id) {
		filters.push(function (tx_info) {
			return (!options.filter_not_genesis_id.test(tx_info.genesis_id));
		});
	}

	if (options.filter_from) {
		filters.push(function (tx_info) {
			return (tx_info.from == options.filter_from);
		});
	}
	if (options.filter_not_from) {
		filters.push(function (tx_info) {
			return (tx_info.from != options.filter_not_from);
		});
	}

	if (options.filter_to) {
		filters.push(function (tx_info) {
			return (tx_info.to != options.filter_to);
		});
	}
	if (options.filter_not_to) {
		filters.push(function (tx_info) {
			return (tx_info.to != options.filter_not_to);
		});
	}

	let checks = setupFiltersAddComparator('amount', options);
	for (let check of checks) {
		filters.push(function (tx_info) {
			return check(tx_info.amount);
		});
	}

	checks = setupFiltersAddComparator('fee', options);
	for (let check of checks) {
		filters.push(function (tx_info) {
			return check(tx_info.fee);
		});
	}

	checks = setupFiltersAddComparator('first_round', options);
	for (let check of checks) {
		filters.push(function (tx_info) {
			return check(tx_info.first_round);
		});
	}

	checks = setupFiltersAddComparator('last_round', options);
	for (let check of checks) {
		filters.push(function (tx_info) {
			return check(tx_info.last_round);
		});
	}

	return filters;
}

function setupFiltersAddComparator(filter_name, options) {
	let checks = [];

	if (options['filter_less_' + filter_name] !== null) {
		let compare_value = options['filter_less_' + filter_name];
		checks.push(function (value) {
			return (value < compare_value);
		});
	}

	if (options['filter_less_equal_' + filter_name] !== null) {
		let compare_value = options['filter_less_equal_' + filter_name];
		checks.push(function (value) {
			return (value <= compare_value);
		});
	}

	if (options['filter_greater_' + filter_name] !== null) {
		let compare_value = options['filter_greater_' + filter_name];
		checks.push(function (value) {
			return (value > compare_value);
		});
	}

	if (options['filter_greater_equal_' + filter_name] !== null) {
		let compare_value = options['filter_greater_equal_' + filter_name];
		checks.push(function (value) {
			return (value >= compare_value);
		});
	}

	if (options['filter_equal_' + filter_name] !== null) {
		let compare_value = options['filter_equal_' + filter_name];
		checks.push(function (value) {
			return (value == compare_value);
		});
	}

	if (options['filter_not_equal_' + filter_name] !== null) {
		let compare_value = options['filter_not_equal_' + filter_name];
		checks.push(function (value) {
			return (value != compare_value);
		});
	}

	return checks;
}
