const algosdk = require('algosdk');

//------------------------------------------------------------------------------

/**
 * Check if a mnemonic is valid
 * 
 * @param {String} mnemonic String of 25 algorand words
 * @returns {Boolean}
 */


function isValid(mnemonic) {
	return decode(mnemonic) !== null;
}

/**
 * Returns an account from a mnemonic
 * 
 * @param {String} mnemonic String of 25 algorand words
 * @returns {Object} Account
 */

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
