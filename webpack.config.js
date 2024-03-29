const webpack = require("webpack");
const path = require("node:path");
const { merge } = require("webpack-merge");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const DeadCodePlugin = require("webpack-deadcode-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

const environment = {
  APP_VERSION: "1.0.0",
  ENV_NAME: "test",
  ...process.env,
};

const version = environment.APP_VERSION ? ` v ${environment.APP_VERSION}` : "";

const createBaseConfig = () => ({
  devtool: undefined,
  entry: path.resolve(__dirname, "src/index.tsx"),
  output: {
    path: path.resolve(__dirname, "output"),
    filename: "[name].js",
    publicPath: "/",
  },
  module: {
    rules: [
      {
        test: /\.(js|ts)x?$/,
        loader: "babel-loader",
        exclude: /node_modules/,
        resolve: { fullySpecified: false },
        options: {
          presets: [
            ["@babel/preset-env", { debug: true }],
            "@babel/preset-react",
            ["@babel/preset-typescript", { allowNamespaces: true }],
          ],
        },
      },
      {
        test: /\.svg$/,
        use: ["@svgr/webpack"],
      },
    ],
  },
  target: "web",
  plugins: [
    new webpack.ProgressPlugin(),
    new ForkTsCheckerWebpackPlugin(),
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: "src/index.html",
      filename: "index.html",
      inject: "head",
      title: environment.ENV_NAME === "production" ? `App${version}` : `App ${environment.ENV_NAME}${version}`,
      favicon: "src/favicon.ico",
      meta: {
        viewport: "width=device-width, initial-scale=1.0, shrink-to-fit=no",
        "Content-Security-Policy": {
          "http-equiv": "X-UA-Compatible",
          content: "ie=edge",
        },
        charSet: "UTF-8",
      },
    }),
    new CopyWebpackPlugin({
      patterns: [{ from: path.resolve(__dirname, "static"), to: path.resolve(__dirname, "output/static") }],
    }),
    new webpack.DefinePlugin({
      "process.env.APP_VERSION": JSON.stringify(environment.APP_VERSION),
    }),
  ],
  watchOptions: {
    // for some systems, watching many files can result in a lot of CPU or memory usage
    // https://webpack.js.org/configuration/watch/#watchoptionsignored
    // don't use this pattern, if you have a monorepo with linked packages
    ignored: /node_modules/,
  },
  resolve: {
    alias: {
      config: path.join(__dirname, `config/${environment.ENV_NAME}.json`),
    },
    extensions: [".ts", ".tsx", ".js", ".jsx", ",json"],
  },
  optimization: {
    emitOnErrors: true,
    splitChunks: {
      cacheGroups: {
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendors",
          chunks: "all",
        },
      },
    },
  },
});

const createDevelopmentConfig = () => ({
  mode: "development",
  devtool: "source-map",
  bail: true,
  optimization: {
    emitOnErrors: true,
  },
  devServer: {
    port: 8080,
    hot: true,
    historyApiFallback: {
      disableDotRule: true,
    },
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    },
  },
  plugins: [
    new DeadCodePlugin({
      patterns: ["**/src/**/*.(js|jsx|css|ts|tsx)"],
      exclude: ["**/*.(stories|spec|test|d).(js|jsx|ts|tsx)", "storybook", "node_modules", "**/node_modules/", "dist"],
      context: root,
    }),
  ],
  performance: {
    hints: "warning",
    maxAssetSize: 200_000,
    maxEntrypointSize: 400_000,
    assetFilter: function (assetFilename) {
      return assetFilename.endsWith(".css") || assetFilename.endsWith(".js");
    },
  },
});

const createProductionConfig = () => ({
  mode: "production",
  devtool: undefined,
  bail: false,
  optimization: {
    emitOnErrors: false,
    minimize: true,
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: {
      cacheGroups: {
        commons: {
          test: /[/\\]node_modules[/\\]/,
          name: "vendors",
          chunks: "all",
        },
      },
    },
  },
  performance: {
    hints: false,
  },
});

module.exports = merge(
  createBaseConfig(),
  environment.ENV_NAME === "production" ? createProductionConfig() : createDevelopmentConfig()
);
