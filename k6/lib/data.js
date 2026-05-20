/**
 * k6 Test Data Utilities — random generators and data helpers.
 * Compatible with k6 v0.49 (ES2015 only).
 */

var CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
var FIRST = ['Alice','Bob','Carol','Dave','Eve','Frank','Grace','Hank','Iris','Jack','Karen','Leo','Mia','Ned','Olivia','Pete'];
var LAST  = ['Smith','Jones','Brown','Davis','Wilson','Taylor','Clark','Lewis','Walker','Hall','Allen','Young','King','Wright','Scott','Green'];

export function randomString(length) {
  length = length || 8;
  var result = '';
  for (var i = 0; i < length; i++) result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  return result;
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomEmail(domain) {
  return 'user_' + randomString(6) + '@' + (domain || 'test.com');
}

export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickMany(arr, n) {
  var copy = arr.slice();
  copy.sort(function() { return Math.random() - 0.5; });
  return copy.slice(0, n);
}

export function randomName() {
  return pickRandom(FIRST) + ' ' + pickRandom(LAST);
}

export function feeder(items) {
  var index = 0;
  return {
    next: function() { var item = items[index % items.length]; index++; return item; },
    length: items.length,
  };
}

export function buildPayload(template) {
  var result = {};
  var keys = Object.keys(template);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    result[key] = typeof template[key] === 'function' ? template[key]() : template[key];
  }
  return result;
}
