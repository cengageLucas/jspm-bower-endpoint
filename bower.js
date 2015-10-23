'use strict';

var PackageAdapter = require('./lib/adapters/PackageAdapter');
var PackageRepository = require('./lib/adapters/core/PackageRepository');
var Project = require('./lib/adapters/core/Project');
var bowerConfig = require('./lib/adapters/config');

var resolvers = require('bower/lib/core/resolvers');

var bowerEndpointParser = require('bower-endpoint-parser');
var bowerLogger = require('bower-logger');
var path = require('path');
var mout = require('mout');
var Q = require('q');

var BowerEndpoint = module.exports = function BowerEndpoint (options, ui) {

    this._ui = ui;
    this._endpoint = options.name;
    this._tmp = options.tmpDir;
    this._api = options.apiVersion;
    this._version = options.versionString;

	this._bower = {
		config: bowerConfig({}),
		logger: new bowerLogger()
	};

    this._bower.config.tmp = path.resolve( this._tmp, 'tmp');
    this._bower.config.storage.packages = path.resolve( this._tmp, 'packages');
    this._bower.config.storage.links = path.resolve( this._tmp, 'links');
    this._bower.config.storage.completion = path.resolve( this._tmp, 'completion');
    this._bower.config.storage.registry = path.resolve( this._tmp, 'registry');
    this._bower.config.storage.empty = path.resolve( this._tmp, 'empty');

	this._repository = new PackageRepository(this._bower.config, this._bower.logger);

	this._bower.logger.intercept(function(log){

		if(log.level === 'info')
			ui.log(
				log.level,
				ui.format.info(
					'- ' + log.data.endpoint.name + ' ' + log.id + ': ' + log.message
				)
			);

	});
};



BowerEndpoint.prototype.locate = function (endpoint){

	var fail = { notfound: true };
	var repository = this._repository;
	var endpoint = this._endpoint

	return Q.Promise(function(resolve){

		repository.resolve(packageName)
			.spread(function(ConcreteResolver, source, repositoryPackageName) {


				if(packageName != repositoryPackageName)
					return { redirect: endpoint + ':' + repositoryPackageName };

				if(
					ConcreteResolver === resolvers.GitRemote ||
					ConcreteResolver === resolvers.GitHub ||
					ConcreteResolver === resolvers.Fs
				)
					return undefined;

				return fail;
			})
			.then(resolve)
			.catch(function(){
				resolve( fail );
			});
	});
}

BowerEndpoint.prototype.lookup = function (packageName){


	var fail = { notfound: true };
	var noVersioned = { versions : { latest: { hash: 'latest' } } };
	var repository = this._repository;

	return Q.Promise(function(resolve){

		Q.all([
				repository.resolve(packageName),
				repository.versions(packageName)
			])
			.spread(function(ConcreteResolver, versions){

				return [ConcreteResolver[0], versions];

			})
			.spread(function(ConcreteResolver, versions){

				// No versioned endpoints
				if(ConcreteResolver === resolvers.Fs)
					return noVersioned;

				// Versioned endpoints
				if(
					ConcreteResolver === resolvers.GitRemote||
					ConcreteResolver === resolvers.GitHub
				) {

					var lookup = { versions : {} };

					mout.array.forEach(versions, function(version){

						lookup.versions[version] = { hash: version};

					});

					return lookup;

				}

				return fail;
			})
			.then(resolve)
			.catch(function(){

				resolve( fail );

			});
	});
};

