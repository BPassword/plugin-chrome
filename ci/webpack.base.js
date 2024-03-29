'use strict';
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const VuetifyLoaderPlugin = require('vuetify-loader/lib/plugin');
const MomentLocalesPlugin = require('moment-locales-webpack-plugin');

const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
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
 *    @comments: Update refer BPassword
 **********************************************************************/
const { context, dist, src, manifest, R, ROOT_PATH } = require('./paths');
const providerEnv = require('../config/wrapper.env');

const isDev = providerEnv.NODE_ENV === 'development';

const config = require('../config');
const { COMM_PATTERNS } = require('./copy-utils');

let baseConfig = {
  context: context,
  entry: {
    background: R(src, 'background.js'),
    'popup/popup': R(src, 'popup/popup.js'),
  },
  output: {
    path: dist,
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.js', '.vue'],
    alias: {
      '@': src,
      '@lib': R(src, 'libs'),
      '@ui': R(src, 'ui'),
      '@p3': R(src, 'popup'),
    },
  },
  optimization: {
    minimize: true,
    splitChunks: {
      chunks: 'all',
      automaticNameDelimiter: '_',
      name: true,
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          chunks: 'all',
          minChunks: 1,
          minSize: 0,
          priority: -10,
          reuseExistingChunk: true,
        },
        commons: {
          chunks: 'initial',
          minChunks: 2,
          name: 'commons',
          maxInitialRequests: 5,
          minSize: 0, //默认是30kb，minSize设置为0之后,多次引用的会被压缩到commons中
        },
        'ui-vuetify': {
          test: (module) => {
            return /vuetify|@mdi/.test(module.context);
          },
          chunks: 'initial',
          name: 'ui-vuetify',
          priority: 11,
        },
        'ui-vues': {
          test: (module) => {
            return /vue|vuex|vue-i18n|vue-router/.test(module.context);
          },
          chunks: 'initial',
          name: 'ui-vues',
          priority: 10,
        },
      },
    },
  },
  externals: {
    // lodash: {
    //   commonjs: "lodash",
    //   amd: "lodash",
    //   root: "_" // 指向全局变量
    // },
    web3: 'Web3',
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: [/node_modules/],
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.sass$/,
        use: [
          'vue-style-loader',
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              implementation: require('sass'),
              sassOptions: {
                fiber: require('fibers'),
                indentedSyntax: true,
              },
              additionalData: "@import '@/styles/variables.scss'",
            },
          },
        ],
      },
      {
        test: /\.scss$/,
        // use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
        use: [
          'vue-style-loader',
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              implementation: require('sass'),
              sassOptions: {
                fiber: require('fibers'),
                indentedSyntax: true,
              },
              additionalData: "@import '@/styles/variables.scss';",
            },
          },
        ],
      },
      {
        test: /\.(png|jpg|jpeg|gif|ico)$/,
        loader: 'file-loader',
        options: {
          name: '[path][name].[ext]',
          outputPath: '/images/',
          emitFile: true,
          esModule: false,
        },
      },
      {
        test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        loader: 'file-loader',
        options: {
          name: '[path][name].[ext]',
          outputPath: '/fonts/',
          emitFile: true,
          esModule: false,
        },
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      global: 'window',
      __EXT_TARGET__: JSON.stringify(providerEnv.EXT_TARGET),
      __EXT_NAME__: JSON.stringify(providerEnv.APP_NAME),
      __EXT_VERION__: JSON.stringify(providerEnv.APP_VERSION),
      __INFURA_PRO_ID__: JSON.stringify(providerEnv.INFURA_PROJECTID || ''),
      __INFURA_PRO_SECRET__: JSON.stringify(providerEnv.INFURA_SECRET || ''),
      'process.env.APP_NAME': JSON.stringify(providerEnv.APP_NAME),
    }),
    new webpack.IgnorePlugin(/^\.\/wordlists\/(?!english)/, /bip39\/src$/),
    new VueLoaderPlugin(),
    new MiniCssExtractPlugin({
      filename: '[name].css',
      chunkFilename: '[name].css',
    }),
    new CopyPlugin({
      patterns: [...COMM_PATTERNS],
    }),
    new VuetifyLoaderPlugin({
      match(originalTag, { kebabTag, camelTag, path, component }) {
        if (kebabTag.startsWith('core-')) {
          return [
            camelTag,
            `import ${camelTag} from '@/components/core/${camelTag.substring(4)}.vue'`,
          ];
        }
      },
    }),
    new MomentLocalesPlugin(),
  ],
};

if (isDev) {
  baseConfig.devtool = config.devtool;
  baseConfig.plugins = (baseConfig.plugins || []).concat([
    new webpack.DefinePlugin({
      __LOG_LEVEL__: JSON.stringify(providerEnv.LOG_LEVEL || 'DEBUG'),
      __DEV_PASS__: JSON.stringify(providerEnv.DEV_PASS || ''),
      'process.env.NODE_ENV': '"development"',
    }),
    new BundleAnalyzerPlugin({
      analyzerPort: 8999,
      reportFilename: R('dist'),
      generateStatsFile: true,
    }),
  ]);
} else {
  baseConfig.plugins = (baseConfig.plugins || []).concat([
    new webpack.DefinePlugin({
      __LOG_LEVEL__: JSON.stringify(providerEnv.LOG_LEVEL || 'WARN'),
      'process.env.NODE_ENV': '"production"',
    }),
  ]);
}

module.exports = baseConfig;
