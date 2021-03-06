var assert = require('assert');
var sinon = require('sinon');
var rewire = require('rewire');
var mock = require('mock-fs');
var path = require('path');

var cabinet = rewire('../');
var mockedFiles = require('./mockedJSFiles');
var mockAST = require('./ast');

describe('filing-cabinet', function() {
  describe('JavaScript', function() {
    beforeEach(function() {
      mock(mockedFiles);
    });

    afterEach(function() {
      mock.restore();
    });

    it('dangles off its supported file extensions', function() {
      assert.deepEqual(cabinet.supportedFileExtensions, [
        '.js',
        '.jsx',
        '.scss',
        '.sass',
        '.styl'
      ]);
    });

    it('uses a generic resolve for unsupported file extensions', function() {
      var stub = sinon.stub();
      var revert = cabinet.__set__('resolveDependencyPath', stub);

      cabinet({
        partial: './bar',
        filename: 'js/commonjs/foo.baz',
        directory: 'js/commonjs/'
      });

      assert.ok(stub.called);

      revert();
    });

    describe('when given an ast for a JS file', function() {
      it('reuses the ast when trying to determine the module type', function() {
        var stub = sinon.stub();
        var revert = cabinet.__set__('getModuleType', {
          fromSource: stub
        });
        var ast = {};

        var result = cabinet({
          partial: './bar',
          filename: 'js/es6/foo.js',
          directory: 'js/es6/',
          ast
        });

        assert.deepEqual(stub.args[0][0], ast);
        revert();
      });

      it('resolves the partial successfully', function() {
        var result = cabinet({
          partial: './bar',
          filename: 'js/es6/foo.js',
          directory: 'js/es6/',
          ast: mockAST
        });

        assert.equal(result, path.join(__dirname, '../js/es6/bar.js'));
      });
    });

    describe('when not given an ast', function() {
      it('uses the filename to look for the module type', function() {
        var stub = sinon.stub();

        var revert = cabinet.__set__('getModuleType', {
          sync: stub
        });

        var options = {
          partial: './bar',
          filename: 'js/es6/foo.js',
          directory: 'js/es6/'
        };

        var result = cabinet(options);

        assert.deepEqual(stub.args[0][0], options.filename);
        revert();
      });
    });

    describe('es6', function() {
      it('assumes commonjs for es6 modules with no requirejs/webpack config', function() {
        var stub = sinon.stub();
        var revert = cabinet.__set__('commonJSLookup', stub);

        cabinet({
          partial: './bar',
          filename: 'js/es6/foo.js',
          directory: 'js/es6/'
        });

        assert.ok(stub.called);

        revert();
      });

      it('assumes amd for es6 modules with a requirejs config', function() {
        var spy = sinon.spy(cabinet, '_getJSType');

        var result = cabinet({
          partial: './bar',
          filename: 'js/es6/foo.js',
          directory: 'js/es6/',
          config: {
            baseUrl: './'
          }
        });

        assert.ok(spy.called);
        assert.equal(result, 'js/es6/bar.js');
        spy.restore();
      });
    });

    describe('jsx', function() {
      it('resolves files with the .jsx extension', function() {
        const result = cabinet({
          partial: './bar',
          filename: 'js/es6/foo.jsx',
          directory: 'js/es6/'
        });

        assert.equal(result, `${path.join(__dirname, '../js/es6/bar.js')}`);
      });
    });

    describe('amd', function() {
      it('uses the amd resolver', function() {
        var stub = sinon.stub();
        var revert = cabinet.__set__('amdLookup', stub);

        cabinet({
          partial: './bar',
          filename: 'js/amd/foo.js',
          directory: 'js/amd/'
        });

        assert.ok(stub.called);

        revert();
      });

      it('passes along arguments', function() {
        var stub = sinon.stub();
        var revert = cabinet.__set__('amdLookup', stub);
        var config = {baseUrl: 'js'};

        cabinet({
          partial: 'bar',
          config,
          configPath: 'config.js',
          filename: 'js/amd/foo.js',
          directory: 'js/amd/'
        });

        var args = stub.getCall(0).args[0];

        assert.equal(args.partial, 'bar');
        assert.equal(args.config, config);
        assert.equal(args.configPath, 'config.js');
        assert.equal(args.filename, 'js/amd/foo.js');
        assert.equal(args.directory, 'js/amd/');

        assert.ok(stub.called);

        revert();
      });
    });

    describe('commonjs', function() {
      it('uses require\'s resolver', function() {
        var stub = sinon.stub();
        var revert = cabinet.__set__('commonJSLookup', stub);

        cabinet({
          partial: './bar',
          filename: 'js/commonjs/foo.js',
          directory: 'js/commonjs/'
        });

        assert.ok(stub.called);

        revert();
      });

      it('returns an empty string for an unresolved module', function() {
        var result = cabinet({
          partial: 'foobar',
          filename: 'js/commonjs/foo.js',
          directory: 'js/commonjs/'
        });

        assert.equal(result, '');
      });

      it('adds the directory to the require resolution paths', function() {
        var directory = 'js/commonjs/';
        var result = cabinet({
          partial: 'foobar',
          filename: 'js/commonjs/foo.js',
          directory: directory
        });

        assert.ok(require.main.paths.some(function(p) {
          return p.indexOf(directory) !== -1;
        }));
      });

      it('resolves a relative partial about the filename', function() {
        var directory = 'js/commonjs/';
        var filename = directory + 'foo.js';

        var result = cabinet({
          partial: './bar',
          filename: filename,
          directory: directory
        });

        assert.equal(result, path.join(path.resolve(directory), 'bar.js'));
      });

      it('resolves a .. partial to its parent directory\'s index.js file', function() {
        var directory = 'js/commonjs/';
        var filename = directory + 'subdir/module.js';

        var result = cabinet({
          partial: '../',
          filename: filename,
          directory: directory
        });

        assert.equal(result, path.join(path.resolve(directory), 'index.js'));
      });

      it('resolves a partial within a directory outside of the given file', function() {
        var directory = 'js/commonjs/';
        var filename = directory + 'test/index.spec.js';

        var result = cabinet({
          partial: 'subdir',
          filename: filename,
          directory: directory
        });

        assert.equal(result, path.join(path.resolve(directory), 'subdir/index.js'));
      });

      it('resolves a nested module', function() {
        var directory = 'js/node_modules/nested/';
        var filename = directory + 'index.js';

        var result = cabinet({
          partial: 'lodash.assign',
          filename: filename,
          directory: directory
        });

        assert.equal(
          result,
          path.join(
            path.resolve(directory),
            'node_modules',
            'lodash.assign',
            'index.js'
          )
        );
      });

      it('resolves to the index.js file of a directory', function() {
        var directory = 'js/withIndex';
        var filename = directory + '/index.js';

        var result = cabinet({
          partial: './subdir',
          filename: filename,
          directory: directory
        });

        assert.equal(
          result,
          path.resolve(directory) + '/subdir/index.js'
        );
      });
    });
  });

  describe('CSS', function() {
    beforeEach(function() {
      mock({
        stylus: {
          'foo.styl': '',
          'bar.styl': ''
        },
        sass: {
          'foo.scss': '',
          'bar.scss': '',
          'foo.sass': '',
          'bar.sass': ''
        }
      });

      this._directory = path.resolve(__dirname, '../');
    });

    afterEach(function() {
      mock.restore();
    });

    describe('sass', function() {
      it('uses the sass resolver for .scss files', function() {
        const result = cabinet({
          partial: 'bar',
          filename: 'sass/foo.scss',
          directory: 'sass/'
        });

        assert.equal(result, `${this._directory}/sass/bar.scss`);
      });

      it('uses the sass resolver for .sass files', function() {
        const result = cabinet({
          partial: 'bar',
          filename: 'sass/foo.sass',
          directory: 'sass/'
        });

        assert.equal(result, `${this._directory}/sass/bar.sass`);
      });
    });

    describe('stylus', function() {
      it('uses the stylus resolver', function() {
        const result = cabinet({
          partial: 'bar',
          filename: 'stylus/foo.styl',
          directory: 'stylus/'
        });

        assert.equal(result, `${this._directory}/stylus/bar.styl`);
      });
    });
  });

  describe('.register', function() {
    it('registers a custom resolver for a given extension', function() {
      var stub = sinon.stub().returns('foo.foobar');
      cabinet.register('.foobar', stub);

      var path = cabinet({
        partial: './bar',
        filename: 'js/amd/foo.foobar',
        directory: 'js/amd/'
      });

      assert.ok(stub.called);
      assert.equal(path, 'foo.foobar');
    });

    it('allows does not break default resolvers', function() {
      mock({
        stylus: {
          'foo.styl': '',
          'bar.styl': ''
        }
      });

      var stub = sinon.stub().returns('foo');

      cabinet.register('.foobar', stub);

      cabinet({
        partial: './bar',
        filename: 'js/amd/foo.foobar',
        directory: 'js/amd/'
      });

      var result = cabinet({
        partial: './bar',
        filename: 'stylus/foo.styl',
        directory: 'stylus/'
      });

      assert.ok(stub.called);
      assert.ok(result);

      mock.restore();
    });

    it('can be called multiple times', function() {
      var stub = sinon.stub().returns('foo');
      var stub2 = sinon.stub().returns('foo');

      cabinet.register('.foobar', stub);
      cabinet.register('.barbar', stub2);

      cabinet({
        partial: './bar',
        filename: 'js/amd/foo.foobar',
        directory: 'js/amd/'
      });

      cabinet({
        partial: './bar',
        filename: 'js/amd/foo.barbar',
        directory: 'js/amd/'
      });

      assert.ok(stub.called);
      assert.ok(stub2.called);
    });

    it('does not add redundant extensions to supportedFileExtensions', function() {
      const stub = sinon.stub;
      const newExt = '.foobar';

      cabinet.register(newExt, stub);
      cabinet.register(newExt, stub);

      const {supportedFileExtensions} = cabinet;

      assert.equal(supportedFileExtensions.indexOf(newExt), supportedFileExtensions.lastIndexOf(newExt));
    });
  });

  describe('webpack', function() {
    function testResolution(partial) {
      const directory = path.resolve(__dirname, '../');

      const resolved = cabinet({
        partial,
        filename: `${directory}/index.js`,
        directory,
        webpackConfig: `${directory}/webpack.config.js`
      });

      assert.equal(resolved, `${directory}/node_modules/resolve/index.js`);
    }

    it('resolves an aliased path', function() {
      testResolution('R');
    });

    it('resolves a non-aliased path', function() {
      testResolution('resolve');
    });

    describe('when the partial contains a loader', function() {
      it('still works', function() {
        testResolution('hgn!resolve');
      });
    });
  });
});
