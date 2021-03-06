/*
 *  thing_array.js
 *
 *  David Janes
 *  IOTDB
 *  2014-01-01
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

var _ = require("./helpers");
var attribute = require("./attribute");
var model = require("./model");
var events = require('events');
var util = require('util');
var assert = require('assert');

var logger = require("./helpers/logger").logger.logger({
    name: 'iotdb',
    module: 'thing_array',
});

/* --- constants --- */
var VERBOSE = true;
var EVENT_THING_NEW = 'EVENT_THING_NEW';
var EVENT_THING_PUSHED = 'EVENT_THING_PUSHED';
var EVENT_THINGS_CHANGED = 'EVENT_THINGS_CHANGED';

var KEY_TAG = 'TAG';
var KEY_SETTER = 'SETTER';
var PRE_KEYS = [KEY_TAG, ];
var array_id = 0;

/**
 *  An array for holding {@link Thing}s. When the
 *  methods
 *  {@link ThingArray#start start},
 *  {@link ThingArray#start set},
 *  {@link ThingArray#start end}, or
 *  {@link ThingArray#start get}
 *  are called, that exact method with all the
 *  arguments are called on each item in the array.
 *
 *  @constructor
 */
var ThingArray = function (paramd) {
    var self = this;

    paramd = _.defaults(paramd, {});

    self.array_id = '__thing_array_' + array_id++;
    self.length = 0;
    self._things = null;

    /*
     *  If paramd.persist is true, create an array for peristing commands
     */
    this._persistds = null;
    if (paramd.persist) {
        this._persistds = [];
    }

    if (paramd.things) {
        self._things = paramd.things;
    }

    events.EventEmitter.call(self);
    this.setMaxListeners(0);
};

ThingArray.prototype = new Array(); // jshint ignore:line
util.inherits(ThingArray, events.EventEmitter);
ThingArray.prototype._isThingArray = true;

/**
 */
ThingArray.prototype.first = function () {
    if (this.length) {
        return this[0];
    } else {
        return null;
    }
};

/**
 *  This will apply the function to every element
 *  of the ThingArray. If non-undefined is returned,
 *  this will be placed in result array.
 */
ThingArray.prototype.map = function (f) {
    var self = this;
    var rs = [];
    for (var ti = 0; ti < self.length; ti++) {
        var t = self[ti];
        var r = f(t);
        if (r !== undefined) {
            rs.push(r);
        }
    }

    return rs;
};

/**
 *  Add a new thing to this ThingArray.
 */
ThingArray.prototype.push = function (thing, paramd) {
    var self = this;

    if (!_.is.Thing(thing)) {
        logger.fatal({
            method: "push",
            thing: thing,
        }, "attempt to push a non-Thing on a ThingArray");
        throw new Error("attempt to push a non-Thing on a ThingArray");
    }

    /*
     *  If the Thing is already in the array
     *  we do nothing. There may be a deeper bug
     *  causing this to happen, but I can't find it
     */
    for (var ti = 0; ti < self.length; ti++) {
        var t = self[ti];
        if (t === thing) {
            logger.error({
                method: "push",
                thing_id: thing.thing_id(),
            }, "preventing same Thing from being pushed");
            return;
        }
    }

    //  
    self._persist_pre(thing);

    // actual add
    paramd = _.defaults(paramd, {
        emit_pushed: true,
        emit_new: true
    });

    thing[self.array_id] = self; // TD: see if this is still necessary
    Array.prototype.push.call(self, thing);

    // event dispatch
    var changed = false;
    if (paramd.emit_pushed) {
        self.emit(EVENT_THING_PUSHED, thing);
        changed = true;
    }
    if (paramd.emit_new) {
        self.emit(EVENT_THING_NEW, thing);
        changed = true;
    }

    if (changed) {
        self.things_changed();
    }

    // 
    self._persist_post(thing);

    return self;
};

/**
 *  Return true iff this is a persisting array
 */
ThingArray.prototype.is_persist = function () {
    return this._persistds != null;
};

ThingArray.prototype._persist_post = function (thing) {
    var self = this;

    if (_.is.Empty(self._persistds)) {
        return;
    }

    self._persistds.map(function (pd) {
        if (PRE_KEYS.indexOf(pd.key) !== -1) {
            return;
        }

        pd.f.apply(thing, Array.prototype.slice.call(pd.av));
    });
};

ThingArray.prototype._persist_pre = function (thing) {
    var self = this;

    if (_.is.Empty(self._persistds)) {
        return;
    }

    self._persistds.map(function (pd) {
        if (PRE_KEYS.indexOf(pd.key) === -1) {
            return;
        }

        pd.f.apply(thing, Array.prototype.slice.call(pd.av));
    });
};