//TODO: packageName is used in other places too, going to want to change those
//packageEndpoint is the actual syntax to find the package. Can just be the name in cases like bower registry
//But name is needed for cases like bower_component=http://github.com/bower_component.git/... so we can get the real name and not install to a botched URL
BowerEndpoint.prototype.download = function (endpoint, version, hash, meta, dir, name){ //TODO name is on end to fit existing calls, would rather have it earlier

	console.log('BowerEndpoint.prototype.download: Calling!');
	console.log('BowerEndpoint.prototype.download: endpoint: ', endpoint); //http://gitlab.com/2fd/jspm-bower-endpoint-test.git
	console.log('BowerEndpoint.prototype.download: version: ' , version); //1.0.0
	console.log('BowerEndpoint.prototype.download: hash: ', hash);
	console.log('BowerEndpoint.prototype.download: meta: ' , meta);
	console.log('BowerEndpoint.prototype.download: dir: ' , dir); ///Users/llowry/Dev/jspm-bower-endpoint/test/assets/install/http://gitlab.com/2fd/jspm-bower-endpoint-test.git@1.0.0
	console.log('BowerEndpoint.prototype.download: out!');
	//This block shows us that we need to either pass a name in, or derive it out of something

	//TODO: Do we get a useful name BACK from anywhere? Maybe we don't need to pull it out ourselves.

	var ui = this._ui;
	var registry = this._endpoint;
	var repository = this._repository;
	var bowerConfig = this._bower.config;
	var bowerLogger = this._bower.logger;


	return Q.Promise(function(resolve, reject){

		repository.resolve(endpoint)//Last use of endpoint here, turns into other data
			.spread(function(ConcreteResolver, source){

				console.log('BowerEndpoint.prototype.download.resolve.spread: Calling!');
				console.log('BowerEndpoint.prototype.download.resolve.spread ConcreteResolver: ' + ConcreteResolver); //Big GitRemoteResolver
				console.log('BowerEndpoint.prototype.download.resolve.spread source: ' + source); //http://gitlab.com/2fd/jspm-bower-endpoint-test.git
				//This block brings back the resolver, which may come into play here but I'm not sure yet

				var decomposeString = source + '#' + version;
				if(name) {
					decomposeString = name + '=' + decomposeString; //Name needed to keep decomponse from coming back with no name, and us installing somewhere crazy
				}
				var decEndpoints = bowerEndpointParser.decompose(decomposeString);
				var config = {};
				mout.object.deepMixIn(config, bowerConfig);

				//I'm suspicious that this is causing our bad install, config.cwd is off on that bad path
				config.cwd = dir; //Already passed in as top level argument
				console.log('BowerEndpoint.prototype.download.resolve.spread config.cwd: ' + config.cwd);

				config.directory = '';

				var project = new Project( config, bowerLogger);

				//Name is coming back now that name=endpoint syntax is used, but we're still installing to a url/path
				console.log('BowerEndpoint.prototype.download.resolve.spread decEndpoints: ' + JSON.stringify(decEndpoints)); //{"name":"","source":"http://gitlab.com/2fd/jspm-bower-endpoint-test.git","target":"1.0.0"}
				console.log('BowerEndpoint.prototype.download.resolve.spread project: ' + JSON.stringify(project)); //Big, no ready to use name string in here

				console.log('BowerEndpoint.prototype.download.resolve.spread: Out!');
				//This block has a blank name, which I'm curious to see if that's coming back blank or I'm passing in a blank name and it's just passing back


				//TODO: What is the argument config we need here to install to the right path. We have the name, should be able to provide that path
				//Bower API doc just wants to talk about the command line
				//Source does not have inline doc

				//Bower programattic API says to call bower.commands.install
				//This appears to override bower.Project, not sure if that's going in some weird way, or why he's weaving this project in
				//Assuming this wires up right, we have 4 possible events emitted from this
				return project.install([decEndpoints], undefined, config);

			})
			.then(function(installed){



				var pkg = mout.object.reduce(installed, function(pre, cur){
					return cur;
				});

				var packageJson = new PackageAdapter(pkg.pkgMeta, registry);

				console.log('BowerEndpoint.prototype.download.resolve.then: Calling!');
				console.log('BowerEndpoint.prototype.download.resolve.then installed: ' + JSON.stringify(installed)); //Big, all names in full path
				console.log('BowerEndpoint.prototype.download.resolve.then pkg: ' + JSON.stringify(pkg)); //Big, pull paths, and urls, no name on own
				console.log('BowerEndpoint.prototype.download.resolve.then packageJson: ' + JSON.stringify(packageJson)); //This actually has a name field, for the product. In this case, it's 'pack', but this MAY be useful with a real package
				console.log('BowerEndpoint.prototype.download.resolve.then: out!');
				//This block shows me that we've got one piece of data coming back that might be useful
				//but that's a bet, and relies on package structure.
				//Package names, outside of this shitty test directory, appear to follow consistent names, so I'm after that
				//Doesn't work, by the time we have a name here, the install to file system has already happened

				return packageJson;
			})
			.then(resolve)
			.catch(resolve);
	});
};


// Methods
// BowerEndpoint.prototype.locate(packageName) //, optional
// BowerEndpoint.prototype.getPackageConfig (packageName, version, hash, meta) // optional
// BowerEndpoint.prototype.processPackageConfig (pjson) // optional
// BowerEndpoint.prototype.build (pjson, dir) // optional
// BowerEndpoint.prototype.getOverride(endpoint, endpoint, versionRange, override)

// static
// BowerEndpoint.packageFormat # RegExp
// BowerEndpoint.configure (config, ui) # optional
// BowerEndpoint.remote # optional
