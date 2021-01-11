const ejs = require('ejs');
const providerEnv = require('../config/wrapper.env');
const { R, src, dist } = require('./paths');
const { isValidSemVer, compareSemVer } = require('semver-parser');

const CheckVersion = (target) => {
  let envVersion = process.env.APP_VERSION;

  if (target === 'chrome' && envVersion) {
    if (!isValidSemVer(envVersion, true) || compareSemVer(envVersion, '2.0.0') < 0) {
      throw 'Chrome version must > 2.0.0';
    }
  }

  if (target === 'firefox' && envVersion) {
    if (
      !isValidSemVer(envVersion, true) ||
      compareSemVer(envVersion, '2.0.0') > 0 ||
      compareSemVer(envVersion, '0.8.0') < 0
    ) {
      throw 'Firefox version must <= 2.0.0 and > 0.8.0';
    }
  }
};

const COMM_PATTERNS = [
  { from: R(src, 'icons'), to: R(dist, 'icons'), globOptions: { ignore: ['**/icon.xcf'] } },
  { from: R(src, 'share'), to: R(dist, 'share') },
  { from: R(src, 'popup/popup.html'), to: R(dist, 'popup/popup.html'), transform: transformHtml },
  {
    from: R(src, 'leechcrx', 'leech.html'),
    to: R(dist, 'leech/leech.html'),
    transform: transformHtml,
  },
  {
    from: R(src, 'options/options.html'),
    to: R(dist, 'options/options.html'),
    transform: transformHtml,
  },
];

function transformHtml(content) {
  return ejs.render(content.toString(), Object.assign({}, { ...providerEnv.env }, providerEnv));
}

/**
 *
 */
module.exports = {
  COMM_PATTERNS,
  transformHtml,
  CheckVersion,
};