ThingArray.prototype._persist_command = function (f, av, key) {
    var self = this;

    if (self._persistds === null) {
        return;
    }

    var persistd = {
        f: f,
        av: av,
        key: key
    };

    /*
     *  If not in a transaction, there can only be one Setter
     */
    if (key === KEY_SETTER) {
        for (var pi = 0; pi < self._persistds.length; pi++) {
            var _persistd = self._persistds[pi];
            if (_persistd.key === KEY_SETTER) {
                self._persistds.splice(pi--, 1);
            }
        }

    }

    self._persistds.push(persistd);
};

/**
 *  Apply the command to everything in the ThingArray
 *  right now.
 */
ThingArray.prototype._apply_command = function (f, av) {
    var self = this;

    self.map(function (thing) {
        f.apply(thing, Array.prototype.slice.call(av));
    });
};


/**
 */
ThingArray.prototype.splice = function (index, howmany, add1) {
    var self = this;

    // sorry
    assert.ok(add1 === undefined);

    if (howmany) {
        for (var i = 0; i < howmany; i++) {
            var x = index + i;
            if (x < self.length) {
                delete self[x][self.array_id];
            }
        }
    }

    Array.prototype.splice.apply(self, arguments);

    return self;
};

var _merger = function (srcs, out_items) {
    var o;
    var oi;

    /**
     *  Existing things
     */
    var oidd = {};

    for (oi = 0; oi < out_items.length; oi++) {
        o = out_items[oi];
        oidd[o.thing_id()] = 1;
    }

    /**
     *  New things, from any of the srcs
     */
    for (var si in srcs) {
        var src = srcs[si];

        for (var ii = 0; ii < src.length; ii++) {
            var thing = src[ii];
            var thing_id = thing.thing_id();

            if (oidd[thing_id]) {
                delete oidd[thing_id];
            } else {
                out_items.push(thing, {
                    emit_pushed: false
                });
            }
        }
    }

    /**
     *  remove things that no longer match
     */
    for (oi = 0; oi < out_items.length; oi++) {
        o = out_items[oi];
        if (!oidd[o.thing_id()]) {
            continue;
        }

        out_items.splice(oi--, 1);
    }

    /*
     *  notify downstream - note that we always do this because
     *  even though this list may not have changed, filters
     *  downstream may have changed
     */
    out_items.things_changed();
};

/**
 *  Merge another array into this one
 */
ThingArray.prototype.merge = function (new_items) {
    var self = this;

    /*
     *  Merge (XXX: not sure if should always be persist)
     */
    var out_items = new ThingArray({
        persist: true
    });
    var srcs = [
        self,
        new_items
    ];

    _merger(srcs, out_items);


    /*
     *  Persist the merging
     */
    var _on_things_changed = function () {
        logger.trace({
            method: "merge/_on_things_changed",
            in_array_1: srcs[0].array_id,
            in_array_2: srcs[1].array_id,
            out_array: out_items.array_id,
        }, "called");

        _merger(srcs, out_items);
    };

    for (var si in srcs) {
        var src = srcs[si];
        if (src._persistds === null) {
            continue;
        }

        events.EventEmitter.prototype.on.call(src, EVENT_THINGS_CHANGED, _on_things_changed);
    }

    logger.info({
        method: "merge",
        in_array_1: srcs[0].array_id,
        in_array_2: srcs[1].array_id,
        out_array: out_items.array_id,
    }, "merged array");

    return out_items;
};

/**
 *  Call IOT.connect() and join all the resulting 
 *  items into this ThingArray. This lets several
 *  connect() calls be chained.
 *
 *  <pre>
    things = iot
       .connect('SomeThing')
       .connect('AnotherThing')

    things = iot
        .connect('HueLight')
        .with_name('Hue Light 1')
        .connect('WeMoSwitch')
   </pre>
 *
 *  @return {this}
 */
ThingArray.prototype.connect = function (modeld) {
    var self = this;

    if (self._things) {
        return self.merge(self._things.connect(modeld));
    } else {
        var iot = require('./iotdb').iot();

        return self.merge(
            iot.connect.apply(iot, Array.prototype.slice.call(arguments))
        );
    }
};

/**
 *  Call {@link Thing#update Model.disconnect} on
 *  every item in the ThingArray.
 *
 *  @return {this}
 */
ThingArray.prototype.disconnect = function () {
    var self = this;

    self._apply_command(model.Model.prototype.disconnect, arguments);
    self._persist_command(model.Model.prototype.disconnect, arguments);

    return self;
};

