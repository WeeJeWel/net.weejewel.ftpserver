'use strict';

const fs = require('fs/promises');
const path = require('path');

module.exports = {
  async getFile({ homey, query }) {
    const filepath = path.join(homey.app.dir, query.path);
    const filedata = await fs.readFile(filepath, 'utf8');
    return filedata;
  },
  async getStatus({ homey }) {
    return homey.app.getStatus();
  },
};
