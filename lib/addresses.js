const path = require('path');
const algosdk = require('algosdk');
let algosdk_basepath = require.resolve('algosdk');
algosdk_basepath = algosdk_basepath.substring(0, algosdk_basepath.lastIndexOf(path.sep));
const algosdk_address = require(algosdk_basepath + "/src/encoding/address");

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
	if (Array.isArray(addresses)) {
		throw new Error("Invalid parameter.");
	}
	if (required < 1 || required > addresses.length) {
		throw new Error("Required signatures is less than one or greater than the number of addresses.");
	}

	return algosdk.multisigAddress({
		version: 1,
		threshold: required,
		addrs: addresses
	});
}

module.exports = {
	isValid,
	encode,
	decode,
	generate,
	generateMultisig
};