/**
 *  Call {@link Thing#update Model.name} on
 *  every item in the ThingArray.
 *
 *  @return {this}
 */
ThingArray.prototype.name = function (name) {
    var self = this;

    assert(_.is.String(name));

    self._apply_command(model.Model.prototype.name, arguments);
    self._persist_command(model.Model.prototype.name, arguments);

    return self;
};

/**
 *  Call {@link Thing#update Model.zones} on
 *  every item in the ThingArray.
 *
 *  @return {this}
 */
ThingArray.prototype.zones = function (zones) {
    var self = this;

    assert(_.is.String(zones) || _.is.Array(zones));

    self._apply_command(model.Model.prototype.zones, arguments);
    self._persist_command(model.Model.prototype.zones, arguments);

    return self;
};

/**
 *  Call {@link Thing#update Model.facets} on
 *  every item in the ThingArray.
 *
 *  @return {this}
 */
ThingArray.prototype.facets = function (facets) {
    var self = this;

    assert(_.is.String(facets) || _.is.Array(facets));

    self._apply_command(model.Model.prototype.facets, arguments);
    self._persist_command(model.Model.prototype.facets, arguments);

    return self;
};

/**
 *  Call {@link Thing#set Model.set} on
 *  every item in the ThingArray.
 *
 *  @return {this}
 */
ThingArray.prototype.set = function () {
    var self = this;

    self._apply_command(model.Model.prototype.set, arguments, KEY_SETTER);
    self._persist_command(model.Model.prototype.set, arguments, KEY_SETTER);

    return self;
};

/**
 *  Call {@link Thing#update Model.update} on
 *  every item in the ThingArray.
 *
 *  @return {this}
 */
ThingArray.prototype.update = function () {
    var self = this;

    self._apply_command(model.Model.prototype.update, arguments, KEY_SETTER);
    self._persist_command(model.Model.prototype.update, arguments, KEY_SETTER);

    return self;
};

/**
 *  Call {@link Thing#pull Model.pull} on
 *  every item in the ThingArray.
 *
 *  @return {this}
 */
ThingArray.prototype.pull = function () {
    var self = this;

    self._apply_command(model.Model.prototype.pull, arguments);
    self._persist_command(model.Model.prototype.pull, arguments);

    return self;
};

/**
 *  Call {@link Thing#pull Model.tag} on
 *  every item in the ThingArray.
 *
 *  @return {this}
 */
ThingArray.prototype.tag = function () {
    var self = this;

    self.map(function (thing) {
        thing.tag.apply(thing, Array.prototype.slice.call(arguments));
    });

    self._apply_command(model.Model.prototype.tag, arguments, KEY_TAG);
    self._persist_command(model.Model.prototype.tag, arguments, KEY_TAG);

    return self;
};

/**
 *  Call {@link Thing#on Model.on} on
 *  every item in the ThingArray.
 *
 *  @return {this}
 */
ThingArray.prototype.on = function (what, callback) {
    var self = this;

    if (what === "thing") {
        self._on_thing(callback);
    } else if ((what === EVENT_THING_NEW) || (what === EVENT_THING_PUSHED) || (what === EVENT_THINGS_CHANGED)) {
        events.EventEmitter.prototype.on.call(self, what, function (thing) {
            callback(thing);
        });
    } else {
        self._apply_command(model.Model.prototype.on, arguments);
        self._persist_command(model.Model.prototype.on, arguments);
    }

    return self;
};

ThingArray.prototype._on_thing = function (callback) {
    var self = this;

    self.map(callback);

    events.EventEmitter.prototype.on.call(self, EVENT_THING_NEW, function (thing) {
        callback(thing);
    });

    return self;
};

/**
 *  Call {@link Thing#on Model.on_change} on
 *  every item in the ThingArray.
 *
 *  DEPRECIATE
 *
 *  @return {this}
 */
ThingArray.prototype.on_change = function () {
    var self = this;

    self._apply_command(model.Model.prototype.on_change, arguments);
    self._persist_command(model.Model.prototype.on_change, arguments);

    return self;
};

/**
 *  Return the number of things that can be reached
 */
ThingArray.prototype.reachable = function () {
    var self = this;
    var count = 0;

    self.map(function (thing) {
        if (thing.reachable()) {
            count++;
        }
    });

    return count;
};

/**
 *  Somehow or another, the underlying things were changed.
 *  This will bring all downstream ThingArrays into order
 */
ThingArray.prototype.things_changed = function () {
    var self = this;

    logger.trace({
        method: "things_changed",
        array: self.array_id,
        length: self.length,
    }, "called");

    self.emit(EVENT_THINGS_CHANGED);
};


/* --- */

