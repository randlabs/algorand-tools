const process = require('process');
const fetch = require('node-fetch');
const cmdline = require('node-cmdline-parser');

//------------------------------------------------------------------------------

class NodeError extends Error {
	constructor(message, statusCode) {
		super(message);
		this.name = "NodeError";
		this.statusCode = statusCode;
	}
}

async function getTxParams(url, api_token) {
	let json = await queryNode(url, "/v1/transactions/params", api_token);
	return json;
}

async function queryNode(base_url, url, api_token) {
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

	if (base_url.endsWith('/'))
		url = base_url.substr(0, base_url.length - 1) + url;
	else
		url = base_url + url;

	let queryOpts = {
		method: 'GET',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'X-Algo-API-Token': api_token,
		}
	};

	let response = await fetch(url, queryOpts);
	if (response.status != 200) {
		throw new NodeError('Unsuccessful response from node.', response.status);
	}
	let json = await response.json();
	return json;
}

module.exports = {
	NodeError,
	getTxParams
};
