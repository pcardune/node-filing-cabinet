### filing-cabinet [![npm](http://img.shields.io/npm/v/filing-cabinet.svg)](https://npmjs.org/package/filing-cabinet) [![npm](http://img.shields.io/npm/dm/filing-cabinet.svg)](https://npmjs.org/package/filing-cabinet)

> Look up a filename based on a partial path

`npm install --save filing-cabinet`

### Usage

```js

var cabinet = require('filing-cabinet');

var result = cabinet({
  partial: 'somePartialPath',
  directory: 'path/to/all/files',
  filename: 'path/to/parent/file',
  ast: {}, // an optional AST representation of `filename`
  // Only for JavaScript files
  config: 'path/to/requirejs/config',
  webpackConfig: 'path/to/webpack/config'
});

console.log(result); // /absolute/path/to/somePartialPath
```

* `partial`: the dependency path
 * This could be in any of the registered languages
* `directory`: the path to all files
* `filename`: the path to the file containing the `partial`
* `ast`: (optional) the parsed AST for `filename`.
 * Useful optimization for avoiding a parse of filename
* `config`: (optional) requirejs config for resolving aliased JavaScript modules
* `webpackConfig`: (optional) webpack config for resolving aliased JavaScript modules

### Registered languages

By default, filing-cabinet provides support for the following languages:

* JavaScript (all files with the `.js` extension)
* Sass (`.scss` and `.sass`)
* Stylus (`.styl`)

You can register resolvers for new languages via `cabinet.register(extension, resolver)`.

* `extension`: the extension of the file that should use the custom resolver (ex: '.py', '.php')
* `resolver`: a function that accepts the following (ordered) arguments that were given to cabinet:
  * `partial`
  * `filename`
  * `directory`
  * `config`

For examples of resolver implementations, take a look at the default language resolvers:

* [sass-lookup](https://github.com/mrjoelkemp/node-sass-lookup)
* [stylus-lookup](https://github.com/mrjoelkemp/node-stylus-lookup)
* [amdLookup](https://github.com/mrjoelkemp/node-module-lookup-amd)

If a given extension does not have a registered resolver, cabinet will use
a generic file resolver which is basically `require('path').join` with a bit of extension defaulting logic.

### Shell script

* Requires a global install `npm install -g filing-cabinet`

`filing-cabinet [options] <dependencyPath>`

* See `filing-cabinet --help` for details on the options
