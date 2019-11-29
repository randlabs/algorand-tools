const cmdline = require('node-cmdline-parser');
const msgpack = require('msgpack-lite');
const tools = require('../../index');

//------------------------------------------------------------------------------

function askingHelp() {
	return cmdline.keyexists('help');
}

function getString(paramName, options) {
	let value = cmdline.get(paramName);
	if (value === null) {
		if (options && options.optional) {
			return null;
		}
		throw new Error('ERROR: Missing  \'--' + paramName + '\' parameter.');
	}

	value = value.trim();
	if (value.length == 0) {
		throw new Error('ERROR: Missing value in \'--' + paramName + '\' parameter.');
	}

	return value;
}

function getAddress(paramName, options) {
	let value = cmdline.get(paramName);
	if (value === null) {
		if (options && options.optional) {
			return null;
		}
		throw new Error('ERROR: Missing  \'--' + paramName + '\' parameter.');
	}

	if (value.length == 0) {
		throw new Error('ERROR: Missing value in \'--' + paramName + '\' parameter.');
	}

	value = value.toUpperCase().trim();
	if (!tools.addresses.isValid(value)) {
		throw new Error('ERROR: Invalid address in \'--' + paramName + '\' parameter.');
	}

	return value;
}

function getAddressList(paramName, options) {
	let value = cmdline.get(paramName);
	if (value === null) {
		if (options && options.optional) {
			return null;
		}
		throw new Error('ERROR: Missing  \'--' + paramName + '\' parameter.');
	}

	if (value.length == 0) {
		throw new Error('ERROR: Missing value in \'--' + paramName + '\' parameter.');
	}

	value = value.toUpperCase().split(',');
	if (value.length == 0) {
		throw new Error('ERROR: No address specified in \'--' + paramName + '\' parameter.');
	}

	for (let i = 0; i < value.length; i++) {
		value[i] = value[i].trim();
		if (!tools.addresses.isValid(value[i])) {
			throw new Error('ERROR: Invalid address in \'--' + paramName + '\' parameter.');
		}
	}

	return value;
}

function getUint(paramName, options) {
	let value = cmdline.get(paramName);
	if (value === null) {
		if (options && options.optional) {
			return null;
		}
		throw new Error('ERROR: Missing  \'--' + paramName + '\' parameter.');
	}

	value = parseInt(value.trim(), 10);
	if (Number.isNaN(value)) {
		throw new Error('ERROR: Invalid value in \'--' + paramName + '\' parameter.');
	}

	if (!tools.utils.isInteger(value)) {
		throw new Error('ERROR: Invalid value in \'--' + paramName + '\' parameter.');
	}

	const min = (options && typeof options.min != 'undefined') ? options.min : 0;
	if (options && typeof options.max != 'undefined') {
		if (value < min || value > options.max) {
			throw new Error('ERROR: Value in \'--' + paramName + '\' parameter must be between ' + min.toString() + ' and ' +
								options.max.toString() + '.');
		}
	}
	else {
		if (value < min) {
			throw new Error('ERROR: Value in \'--' + paramName + '\' parameter must be greater or equal to ' + min.toString() + '.');
		}
	}

	return value;
}

function getBoolean(paramName, options) {
	let value = cmdline.get(paramName);
	if (value === null) {
		if (options && options.optional) {
			return null;
		}
		throw new Error('ERROR: Missing  \'--' + paramName + '\' parameter.');
	}

	value = value.trim().toLowerCase();
	if (value == 'no' || value == '0' || value == 'false' || value == 'off') {
		value = false;
	}
	else if (value == 'yes' || value == '1' || value == 'true' || value == 'on') {
		value = true;
	}
	else {
		throw new Error('ERROR: Invalid boolean value in \'--' + paramName + '\' parameter.');
	}

	return value;
}

function getFilename(paramName, options) {
	let value = cmdline.get(paramName);
	if (value === null) {
		if (options && options.optional) {
			return null;
		}
		throw new Error('ERROR: Missing  \'--' + paramName + '\' parameter.');
	}

	value = tools.utils.normalizeFilename(value);
	if (value.length == 0) {
		throw new Error('ERROR: Invalid filename in \'--' + paramName + '\' parameter.');
	}
	return value;
}

