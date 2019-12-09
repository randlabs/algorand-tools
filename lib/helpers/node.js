const process = require('process');
const fetch = require('node-fetch');
const cmdline = require('node-cmdline-parser');
const algosdk = require('algosdk');
const utils = require('./utils');

//------------------------------------------------------------------------------

let genesis_cache = {
	last_used_url_and_token: {
		base_url: '',
		api_token: ''
	},
	hash: '',
	id: ''
};
let node_base_url = '';
let node_api_token = '';

//------------------------------------------------------------------------------

class NodeError extends Error {
	constructor(message, statusCode) {
		super(message);
		this.name = 'NodeError';
		this.statusCode = statusCode;
	}
}

async function getGenesisInfo(url, api_token) {
	let node_settings = getBaseUrlAndApiToken(url, api_token);

	if (genesis_cache.hash.length == 0 || genesis_cache.id.length == 0 ||
			genesis_cache.last_used_url_and_token.base_url != node_settings.base_url ||
			genesis_cache.last_used_url_and_token.api_token != node_settings.api_token) {

		let json = await queryNode(node_settings, 'v1/transactions/params');
		genesis_cache.last_used_url_and_token.base_url = node_settings.base_url;
		genesis_cache.last_used_url_and_token.api_token = node_settings.api_token;
		genesis_cache.hash = json.genesishashb64;
		genesis_cache.id = json.genesisID;
	}

	return {
		hash: genesis_cache.hash,
		id: genesis_cache.id
	};
}

function setConfig(options) {
	let new_url, new_api_token;

	if (typeof options !== 'object') {
		throw new Error('Invalid options (node).');
	}
	if (typeof options.url !== 'undefined') {
		if (!isValidNodeUrl(options.url)) {
			throw new Error('Invalid url (node).');
		}
		new_url = options.url;
		if (!new_url.endsWith('/')) {
			new_url += '/';
		}
	}
	if (typeof options.api_token !== 'undefined') {
		if (!isValidNodeApiToken(options.api_token)) {
			throw new Error('Invalid api token (node).');
		}
		new_api_token = options.api_token;
	}

	if (new_url) {
		node_base_url = new_url;
	}
	if (new_api_token) {
		node_api_token = new_api_token;
	}
}

async function getLastRound(url, api_token) {
	let node_settings = getBaseUrlAndApiToken(url, api_token);
	let json = await queryNode(node_settings, 'v1/status');
	return json.lastRound;
}

async function sendTransaction(tx, url, api_token) {
	if (!(utils.isObject(tx) && utils.isObject(tx.txn))) {
		throw new Error('Invalid tx (node).');
	}

	let node_settings = getBaseUrlAndApiToken(url, api_token);

	let queryOpts = {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/x-binary',
			'X-Algo-API-Token': node_settings.api_token
		},
		body: algosdk.encodeObj(tx)
	};

	let response = await fetch(node_settings.base_url + 'v1/transactions', queryOpts);
	if (response.status != 200) {
		let text;

		try {
			text = await response.text();
		}
		catch (err) {
			//keep ESLint happy
		}
		if (typeof text !== 'string' || text.length == 0) {
			text = 'Unsuccessful response from node.';
		}
		throw new NodeError(text + ' [Status: ' + response.status.toString() + ']', response.status);
	}
	let json = await response.json();
	return json.txId;
}

function getBaseUrlAndApiToken(base_url, api_token) {
	if (typeof base_url === 'undefined' || base_url === null || (typeof base_url === 'string' && base_url.length == 0)) {
		if (node_base_url.length > 0) {
			base_url = node_base_url;
		}
		else {
			base_url = cmdline.get('node-url');
			if (base_url === null) {
				base_url = process.env.ALGOTOOLS_NODE_URL;
			}
		}

	}
	if (!isValidNodeUrl(base_url)) {
		throw new Error('Invalid url (node).');
	}
	if (!base_url.endsWith('/')) {
		base_url += '/';
	}

	if (typeof api_token === 'undefined' || api_token === null || (typeof api_token === 'string' && api_token.length == 0)) {
		if (node_api_token.length > 0) {
			api_token = node_api_token;
		}
		else {
			api_token = cmdline.get('node-api-token');
			if (api_token === null) {
				api_token = process.env.ALGOTOOLS_NODE_API_TOKEN;
			}
		}
	}
	if (!isValidNodeApiToken(api_token)) {
		throw new Error('Invalid api token (node).');
	}

	if (node_base_url.length == 0) {
		node_base_url = base_url;
	}
	if (node_api_token.length == 0) {
		node_api_token = api_token;
	}

	return {
		base_url,
		api_token
	};
}

async function queryNode(node_settings, url) {
	let queryOpts = {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'X-Algo-API-Token': node_settings.api_token
		}
	};

	let response = await fetch(node_settings.base_url + url, queryOpts);
	if (response.status != 200) {
		throw new NodeError('Unsuccessful response from node. [Status: ' + response.status.toString() + ']', response.status);
	}
	let json = await response.json();
	return json;
}

function isValidNodeUrl(url) {
	// eslint-disable-next-line prefer-named-capture-group
	return (typeof url === 'string' && (/^http(s)?:\/\/[^:?#=/]+(:\d+)?\/?$/ui).test(url));
}

function isValidNodeApiToken(api_token) {
	return (typeof api_token === 'string' && (/[0-9a-f]{64}/ui).test(api_token));
}

module.exports = {
	NodeError,
	setConfig,
	getGenesisInfo,
	getLastRound,
	sendTransaction
};
