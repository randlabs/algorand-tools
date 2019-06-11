const algosdk = require('algosdk');

//------------------------------------------------------------------------------

function isValid(mnemonic) {
	return decode(mnemonic) !== null;
}

function decode(mnemonic) {
	if (typeof mnemonic !== 'string') {
		return null;
	}

	mnemonic = mnemonic.toLowerCase();
	try {
		let pair = algosdk.mnemonicToSecretKey(mnemonic);
		return {
			address: pair.addr,
			secret_key: pair.sk
		};
	}
	catch (err) {
		return null;
	}
}

module.exports = {
	isValid,
	decode
};
