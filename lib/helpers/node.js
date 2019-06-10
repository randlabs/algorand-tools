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

//------------------------------------------------------------------------------

class NodeError extends Error {
	constructor(message, statusCode) {
		super(message);
		this.name = "NodeError";
		this.statusCode = statusCode;
	}
}

async function getGenesisInfo(url, api_token) {
	let node_settings = getBaseUrlAndApiToken(url, api_token);

	if (genesis_cache.hash.length == 0 || genesis_cache.id.length == 0 ||
			genesis_cache.last_used_url_and_token.base_url != node_settings.base_url ||
			genesis_cache.last_used_url_and_token.api_token != node_settings.api_token) {

		let json = await queryNode(node_settings, "v1/transactions/params");
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

async function getLastRound(url, api_token) {
	let node_settings = getBaseUrlAndApiToken(url, api_token);
	let json = await queryNode(node_settings, "v1/status");
	return json.lastRound;
}

async function sendTransaction(tx, url, api_token) {
	if (!(utils.isObject(tx) && utils.isObject(tx.txn))) {
		throw new Error("Invalid tx (node).");
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

	let response = await fetch(node_settings.base_url + "v1/transactions", queryOpts);
	if (response.status != 200) {
		throw new NodeError('Unsuccessful response from node. [Status: ' + response.status.toString() + ']', response.status);
	}
	let json = await response.json();
	return json.txId;
}

function getBaseUrlAndApiToken(base_url, api_token) {
	if (typeof base_url === 'undefined') {
		base_url = cmdline.get('node-url');
		if (base_url === null) {
			base_url = process.env.ALGOTOOLS_NODE_URL;
		}
	}
	if (typeof base_url !== 'string' || (!(base_url.startsWith('http://') || base_url.startsWith('https://')))) {
		throw new Error("Invalid url (node).");
	}

	if (typeof api_token === 'undefined') {
		api_token = cmdline.get('node-api-token');
		if (api_token === null) {
			api_token = process.env.ALGOTOOLS_NODE_API_TOKEN;
		}
	}
	if (typeof api_token !== 'string' || api_token.length == 0) {
		throw new Error("Invalid api token (node).");
	}

	if (!base_url.endsWith('/')) {
		base_url += '/';
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
		throw new NodeError('Unsuccessful response from node.', response.status);
	}
	let json = await response.json();
	return json;
}

module.exports = {
	NodeError,
	getGenesisInfo,
	getLastRound,
	sendTransaction
};
