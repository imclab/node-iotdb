/*
 *  meta.js
 *
 *  David Janes
 *  IOTDB
 *  2014-05-29
 *
 *  Copyright [2013-2016] [David P. Janes]
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

var _ = require("./helpers.js");
var constants = require("./constants.js");
var assert = require("assert");

var logger = require("./helpers/logger").logger.logger({
    name: 'iotdb',
    module: 'meta',
});


/**
 *  This represents the Thing data in the graph.
 *  Typically this comes from IOTDB
 */
var Meta = function (thing) {
    var self = this;

    self.thing = thing;
    self._updated = {};
};

var machine_id;

/**
 *  Return the metadata
 */
Meta.prototype.state = function () {
    var self = this;

    if (!self.thing._metad) {
        self.thing._metad = {
            "@timestamp": _.timestamp.epoch(),
        };
    }

    self.thing._metad[constants.iot_thing_id] = self.thing.thing_id();
    self.thing._metad[constants.iot_model_id] = self.thing.code();
    self.thing._metad[constants.schema_name] = self.thing.__name; // name();

    if (self.thing.__facets) {
        self.thing._metad[constants.iot_facet] = self.thing.__facets;
    }

    if (self.thing.bridge_instance) {
        var bmetad = _.ld.expand(self.thing.bridge_instance.meta());
        if (bmetad) {
            delete bmetad[constants.iot_thing_id];
            delete bmetad[constants.iot_thing];

            _.extend(self.thing._metad, bmetad);
        }

        // binding metadata
        if (self.thing.bridge_instance.binding && self.thing.bridge_instance.binding.metad) {
            _.extend(self.thing._metad, _.ld.expand(self.thing.bridge_instance.binding.metad));
        }

        // bridge reachable
        // metad[constants.iot_reachable] = self.thing.bridge_instance.reachable() ? true : false;
    } else {
        // metad[constants.iot_reachable] = false;
    }

    _.extend(self.thing._metad, self._updated);
    // _.extend(metad, require('iotdb').controller_meta());

    return self.thing._metad;
};

/**
 *  Returns meta value for the key.
 *
 *  @param {string} key
 *  An IRI or expandable string
 *
 *  @param {*} otherwise
 *  The value to return if the key is not for
 */
Meta.prototype.get = function (key, otherwise) {
    var self = this;

    key = _.ld.expand(key);

    var stated = self.state();
    var value = stated[key];
    if (value !== undefined) {
        return value;
    } else {
        return otherwise;
    }
};

/**
 *  Set a metavalue
 *  XXX - consider just making this call 'update'
 *
 *  @param {string} key
 *  An IRI or expandable string
 *
 *  @param {*} value
 *  Value to set (should be simple or an Array of simple). Not expanded.
 */
Meta.prototype.set = function (key, value) {
    var self = this;

    key = _.ld.expand(key);
    if (key === constants.iot_reachable) {
        return;
    }

    if (self._updated[key] !== value) {
        self._updated[key] = value;
        self.thing.meta_changed();
    }

    self._updated["@timestamp"] = _.timestamp.make();
};

/**
 *  Update the metadata. Return 'true' if there's
 *  a change.
 *
 *  paramd.set_timestamp: anything changed, set the timestamp
 *  paramd.check_timestamp: see timestamp-conflict below
 *
 *  Timestamp-conflict - see helpers/d.js
 */
Meta.prototype.update = function (ind, paramd) {
    var self = this;
    var in_timestamp = ind["@timestamp"];

    if (!_.is.Dictionary(ind)) {
        throw new Error("not an Dictionary");
    }

    paramd = _.defaults(paramd, {
        emit: true,
        set_timestamp: false,
        check_timestamp: false,
    });

    ind = _.ld.expand(ind);

    if (paramd.check_timestamp && !_.timestamp.check.dictionary(self._updated, ind)) {
        return;
    }

    var state = self.state();
    var changed = false;

    var in_keys = _.keys(ind);
    for (var ki in in_keys) {
        var in_key = in_keys[ki];
        if (in_key === constants.iot_reachable) {
            continue;
        } else if (in_key === "@timestamp") {
            continue;
        }

        var in_value = ind[in_key];

        var old_value = state[in_key];
        if (_.is.Equal(in_value, old_value)) {
            continue;
        }

        self._updated[in_key] = in_value;
        changed = true;
    }

    if (changed && paramd.set_timestamp) {
        if (in_timestamp) {
            self._updated["@timestamp"] = in_timestamp;
        } else {
            self._updated["@timestamp"] = _.timestamp.make();
        }
    }

    if (changed) {
        if (paramd.emit) {
            self.thing.meta_changed();
        }

        return true;
    }

    return false;
};

/**
 *  Return all local updates
 */
Meta.prototype.updates = function () {
    return this._updated;
};

exports.Meta = Meta;
