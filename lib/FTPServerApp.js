'use strict';

const path = require('path');
const crypto = require('crypto');

const Homey = require('homey');
const FtpSrv = require('ftp-srv');
const express = require('express');
const fse = require('fs-extra');

const PORT_FTP = 2100;
const PORT_FTP_MIN = 2101;
const PORT_FTP_MAX = 2109;
const PORT_HTTP = 8000;

module.exports = class FTPServerApp extends Homey.App {

  async onInit() {
    // Place all userdata, to prevent public hosting
    const secureId = await Promise.resolve().then(async () => {
      let secureId = await this.homey.settings.get('secureId');
      if (!secureId) {
        secureId = crypto.randomBytes(24).toString('hex');
        await this.homey.settings.set('secureId', secureId);
      }

      return secureId;
    });

    // Ensure Users
    const users = await this.homey.settings.get('users');
    if (!users) {
      await this.homey.settings.set('users', {
        // Model:
        // [userId]: {
        //   username: String,
        //   password: String,
        //   root: String,
        // },
      });
    }

    // Ensure Dirs
    const dir = `/userdata/${secureId}/`;
    await fse.ensureDir(dir);

    // Get Local Address
    const localIp = await this.getLocalIp();

    // Start FTP Server
    this.ftpServer = new FtpSrv({
      url: `ftp://0.0.0.0:${PORT_FTP}`,
      pasv_url: `${localIp}`,
      pasv_min: PORT_FTP_MIN,
      pasv_max: PORT_FTP_MAX,
      greeting: 'Welcome to the Homey Pro FTP Server!',
    });

    this.ftpServer.on('login', ({
      username,
      password,
    }, resolve, reject) => {
      Promise.resolve().then(async () => {
        // Get users
        const users = await this.homey.settings.get('users');
        const user = Object.values(users).find((user) => user.username === username);

        // Validate user
        if (!user) {
          return reject(new FtpSrv.ftpErrors.GeneralError('Invalid username', 401));
        }

        if (user.password !== password) {
          return reject(new FtpSrv.ftpErrors.GeneralError('Invalid password', 401));
        }

        // User's root folder
        const root = path.join(dir, user.root);
        await fse.ensureDir(root);

        return { root };
      })
        .then(resolve)
        .catch(reject);
    });

    this.ftpServer.listen().then(() => {
      this.log(`FTP Server listening on http://0.0.0.0:${PORT_FTP}`);
    });

    // Start HTTP Server
    this.httpServer = express();
    this.httpServer.use(express.static(dir));
    this.httpServer.listen(PORT_HTTP, () => {
      this.log(`HTTP Server listening on http://0.0.0.0:${PORT_HTTP}`);
    });
  }

  async getLocalIp() {
    const localAddress = await this.homey.cloud.getLocalAddress();
    const [localIp] = localAddress.split(':');
    return localIp;
  }

  async getStatus() {
    const localIp = await this.getLocalIp();

    return {
      localIp,
      portFtp: PORT_FTP,
      portHttp: PORT_HTTP,
    };
  }

};
