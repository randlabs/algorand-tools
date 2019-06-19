const fs = require('fs');
const path = require('path');
const process = require('process');

//------------------------------------------------------------------------------

function globStringToRegex(str) {
	let expr = str.replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\-]', 'gu'), '\\$&');
	return new RegExp(expr.replace(/\\\*/gu, '.*').replace(/\\\?/gu, '.'), 'u');
}

function getFileList(folder, filemask) {
	folder = normalizeFolder(folder);
	let _filemask = globStringToRegex(filemask);

	let files = fs.readdirSync(folder, { withFileTypes: true });

	let list_of_files = [];
	files.forEach(function (file) {
		if (file.isFile()) {
			if (_filemask.test(file.name)) {
				list_of_files.push(folder + file.name);
			}
		}
	});
	return list_of_files;
}

function normalizeFolder(folder) {
	folder = normalizeFilename(folder);
	if (folder.length > 0 && folder.substr(folder.length - 1, 1) != path.sep) {
		folder += path.sep;
	}
	return folder;
}

function normalizeFilename(filename) {
	filename = path.resolve(process.cwd(), filename);
	filename = path.normalize(filename);
	return filename;
}

function buffer2string(buf, max_len) {
	let s = "0x";

	if (buf.length <= max_len) {
		for (let idx = 0; idx < buf.length; idx++) {
			s += ("00" + buf[idx].toString(16)).slice(-2);
		}
	}
	else {
		let this_len = max_len / 2;
		for (let idx = 0; idx < this_len; idx++) {
			s += ("00" + buf[idx].toString(16)).slice(-2);
		}

		s += "...";

		this_len = max_len - this_len;
		for (let idx = 0; idx < this_len; idx++) {
			s += ("00" + buf[buf.length - this_len + idx].toString(16)).slice(-2);
		}
	}
	return s;
}

function isObject(obj) {
	return (typeof obj === 'object' && (!Array.isArray(obj)));
}

function isInteger(n) {
	return (typeof n === 'number' && (n % 1) === 0);
}

module.exports = {
	globStringToRegex,
	getFileList,
	normalizeFolder,
	normalizeFilename,
	buffer2string,
	isObject,
	isInteger
};
