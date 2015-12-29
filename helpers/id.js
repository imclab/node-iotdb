/*
 *  id.js
 *
 *  David Janes
 *  IOTDB.org
 *  2014-02-03
 *
 *  Things related to identifiers
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

var crypto = require('crypto');
var path = require('path');
var url = require('url');

var canonical_json = require('canonical-json');
var _ = require("../helpers");


var _safe = function(component) {
    return encodeURIComponent(component).replace('%', '$');
};

/**
 *  Unique thing
 */
var _thing_urn_unique = function() {
    var parts = [ "urn", "iotdb", "thing" ];
    for (var ai in arguments) {
        parts.push(_safe(arguments[ai]));
    }

    return parts.join(":");
};

/**
 *  Unique thing, but hashing required of last com
 */
var _thing_urn_unique_hash = function() {
    var parts = [ "urn", "iotdb", "thing" ];
    for (var ai = 0; ai < arguments.length - 1; ai++) {
        parts.push(_safe(arguments[ai]));
    }

    var hasher = crypto.createHash('md5');
    hasher.update(arguments[arguments.length - 1]);
    parts.push(hasher.digest("hex"));

    return parts.join(":");
};

/**
 *  Unique on this network
 */
var _thing_urn_network = function() {
    var hasher = crypto.createHash('md5');
    hasher.update("some-network-id");

    var parts = [ "urn", "iotdb", "thing" ];
    for (var ai in arguments) {
        parts.push(_safe(arguments[ai]));
        hasher.update("" + arguments[ai]);
    }

    parts.push(hasher.digest("hex"));

    return parts.join(":");
};

/**
 *  Unique on this machine
 */
var _thing_urn_machine = function() {
    var hasher = crypto.createHash('md5');
    hasher.update("some-machine-id");

    var parts = [ "urn", "iotdb", "thing" ];
    for (var ai in arguments) {
        parts.push(_safe(arguments[ai]));
        hasher.update("" + arguments[ai]);
    }

    parts.push(hasher.digest("hex"));

    return parts.join(":");
};

/**
 *  Make a canonical ID for a Model
 */
var model_urn = function(jsonld) {
    var src_jsonld = _.deepCopy(jsonld);

    var base_url = src_jsonld["@context"]["@base"];
    var base_name = path.basename(url.parse(base_url).path).replace(/^.*:/, '');

    src_jsonld["@context"]["@base"] = "";
    src_jsonld["@context"]["@vocab"] = "";

    src_jsonld = _.ld.compact(src_jsonld);

    var canonical_jsonld = canonical_json(jsonld);

    var canonical_hash = _.hash.md5(canonical_jsonld);
    var model_urn = "urn:iotdb:model:" + canonical_hash + ":" + base_name;

    return model_urn;
};

/**
 *  Make a canonical ID for a User.
 *  A user is simply identified by a URL.
 *  We do some _minor_ canonicalization,
 *  mainly to the hostname
 */
var user_urn = function(user_url) {
    var userp = url.parse(user_url);
    if ((userp.protocol === "http:") && (userp.port === '80')) {
        userp.host = userp.hostname;
    } else if ((userp.protocol === "https:") && (userp.port === '443')) {
        userp.host = userp.hostname;
    }

    user_url = url.format(userp);

    return "urn:iotdb:user:" + _.hash.md5(user_url);
};

var _identifier_to_parts = function (identifier) {
    if (!_.is.String(identifier)) {
        throw new Error("identitfier_to_*: expected a String");
    } else if (!identifier.match(/^[A-Za-z]/)) {
        throw new Error("identitfier_to_*: must start with a letter");
    } else if (identifier.match(/[^-_A-Za-z0-9]/)) {
        throw new Error("identitfier_to_*: must contain only letters, numbers, underscores and dashes");
    }

    var splits = identifier;
    splits = splits.replace(/([-_])/g, ' ');
    splits = splits.replace(/([A-Z]+)([A-Z][^A-Z0-9]|$)/g, ' $1 $2');
    splits = splits.replace(/([A-Z]+)([^A-Z])/g, ' $1$2');
    splits = splits.toLowerCase();

    var parts = [];
    splits.split(" ").map(function (part) {
        if (part && part.length) {
            parts.push(part);
        }
    });

    return parts;
};

/**
 *  Convert any string identifier to 'CamelCase'
 *
 *  @param {string} identifier
 *  Any identifier (in CamelCase, dash-case, or underscore_case)
 *
 *  @return {string}
 *  CamelCase version of the identifier
 */
var identifier_to_camel_case = function (identifier) {
    var parts = [];
    _identifier_to_parts(identifier).map(function (part) {
        parts.push(part.substring(0, 1).toUpperCase() + part.substring(1));
    });

    return parts.join("");
};

/**
 *  Convert any string identifier to 'dash-case'
 *
 *  @param {string} identifier
 *  Any identifier (in CamelCase, dash-case, or underscore_case)
 *
 *  @return {string}
 *  dash-case version of the identifier
 */
var identifier_to_dash_case = function (identifier) {
    return _identifier_to_parts(identifier).join("-");
};

/**
 *  Convert any string identifier to 'underscore_case'
 *
 *  @param {string} identifier
 *  Any identifier (in CamelCase, dash-case, or underscore_case)
 *
 *  @return {string}
 *  underscore_case version of the identifier
 */
var identifier_to_underscore_case = function (identifier) {
    return _identifier_to_parts(identifier).join("_");
};

/**
 *  Return a pretty safe string from an identifier
 */
var slugify = function (identifier) {
    identifier = identifier.toLowerCase();
    identifier = identifier.replace(/[^a-z0-9]/g, '_');
    identifier = identifier.replace(/_+/g, '_');

    return identifier;
};

exports.id = {
    model_urn: model_urn,
    user_urn: user_urn,
    thing_urn: {
        unique: _thing_urn_unique,
        unique_hash: _thing_urn_unique_hash,
        network_unique: _thing_urn_network,
        machine_unique: _thing_urn_machine,
    },
    to_camel_case: identifier_to_camel_case,
    to_dash_case: identifier_to_dash_case,
    to_underscore_case: identifier_to_underscore_case,
    slugify: slugify,
};