ThingArray.prototype._filter_test = function (queryd, thing) {
    var self = this;
    var meta = thing.meta();

    for (var query_key in queryd) {
        var match = query_key.match(/^(meta|model|istate|ostate|transient):(.+)$/);
        if (!match) {
            logger.error({
                method: "_filter_test",
                cause: "bad query in the test dictionary",
                query_key: query_key,
            }, "bad match request");
            return false;
        }

        var query_band = match[1];
        var query_inner_key = match[2];
        var query_values = _.ld.list(queryd, query_key, []);

        if (query_band === "meta") {
            query_values = _.ld.expand(query_values);

            var thing_state = thing.state(query_band);
            var thing_values = _.ld.expand(_.ld.list(thing_state, query_inner_key, []));

            var intersection = _.intersection(query_values, thing_values);
            if (intersection.length === 0) {
                return false;
            }
        } else if (query_band === "transient") {
            if (query_inner_key === "tag") {
                if (!_.ld.intersects(thing.initd, "tag", query_values)) {
                    return false;
                }
            } else {
                return false;
            }
        } else if ((query_band === "ostate") || (query_band === "istate") || (query_band === "model")) {
            logger.error({
                method: "_filter_test",
                query_band: query_band,
                query_key: query_key,
            }, "function not implemented (yet)");

            return false;
        } else {
            logger.error({
                method: "_filter_test",
                cause: "programming error - this should never happen",
                query_band: query_band,
                query_key: query_key,
            }, "bad band");

            return false;
        }
    }

    return true;
};

/**
 */
ThingArray.prototype.filter = function (d) {
    var self = this;
    var persist = self.is_persist();
    var o;
    var oi;

    var out_items = new ThingArray({
        persist: persist
    });

    self.map(function (thing) {
        if (self._filter_test(d, thing)) {
            out_items.push(thing);
        }
    });

    if (out_items.length === 0) {
        // console.log("# ThingArray.filter: warning - nothing matched", d)
    }

    /*
     *  When 'Things Changed' && persist: update the list.
     *
     *  NOTE:
     *  we use 'events.EventEmitter.prototype.on' because we are doing our own
     *  thing with 'self.on'
     */
    if (persist) {
        events.EventEmitter.prototype.on.call(self, EVENT_THINGS_CHANGED, function () {
            // existing things by ID
            var oidd = {};

            for (oi = 0; oi < out_items.length; oi++) {
                o = out_items[oi];
                oidd[o.thing_id()] = 1;
            }

            // find new things matching
            var is_updated = false;

            for (var ii = 0; ii < self.length; ii++) {
                var thing = self[ii];
                var thing_id = thing.thing_id();

                if (!self._filter_test(d, thing)) {
                    continue;
                }

                if (oidd[thing_id]) {
                    delete oidd[thing_id];
                } else {
                    out_items.push(thing, {
                        emit_pushed: false
                    });
                    is_updated = true;
                }
            }


            // remove things that no longer match
            for (oi = 0; oi < out_items.length; oi++) {
                o = out_items[oi];
                if (!oidd[o.thing_id()]) {
                    continue;
                }

                // console.log("! ThingArray.filter/things_changed: remove old match", o.thing_id())
                out_items.splice(oi--, 1);
                is_updated = true;
            }

            /*
             *  notify downstream - note that we always do this because
             *  even though this list may not have changed, filters
             *  downstream may have changed
             */
            out_items.things_changed();
        });

        /*
         *  Things being added propagates downstream. Note how
         *  above with { emit_pushed: false } we stop this from being
         *  unnecessarily being called
         */
        events.EventEmitter.prototype.on.call(self, EVENT_THING_PUSHED, function (thing) {
            self.things_changed();
        });
    }

    return out_items;
};

ThingArray.prototype.with_id = function (id) {
    return this.filter({
        "meta:iot:thing-id": id,
    });
};

ThingArray.prototype.with_code = function (code) {
    return this.filter({
        "meta:iot:model-id": _.id.to_dash_case(code),
    });
};

ThingArray.prototype.with_name = function (name) {
    return this.filter({
        "meta:schema:name": name
    });
};

ThingArray.prototype.with_zone = function (name) {
    return this.filter({
        "meta:iot:zone": name
    });
};

ThingArray.prototype.with_number = function (number) {
    return this.filter({
        "meta:iot:thing-number": parseInt(number)
    });
};

ThingArray.prototype.with_tag = function (tag) {
    return this.filter({
        "transient:tag": tag
    });
};

ThingArray.prototype.with_facet = function (facet) {
    return this.filter({
        "meta:iot:facet": facet,
    });
};

exports.ThingArray = ThingArray;