function getFilesByFilemask(paramName, options) {
	let idx, idx2;

	let value = cmdline.get(paramName);
	if (value === null) {
		if (options && options.optional) {
			return null;
		}
		throw new Error('ERROR: Missing  \'--' + paramName + '\' parameter.');
	}

	idx = value.lastIndexOf('/');
	idx2 = value.lastIndexOf('\\');
	if (idx2 > idx) {
		idx = idx2;
	}

	value = {
		folder: value.substr(0, idx + 1),
		filemask: value.substr(idx + 1)
	};
	if (value.folder.indexOf('*') >= 0 || value.folder.indexOf('?') >= 0) {
		throw new Error('ERROR: Wildcards are not allowed in the folder part of the \'--' + paramName + '\' parameter.');
	}

	value.folder = tools.utils.normalizeFilename(value.folder);
	if (value.length == 0) {
		throw new Error('ERROR: Invalid filename in \'--' + paramName + '\' parameter.');
	}

	if (value.filemask.length == 0) {
		value.filemask = '*.tx';
	}

	if (!(options && options.leaveFilemask)) {
		value = tools.utils.getFileList(value.folder, value.filemask);
	}

	return value;
}

function getMnemonic(paramName, options) {
	let value = cmdline.get(paramName);
	if (value === null) {
		if (options && options.optional) {
			return null;
		}
		throw new Error('ERROR: Missing  \'--' + paramName + '\' parameter.');
	}

	if (value.length == 0) {
		throw new Error('ERROR: Missing value in \'--' + paramName + '\' parameter.');
	}

	value = value.toLowerCase();

	let decoded = tools.mnemonics.isValid(value);
	if (decoded === null) {
		throw new Error('ERROR: Invalid mnemonic in \'--' + paramName + '\' parameter.');
	}

	if (!(options && options.dontDecode)) {
		value = decoded;
	}

	return value;
}

function getRound(paramName, options) {
	let isRelative = false;

	let value = cmdline.get(paramName);
	if (value === null) {
		if (options && options.optional) {
			return null;
		}
		throw new Error('ERROR: Missing  \'--' + paramName + '\' parameter.');
	}

	value = value.trim();
	if (value.startsWith('+')) {
		value = value.substr(1);
		isRelative = true;
	}

	value = parseInt(value.trim(), 10);
	if (Number.isNaN(value)) {
		throw new Error('ERROR: Invalid value in \'--' + paramName + '\' parameter.');
	}

	if (!tools.utils.isInteger(value)) {
		throw new Error('ERROR: Invalid value in \'--' + paramName + '\' parameter.');
	}

	if (value < 1) {
		throw new Error('ERROR: Value in \'--' + paramName + '\' parameter must be greater or equal to 1.');
	}

	return {
		round: value,
		isRelative
	};
}

function getBuffer(paramName, options) {
	let value = cmdline.get(paramName);
	if (value === null) {
		if (options && options.optional) {
			return null;
		}
		throw new Error('ERROR: Missing  \'--' + paramName + '\' parameter.');
	}

	value = value.trim();
	if (value.length == 0) {
		throw new Error('ERROR: Missing value in \'--' + paramName + '\' parameter.');
	}

	let value_type = '';
	if (value.substr(0, 2).toLowerCase() == '0x') {
		value_type = 'hex';
	}
	else if (value.substr(0, 1) == '{' || value.substr(0, 1) == '[') {
		value_type = 'json';
	}
	else {
		if ((value.length % 2) == 0 && (/[0-9A-F]/iu).test(value)) {
			value_type = 'hex';
		}
		else {
			value_type = 'base64';
		}
	}
	if (value_type == 'json') {
		try {
			const obj = JSON.parse(value);
			value = Buffer.from(msgpack.encode(obj));
		}
		catch (err) {
			throw new Error('ERROR: Invalid value in \'--' + paramName + '\' parameter.');
		}
	}
	else {
		try {
			value = Buffer.from(value, value_type);
		}
		catch (err) {
			throw new Error('ERROR: Invalid value in \'--' + paramName + '\' parameter.');
		}
	}
	if (value.length == 0) {
		throw new Error('ERROR: Invalid value in \'--' + paramName + '\' parameter.');
	}

	return value;
}

function paramIsPresent(paramName) {
	return cmdline.keyexists(paramName);
}

module.exports = {
	askingHelp,
	getString,
	getAddress,
	getAddressList,
	getUint,
	getBoolean,
	getFilename,
	getFilesByFilemask,
	getMnemonic,
	getRound,
	getBuffer,
	paramIsPresent
};
