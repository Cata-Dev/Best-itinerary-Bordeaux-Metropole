const util = require('util')
const { bright, bR, fW, bY, fG } = require('./utils/utils')
const origLog = console.log

console.log = function l() {
    const args = util.format.apply(util.format, Array.prototype.slice.call(arguments))
    const str = `[${new Date().toLocaleString('fr-FR')}] `+args
    origLog(str);
};

console.error = function e() {
    const args = util.format.apply(util.format, Array.prototype.slice.call(arguments))
    const str = `[${new Date().toLocaleString('fr-FR')}] `+args
    origLog(bR(bright(fW(str))));
};

console.warn = function w() {
    const args = util.format.apply(util.format, Array.prototype.slice.call(arguments))
    const str = `[${new Date().toLocaleString('fr-FR')}] `+args
    origLog(bY(bright(fW(str))));
};

console.info = function i() {
    const args = util.format.apply(util.format, Array.prototype.slice.call(arguments))
    const str = `[${new Date().toLocaleString('fr-FR')}] `+args
    origLog(bright(fG(str)));
};