const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isAnalyze = env && env.analyze;

  const config = {
    entry: './src/main.js',
    
    output: {
      filename: isProduction ? '[name].[contenthash].js' : 'bundle.js',
      chunkFilename: isProduction ? '[name].[contenthash].chunk.js' : '[name].chunk.js',
      path: path.resolve(__dirname, 'dist'),
      clean: true,
      publicPath: './',
    },

    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
              cacheDirectory: true,
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/images/[name].[contenthash][ext]'
          }
        }
      ]
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        filename: 'index.html',
        inject: 'body', // Ensure scripts are injected into body
        minify: isProduction ? {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true,
          useShortDoctype: true,
          removeEmptyAttributes: true,
          removeStyleLinkTypeAttributes: true,
          keepClosingSlash: true,
          minifyJS: true,
          minifyCSS: true,
          minifyURLs: true,
        } : false
      }),
      
      new CopyWebpackPlugin({
        patterns: [
          { 
            from: 'public/assets', 
            to: 'assets',
            noErrorOnMissing: true
          },
          {
            from: 'public/robots.txt',
            to: 'robots.txt',
            noErrorOnMissing: true
          },
          {
            from: 'public/sitemap.xml',
            to: 'sitemap.xml',
            noErrorOnMissing: true
          }
        ]
      })
    ],

    resolve: {
      extensions: ['.js', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    },

    devServer: {
      static: {
        // Using 'dist' directory to serve the built files including the injected bundle.js
        // This aligns with the output.path configuration above (line 18)
        // webpack automatically creates this directory via output.path if it doesn't exist
        // writeToDisk: true below ensures files are written to disk in development
        directory: path.join(__dirname, 'dist'),
        publicPath: '/',
      },
      compress: true,
      port: 8080,
      hot: true,
      historyApiFallback: true,
      devMiddleware: {
        writeToDisk: true, // Write files to disk in development
      },
      // Webpack-cli sets NODE_ENV=development for `webpack serve --mode development`, so we
      // cannot rely on NODE_ENV=test from Playwright. Use DISABLE_WDS_OVERLAY=1 from UAT.
      client: {
        overlay:
          process.env.DISABLE_WDS_OVERLAY === '1' || process.env.NODE_ENV === 'test'
            ? false
            : true
      }
    }
  };

  // Production-specific optimizations
  if (isProduction) {
    config.optimization = {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info', 'console.debug'],
            },
            mangle: {
              safari10: true,
            },
            format: {
              comments: false,
            },
          },
          extractComments: false,
        }),
        new CssMinimizerPlugin(),
      ],

      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          // Three.js in its own chunk
          three: {
            test: /[\\/]node_modules[\\/]three[\\/]/,
            name: 'three',
            priority: 30,
            chunks: 'all',
          },
          // Cannon-es physics in its own chunk
          cannon: {
            test: /[\\/]node_modules[\\/]cannon-es[\\/]/,
            name: 'cannon',
            priority: 25,
            chunks: 'all',
          },
          // Other vendor libraries
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 20,
            chunks: 'all',
          },
          // App code that's used in multiple places
          common: {
            name: 'common',
            minChunks: 2,
            priority: 10,
            chunks: 'all',
            reuseExistingChunk: true,
          },
        },
      },

      runtimeChunk: 'single',
      usedExports: true,
      sideEffects: true,
      
      // Additional optimizations
      moduleIds: 'deterministic',
      chunkIds: 'deterministic',
    };

    // Performance hints optimized for mobile/iOS — enforces 400KB main bundle limit
    config.performance = {
      hints: 'error',
      maxAssetSize: 800000,
      maxEntrypointSize: 409600,
      assetFilter: assetFilename => {
        if (/\.(png|jpg|jpeg)$/.test(assetFilename)) {
          return false;
        }
        if (/^(three|cannon|vendors)\.\w+\.js$/.test(assetFilename)) {
          return false;
        }
        return true;
      }
    };

    // iOS-specific optimizations
    config.optimization.concatenateModules = true; // Enable module concatenation
    config.optimization.flagIncludedChunks = true;
    config.optimization.providedExports = true;
  }

  if (!isProduction) {
    config.performance = {
      hints: 'warning',
      maxAssetSize: 800000,
      maxEntrypointSize: 409600
    };
  }

  // Bundle analyzer for development
  if (isAnalyze) {
    config.plugins.push(
      new BundleAnalyzerPlugin({
        analyzerMode: 'server',
        openAnalyzer: true,
      })
    );
  }

  return config;
};