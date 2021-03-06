/*
 *  keystore.js
 *
 *  David Janes
 *  IOTDB.org
 *  2014-02-14
 *  "Valentines's Day"
 *
 *  Copyright [2013-2016] [David P. Janes]
 *
 *  Much cleaner Keystore than the one in IOTDB.js
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

"use strict";

const _ = require('./helpers');

const cfg = require('./cfg');

const events = require('events');
const util = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const process = require('process');

const logger = require("./helpers/logger").logger.logger({
    name: 'iotdb',
    module: 'keystore',
});

/**
 *  Return every folder from CWD to / that has a ".iotdb" folder in it
 */
const _paths = function() {
    const paths = [];
    var current = process.cwd();

    while (true) {
        var iotdb_folder = path.join(current, ".iotdb");

        try {
            var stbuf = fs.statSync(iotdb_folder);
            if (stbuf.isDirectory()) {
                paths.push(iotdb_folder);
            }
        } catch (x) {
        }

        var next = path.normalize(path.join(current, ".."));
        if (next === current) {
            break;
        }

        current = next;
    }

    return paths;
};

var Keystore = function (paramd) {
    var self = this;

    self.paramd = _.defaults(paramd, {
        root: "/",
        keystore: "keystore.json",
        path: _paths(), // [".iotdb", "$HOME/.iotdb", ],
        makedirs: true,
    })
    self.d = {}

    events.EventEmitter.call(this);
    this.setMaxListeners(0);

    self._load();
};

util.inherits(Keystore, events.EventEmitter);

Keystore.prototype._normalize_key = function (key) {
    var self = this;

    if (!key.match(/^\//)) {
        key = self.paramd.root.replace('/*$', '') + '/' + key;
    }

    return "/" + key.replace(/^\/*/, '');
};

Keystore.prototype._load = function () {
    var self = this;
    self.d = {};

    var filenames = cfg.cfg_find(cfg.cfg_envd(), self.paramd.path, "keystore.json");
    filenames.reverse();

    if (filenames.length === 0) {
        self.emit("loaded");
        return;
    }

    var count = 0;

    cfg.cfg_load_json(filenames, function (paramd) {
        if (paramd.error) {
            logger.error({
                method: "_load",
                cause: "likely user hasn't added keystore.json using 'iotdb' - not serious",
                filename: paramd.filename,
                error: paramd.error,
                exception: paramd.exception,
            }, "error loading JSON keystore.json");
        } else {
            _.d.smart_extend(self.d, paramd.doc);
        }

        if (++count === 0) {
            self.emit("loaded");
        }
    });
};

/**
 */
Keystore.prototype.get = function (key, otherwise) {
    var self = this;

    key = self._normalize_key(key);

    return _.d.get(self.d, key, otherwise);
};

/**
 */
Keystore.prototype.set = function (key, value) {
    var self = this;

    key = self._normalize_key(key);

    _.d.set(self.d, key, value);

    self.emit("changed", key);
};

/**
 */
Keystore.prototype.save = function (key, value, paramd) {
    var self = this;

    key = self._normalize_key(key);
    paramd = _.defaults(paramd, {
        global: false,
        filename: null,
        set: true,
        mkdirs: false,
    });

    var filename;
    if (paramd.filename) {
        filename = paramd.filename
    } else if (paramd.global) {
        filename = self.paramd.path[self.paramd.path.length - 1] + "/" + self.paramd.keystore;
    } else {
        filename = self.paramd.path[0] + "/" + self.paramd.keystore;
    }

    // load keystore
    var d = {};
    cfg.cfg_load_json([filename], function (paramd) {
        for (var pd in paramd.doc) {
            d[pd] = paramd.doc[pd];
        }
    });

    // if value is a function, we call it with the current value to get a new value
    // this allows "in-place" updating of a particular value
    if (_.is.Function(value)) {
        value = value(_.d.get(d, key));
    }

    // update the (just loaded) keystore
    _.d.set(d, key, value);

    // save - XXX does not deal with recursion yet
    if (paramd.mkdirs) {
        var dirname = path.dirname(filename)
        try {
            fs.mkdirSync(dirname);
        } catch (x) {}
    }
    fs.writeFileSync(filename, JSON.stringify(d, null, 2));

    logger.info({
        key: key,
        value: value,
        filename: filename,
    }, "updated");

    // update ourselves
    self.set(key, value);
};

var _keystore;

/**
 */
var keystore = function () {
    if (!_keystore) {
        _keystore = new Keystore();
    }

    return _keystore;
}

/*
 *  API
 */
exports.Keystore = Keystore;
exports.keystore = keystore;
