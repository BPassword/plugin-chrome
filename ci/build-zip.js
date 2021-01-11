#!/usr/bin/env node

const fs = require('fs-extra');

const { R, dist, distzip } = require('./paths');

const archiver = require('archiver');

const DEST_DIR = dist;
const DEST_ZIP_DIR = distzip;

const WrapperEnv = require('../config/wrapper.env');

const extractExtensionData = () => {
  const extPackageJson = require('../package.json');

  return {
    name: WrapperEnv.APP_NAME || extPackageJson.name,
    version: WrapperEnv.APP_VERSION || extPackageJson.version,
  };
};

const makeDestZipDirIfNotExists = () => {
  if (!fs.existsSync(DEST_ZIP_DIR)) {
    fs.mkdirSync(DEST_ZIP_DIR);
  }
};

const buildZip = (src, dest, zipFilename) => {
  console.info(`Building ${zipFilename}...`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = fs.createWriteStream(R(dest, `${zipFilename}.zip`));

  return new Promise((resolve, reject) => {
    archive
      .file(R('dist', 'chrome.crx'), { name: `${zipFilename}.crx` })
      .file(R('dist', 'chrome.pem'), { name: 'key.pem' })
      .directory(src, false)
      .on('error', (err) => reject(err))
      .pipe(stream);

    stream.on('close', () => resolve());
    archive.finalize();
  });
};

const main = () => {
  const { name, version } = extractExtensionData();
  const zipFilename = `${name}-v${version}`;
  // copySecretFiles(name, version);
  makeDestZipDirIfNotExists();

  buildZip(DEST_DIR, DEST_ZIP_DIR, zipFilename)
    .then(() => console.info('OK'))
    .catch(console.err);
};

function copySecretFiles(name, version) {
  fs.copySync(R('dist', 'chrome.crx'), R(dist, `${name}_${version}.crx`));
  fs.copySync(R('dist', 'chrome.pem'), R(dist, 'key.pem'));
}

main();