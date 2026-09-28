const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const script = source.match(/<script id="turnover-model">([\s\S]*?)<\/script>/)[1];
module.exports = new Function(script + '\nreturn TurnoverModel;')();
