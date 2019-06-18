const algosdk = require('algosdk');
const algosdk_address = require("algosdk/src/encoding/address");
const utils = require('./helpers/utils');

//------------------------------------------------------------------------------

function isValid(address) {
	if (typeof address !== 'string' || address.length == 0) {
		return false;
	}
	return algosdk.isValidAddress(address.toUpperCase());
}

function encode(public_key) {
	return algosdk_address.encode(public_key);
}

function decode(address) {
	address = address.toUpperCase();
	return algosdk_address.decode(address).publicKey;
}

function generate() {
	let addr = algosdk.generateAccount();

	return {
		address: addr.addr,
		mnemonic: algosdk.secretKeyToMnemonic(addr.sk)
	};
}

function generateMultisig(addresses, required) {
	if (!Array.isArray(addresses)) {
		throw new Error("Invalid parameter.");
	}
	for (let addr of addresses) {
		if (!isValid(addr)) {
			throw new Error("Invalid parameter.");
		}
	}
	if ((!utils.isInteger(required)) || required < 1 || required > addresses.length) {
		throw new Error("Required signatures is less than one or greater than the number of addresses.");
	}
	const params = {
		version: 1,
		threshold: required,
		addrs: addresses
	};
	return algosdk.multisigAddress(params);
}

module.exports = {
	isValid,
	encode,
	decode,
	generate,
	generateMultisig
};
