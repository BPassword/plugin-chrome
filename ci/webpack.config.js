'use strict';
const CopyPlugin = require('copy-webpack-plugin');
const ExtensionReloader = require('webpack-extension-reloader');
const chalk = require('chalk');
const merge = require('webpack-merge');
const webpack = require('webpack');

/*********************************************************************
 * AircraftClass ::
 *    @description:
 *    @description:
 * WARNINGS:
 *
 * HISTORY:
 *    @author: lanbery@gmail.com
 *    @created:  2020-12-25
 *    @comments:
 **********************************************************************/

const { dist, src, manifest, R } = require('./paths');
const { CheckVersion } = require('./copy-utils');
const config = require('../config');

/**
 * Make sure build on Firefox
 * 1. set EXT_TARGET
 * 2. mixin env
 * 3. load baseConfig
 */
const providerEnv = require('../config/wrapper.env');
const baseConfig = require('./webpack.base');

console.log('Locale ENV:', chalk.cyanBright(JSON.stringify(providerEnv, '/n', 2)));

CheckVersion(providerEnv.EXT_TARGET);

const isDev = providerEnv.NODE_ENV === 'development';

// controller manifest import js
const isProd = providerEnv.NODE_ENV === 'production';

const crxManifest = require('../src/manifest-chrome.json');

let crxConfig = merge(baseConfig, {
  target: 'web',
  mode: providerEnv.NODE_ENV,
  entry: {
    'leech/leech': R(src, 'leechcrx/leech.js'),
    contentscript: R(src, 'inpage/index.js'),
    'inpage/chanel5': R(src, 'inpage/chanel-five.js'),
    'inpage/cape7': R(src, 'inpage/cape-seven.js'),
    'inpage/top-injet': R(src, 'inpage/crx/top-injet.js'),
    'inpage/sub-injet': R(src, 'inpage/crx/sub-injet.js'),
  },
  plugins: [
    new webpack.DefinePlugin({
      __EXT_TARGET__: '"chrome"',
    }),
    new CopyPlugin({
      patterns: [
        {
          from: manifest,
          to: R(dist, 'manifest.json'),
          transform: (content) => {
            let jsonContent = JSON.parse(content);
            jsonContent.name = providerEnv.APP_NAME;
            jsonContent.version = providerEnv.APP_VERSION;

            console.log('Current version:', chalk.red(jsonContent.version));

            jsonContent.author = providerEnv.APP_AUTHOR || '';
            jsonContent = { ...jsonContent, ...crxManifest };
            if (isDev) {
              jsonContent['content_security_policy'] =
                "script-src 'self' 'unsafe-eval'; object-src 'self';";
            } else {
            }

            return JSON.stringify(jsonContent, null, 2);
          },
        },
      ],
    }),
  ],
});

if (process.env.HMR === 'true') {
  crxConfig.plugins = (crxConfig.plugins || []).concat([
    new ExtensionReloader({
      port: 9528,
      manifest: manifest,
      reloadPage: true,
      entries: {
        contentScript: ['contentscript', 'inpage/top-injet', 'inpage/sub-injet'],
        background: 'background',
      },
      extensionPage: ['popup/popup.html'],
    }),
  ]);
}

module.exports = crxConfig;
