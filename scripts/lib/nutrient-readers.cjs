'use strict';
const fs = require('node:fs');
const zlib = require('node:zlib');

function xmlText(text) {
  return text.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (_, code, name) => {
    if (code) return String.fromCodePoint(code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code));
    return {amp:'&', lt:'<', gt:'>', quot:'"', apos:"'"}[name.toLowerCase()];
  });
}

// XLSX is a ZIP container. Read the central directory so data descriptors do not
// affect entry boundaries. Only the two methods used by the pinned files apply.
function zipEntries(buffer) {
  let end = buffer.length - 22;
  while (end >= Math.max(0, buffer.length - 65557) && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < Math.max(0, buffer.length - 65557)) throw Error('ZIP end directory missing');
  const count = buffer.readUInt16LE(end + 10), entries = new Map();
  let cursor = buffer.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw Error('Invalid ZIP directory');
    const method = buffer.readUInt16LE(cursor + 10), size = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28), extra = buffer.readUInt16LE(cursor + 30), comment = buffer.readUInt16LE(cursor + 32);
    const offset = buffer.readUInt32LE(cursor + 42), name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    entries.set(name, () => {
      if (buffer.readUInt32LE(offset) !== 0x04034b50) throw Error('Invalid ZIP local entry');
      const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
      const data = buffer.subarray(start, start + size);
      if (method === 0) return data.toString('utf8');
      if (method === 8) return zlib.inflateRawSync(data).toString('utf8');
      throw Error('Unsupported ZIP compression ' + method);
    });
    cursor += 46 + nameLength + extra + comment;
  }
  return entries;
}

function textRuns(xml) {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => xmlText(m[1])).join('');
}

function readXlsx(file, sheetName) {
  const entries = zipEntries(fs.readFileSync(file));
  const shared = entries.has('xl/sharedStrings.xml')
    ? [...entries.get('xl/sharedStrings.xml')().matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m => textRuns(m[1])) : [];
  let sheetPath = 'xl/worksheets/sheet1.xml';
  if (sheetName !== undefined) {
    const workbook = entries.get('xl/workbook.xml')?.(), relations = entries.get('xl/_rels/workbook.xml.rels')?.();
    const sheets = [...(workbook || '').matchAll(/<sheet\b([^>]*?)\/?\s*>/g)];
    const attributes = text => Object.fromEntries([...text.matchAll(/([\w:]+)="([^"]*)"/g)].map(m => [m[1],xmlText(m[2])]));
    const selected = sheets.map(m => attributes(m[1])).find(a => a.name === sheetName);
    const relation = [...(relations || '').matchAll(/<Relationship\b([^>]*?)\/?\s*>/g)].map(m => attributes(m[1])).find(a => a.Id === selected?.['r:id']);
    if (!selected || !relation || !/^\/?(?:xl\/)?worksheets\/sheet\d+\.xml$/.test(relation.Target)) throw Error('XLSX worksheet missing: ' + sheetName);
    sheetPath = relation.Target.replace(/^\/?(?:xl\/)?/, 'xl/');
  }
  const sheet = entries.get(sheetPath);
  if (!sheet) throw Error('First XLSX worksheet missing: ' + file);
  const rows = [];
  for (const row of sheet().matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+)\d+"/.exec(cell[1]);
      if (!ref) throw Error('XLSX cell without coordinate');
      let column = 0;
      for (const letter of ref[1]) column = column * 26 + letter.charCodeAt(0) - 64;
      const type = /\bt="([^"]+)"/.exec(cell[1])?.[1], body = cell[2] || '';
      const raw = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = raw === undefined ? null : xmlText(raw);
      if (type === 's') value = shared[Number(raw)];
      else if (type === 'inlineStr') value = textRuns(body);
      else if (type === undefined && raw !== undefined) value = raw.trim() === '' ? null : Number(raw);
      cells[column - 1] = value;
    }
    rows.push(cells);
  }
  return rows;
}

// Quoted fields can contain commas, escaped quotes and line breaks.
function* csvRows(text) {
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(field.replace(/\r$/, '')); field = '';
      if (char === '\n') { yield row; row = []; }
    } else field += char;
  }
  if (quoted) throw Error('Unterminated CSV quoted field');
  if (field || row.length) { row.push(field.replace(/\r$/, '')); yield row; }
}

function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string' || !/^\s*\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?\s*$/.test(value)) return null;
  const result = Number(value.trim().replace(',', '.'));
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function formatNumber(value, precision = 5) {
  if (!Number.isFinite(value) || value < 0) throw Error('Invalid nutrient number');
  if (value === 0) return '0';
  const [mantissa, exponentText] = value.toPrecision(precision).split('e');
  if (exponentText === undefined) return mantissa.includes('.') ? mantissa.replace(/0+$/, '').replace(/\.$/, '') : mantissa;
  const digits = mantissa.replace('.', ''), point = 1 + Number(exponentText);
  let plain;
  if (point <= 0) plain = '0.' + '0'.repeat(-point) + digits;
  else if (point >= digits.length) plain = digits + '0'.repeat(point - digits.length);
  else plain = digits.slice(0, point) + '.' + digits.slice(point);
  return plain.includes('.') ? plain.replace(/0+$/, '').replace(/\.$/, '') : plain;
}

function shardFor(key) {
  let hash = 0x811c9dc5;
  for (const byte of Buffer.from(key, 'utf8')) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return hash % 64;
}

module.exports = {readXlsx, csvRows, numeric, formatNumber, shardFor};
