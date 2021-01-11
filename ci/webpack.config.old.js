const webpack = require('webpack');
const ejs = require('ejs');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const ExtensionReloader = require('webpack-extension-reloader');
const { VueLoaderPlugin } = require('vue-loader');
const VuetifyLoaderPlugin = require('vuetify-loader/lib/plugin');
const { context, dist, src, manifest, R, ROOT_PATH } = require('./paths');

const providerEnv = require('../config/wrapper.env');

const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';
const isPre = Boolean(process.env.BUILD_PRE);

const config = {
  mode: process.env.NODE_ENV,
  context: context,
  entry: {
    background: R(src, './background.js'),
    'options/options': R(src, './options/options.js'),
    'popup/popup': R(src, './popup/popup.js'),
    'inpage/chanel5': R(src, 'inpage/chanel-five.js'),
    'inpage/cape7': R(src, 'inpage/cape-seven.js'),
    contentscript: R(src, 'inpage/index.js'),
    'inpage/top-injet': R(src, 'inpage/crx/top-injet.js'),
    'inpage/sub-injet': R(src, 'inpage/crx/sub-injet.js'),
    'leech/leech': R(src, 'leechcrx/leech.js'),
    // 'p2/leech': R(src, './attch/leech.js'),
    // 'p2/p2': R(src, './pager/pager.js'),
    // 'notifications/notify': R(src, './notifications/notify.js'),
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
      '@p3': R(src, 'popup'),
      '@ui': R(src, 'ui'),
    },
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
        test: /\.(png|jpg|jpeg|gif|svg|ico)$/,
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
    }),
    new webpack.IgnorePlugin(/^\.\/wordlists\/(?!english)/, /bip39\/src$/),
    new VueLoaderPlugin(),
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
    new CopyPlugin({
      patterns: buildCopyPatterns(),
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
  ],
};

if (config.mode === 'production') {
  config.plugins = (config.plugins || []).concat([
    new webpack.DefinePlugin({
      __LOG_LEVEL__: JSON.stringify(providerEnv.LOG_LEVEL),
      __EXT_NAME__: JSON.stringify(providerEnv.APP_NAME),
      __EXT_VERION__: JSON.stringify(providerEnv.APP_VERSION),
      'process.env.NODE_ENV': '"production"',
      'process.env.APP_NAME': JSON.stringify(providerEnv.APP_NAME),
    }),
  ]);
} else {
  config.plugins = (config.plugins || []).concat([
    new webpack.DefinePlugin({
      __LOG_LEVEL__: JSON.stringify(providerEnv.LOG_LEVEL),
      __EXT_NAME__: JSON.stringify(providerEnv.APP_NAME),
      __EXT_VERION__: JSON.stringify(providerEnv.APP_VERSION),
      'process.env.NODE_ENV': '"development"',
      'process.env.APP_NAME': JSON.stringify(providerEnv.APP_NAME),
    }),
  ]);
  config.devtool = 'cheap-module-source-map';
}

if (process.env.HMR === 'true') {
  config.plugins = (config.plugins || []).concat([
    new ExtensionReloader({
      port: 9527,
      manifest: manifest,
      reloadPage: !isPre,
      entries: {
        contentScript: ['contentscript', 'inpage/top-injet', 'inpage/sub-injet'],
        background: 'background',
      },
      extensionPage: ['popup'],
    }),
  ]);
}

function transformHtml(content) {
  return ejs.render(content.toString(), Object.assign({}, { ...process.env }, providerEnv));
}

function buildCopyPatterns() {
  const patterns = [
    { from: R(src, 'icons'), to: R(dist, 'icons'), globOptions: { ignore: ['**/icon.xcf'] } },
    { from: R(src, 'popup/popup.html'), to: R(dist, 'popup/popup.html'), transform: transformHtml },
    {
      from: R(src, 'options/options.html'),
      to: R(dist, 'options/options.html'),
      transform: transformHtml,
    },
    {
      from: R(src, 'leechcrx/leech.html'),
      to: R(dist, 'leech/leech.html'),
      transform: transformHtml,
    },
    // { from: R(src, 'pager/index.html'), to: R(dist, 'p2/index.html'), transform: transformHtml }, //
    // {
    //   from: R(src, 'notifications/notify.html'),
    //   to: R(dist, 'notifications/notify.html'),
    //   transform: transformHtml,
    // },
    { from: R(src, 'share'), to: R(dist, 'share') },
    {
      from: manifest,
      to: R(dist, 'manifest.json'),
      transform: (content) => {
        const jsonContent = JSON.parse(content);
        jsonContent.name = providerEnv.APP_NAME;
        jsonContent.version = providerEnv.APP_VERSION;

        if (isDev) {
          jsonContent['content_security_policy'] =
            "script-src 'self' 'unsafe-eval'; object-src 'self'";
        }

        return JSON.stringify(jsonContent, null, 2);
      },
    },
  ];

  const devPatterns = [...patterns];

  return isDev ? devPatterns : patterns;
}

module.exports = config;
