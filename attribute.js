/*
 *  attribute.js
 *
 *  David Janes
 *  IOTDB
 *  2013-12-22
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
var constants = require("./constants");

var assert = require("assert");

var logger = require("./helpers/logger").logger.logger({
    name: 'iotdb',
    module: 'attribute',
});

var VERBOSE = false;

/* --- setup section --- */
/**
 *  An argument for a {@link Thing}. This
 *  actually makes a pretty clean dictionary.
 *
 *  <p>
 *  Normally you will use one of the following 
 *  helper functions:
 *  <ul>
 *  <li>{@link make_value}
 *  <li>{@link make_boolean}
 *  <li>{@link make_integer}
 *  <li>{@link make_number}
 *  <li>{@link make_string}
 *  </ul>
 *
 *
 *  @classdesc
 *  Attributes describe how a {@link Thing} can be manipulated
 *  (if it's an actuator) or described (if it's a sensor).
 *  Almost every method in this class is shorthand
 *  for filling in code/value pairs.
 *
 *  <p>
 *  Here's an example of a read-only property 
 *  of a thing that measures temperature in Fahrenheit
 *
 *  <pre>
attribute.make_number()
    .code('temperature_f')
    .purpose("temperature")
    .unit("temperature.si.fahrenheit")
    .minimum(0)
    .maximum(500)
    .read_only()
    .make()
    ;
 *  </pre>
 *  <p>
 *  Which makes the following {@link Attribute} dictionary.
 *  <pre>
{ '@type': 'https://iotdb.org/iot#Attribute',
  '@id': '#temperature_f',
  'https://iotdb.org/iot#purpose': 'https://iotdb.org/attribute#temperature',
  'https://iotdb.org/iot#unit': 'https://iotdb.org/iot-unit#temperature.si.fahrenheit',
  'https://iotdb.org/iot-js#type': 'https://iotdb.org/iot-js#number',
  'https://iotdb.org/iot-js#maximum': 500,
  'https://iotdb.org/iot-js#minimum': 0,
  'https://iotdb.org/iot-js#write': false }
    </pre>
 *
 *  <hr />
 *  @constructor
 */
var Attribute = function () {
    var self = this;

    self['@type'] = constants.iot_Attribute;
};

/**
 *  Set a 'code' for this Attribute, which
 *  typically should be a simple string with
 *  no slashes in it. This is stored
 *  in <code>@id</code> as <code>#<i>code</i></code>
 *
 *  <p>
 *  IF NO ARGUMENTS:
 *  Return the 'code' of this Attribute. The code
 *  is used to store values in a dictionary
 *  in the {@link Thing}.
 *
 *  @param {string} code
 *  The code
 *
 *  @return {this}
 *  this
 */
Attribute.prototype.code = function (code) {
    var self = this;

    if (arguments.length === 0) {
        return self._get_code();
    } else {
        return self._set_code(code);
    }
};


Attribute.prototype._get_code = function () {
    var self = this;

    var code = self['@id'];
    if (code === undefined) {
        code = self[constants.iot_purpose];
    }
    if (code !== undefined) {
        return code.replace(/^.*#/, "");
    }

    return null;
};

Attribute.prototype._set_code = function (code) {
    var self = this;

    self._validate_code(code);

    code = code.replace(/^:/, '');

    self['@id'] = '#' + code;
    return self;
};

Attribute.prototype._validate_code = function (code) {
    if (!_.is.String(code)) {
        throw new Error("Attribute.code: code must be a String, not: " + code);
    }
};

/**
 *  Return the first value, compacted
 */
Attribute.prototype.first = function (iri, otherwise) {
    var self = this;

    if (arguments.length < 2) {
        otherwise = null;
    }

    var result = _.ld.first(self, _.ld.expand(iri), null);
    if (result === null) {
        return otherwise;
    }

    return _.ld.compact(result);
};

/**
 *  Return as a list, compacted
 */
Attribute.prototype.as_list = function (iri, otherwise) {
    var self = this;

    if (arguments.length < 2) {
        otherwise = null;
    }

    var result = _.ld.list(self, _.ld.expand(iri), null);
    if (result === null) {
        return otherwise;
    }

    return _.ld.compact(result);
};

/**
 *  Define the purpose of this Attribute, typically
 *  a IRI from 'iot-purpose:'.
 *
 *  <p>
 *  Most attributes should use this. This code sets only
 *  one value
 *
 *  @param {string} purpose_iri
 *  An IRI, typically from 'iot-purpose:*'
 *
 *  @return {this}
 *  this
 */
Attribute.prototype.purpose = function (purpose_iri) {
    var self = this;

    if (arguments.length === 0) {
        return self.first(constants.iot_purpose);
    }

    purpose_iri = _.ld.expand(purpose_iri, 'iot-purpose:');
    self._validate_purpose(purpose_iri);

    return self.property('iot:purpose', purpose_iri, {
        array: false
    });
};

Attribute.prototype._validate_purpose = function (purpose_iri) {
    if (!_.is.AbsoluteURL(purpose_iri)) {
        throw new Error("Attribute.purpose: purpose_iri must expand to a IRI, not: " + purpose_iri);
    }
};

/**
 *  This is a value, i.e. it is measuring something
 *  @depreciated
 */
Attribute.prototype.reading = function () {
    return this.property("iot:read", true);
};

/**
 *  This is a control, i.e. you can change with it
 *  @depreciated
 */
Attribute.prototype.control = function () {
    return this.property('iot:write', true);
};

Attribute.prototype.is_read = function () {
    return _.ld.first(this, constants.iot_read) ? true : false;
};

Attribute.prototype.is_write = function () {
    return _.ld.first(this, constants.iot_write) ? true : false;
};

Attribute.prototype.is_actuator = function () {
    return _.ld.first(this, constants.iot_actuator) ? true : false;
};

Attribute.prototype.is_sensor = function () {
    return _.ld.first(this, constants.iot_sensor) ? true : false;
};

/**
 *  Define the {@link https://iotdb.org/pub/iot.html#name schema:name}
 *  of this attribute. Name can only be set once
 *
 *  @param {string} value
 *  The name, for humans
 *
 *  @return {this}
 *  this
 */
Attribute.prototype.name = function (_value) {
    var self = this;

    if (arguments.length === 0) {
        return _.ld.first(self, constants.schema_name, null);
    }

    self._validate_name(_value);

    return this.property_value(constants.schema_name, _value, {
        array: false
    });
};

Attribute.prototype._validate_name = function (_value) {
    if (!_.is.String(_value)) {
        throw new Error("Attribute.name: must be a String");
    }
};

/**
 *  Define the {@link https://iotdb.org/pub/iot.html#description schema:description}
 *  of this attribute.
 *
 *  @param {string} value
 *  The description, for humans
 *
 *  @return {this}
 *  this
 */
Attribute.prototype.description = function (_value) {
    var self = this;

    if (arguments.length === 0) {
        return _.ld.first(self, constants.schema_description, null);
    }

    self._validate_description(_value);

    return self.property_value(constants.schema_description, _value);
};

Attribute.prototype._validate_description = function (_value) {
    if (!_.is.String(_value)) {
        throw new Error("Attribute.description: must be a String");
    }
};

/**
 *  Define the {@link https://iotdb.org/pub/iot.html#help iot:help}
 *  of this attribute.
 *
 *  @param {string} value
 *  The help, for humans
 *
 *  @return {this}
 *  this
 */
Attribute.prototype.help = function (_value) {
    var self = this;

    if (arguments.length === 0) {
        return _.ld.first(self, constants.iot_help, null);
    }

    self._validate_help(_value);

    return self.property_value(constants.iot_help, _value);
};

Attribute.prototype._validate_help = function (_value) {
    if (!_.is.String(_value)) {
        throw new Error("Attribute.help: must be a String");
    }
};

/**
 *  Add a property (predicate, object) to this Attribute
 *
 *  @param {string} key_iri
 *  The property predicate IRI
 *
 *  @param {*} value_iri
 *  The property object IRI. If this is not a string or
 *  not a namespaced IRI, it will be used as-is.
 *  If you want to add a string that is not interpretted
 *  as an IRI, use {@link Attribute#property_value Attribute.property_value}
 *
 *  @return {this}
 *  this
 */
Attribute.prototype.property = function (key_iri, value_iri, paramd) {
    var self = this;

    key_iri = _.ld.expand(key_iri);
    value_iri = _.ld.expand(value_iri);

    self._validate_property(key_iri, value_iri, paramd);

    return self.property_value(key_iri, value_iri, paramd);
};

Attribute.prototype._validate_property = function (key_iri, value_iri, paramd) {
    if (!_.is.AbsoluteURL(key_iri)) {
        throw new Error("Attribute.property: key_iri must expand to a IRI, not: " + key_iri);
    }
};

/**
 *  Add a property (predicate, string) to this Attribute.
 *  Unlike {@link #property} value is always used as-is
 *
 *  @param {string} key_iri
 *  The property predicate IRI
 *
 *  @param {*} value
 *  This value. Should be a simple type or an Array
 *
 *  @return {this}
 *  this
 */
Attribute.prototype.property_value = function (key_iri, value, paramd) {
    var self = this;

    paramd = _.defaults(paramd, {
        array: true
    });

    key_iri = _.ld.expand(key_iri);
    self._validate_property_value(key_iri, value, paramd);

    var existing = self[key_iri];
    if ((existing === undefined) || !paramd.array) {
        self[key_iri] = value;
    } else if (_.is.Array(existing)) {
        if (existing.indexOf(value) === -1) {
            existing.push(value);
        }
    } else {
        if (existing !== value) {
            self[key_iri] = [existing, value];
        }
    }

    return self;
};

Attribute.prototype._validate_property_value = function (key_iri, value, paramd) {
    if (!_.is.AbsoluteURL(key_iri)) {
        throw new Error("Attribute.property_value: key_iri must expand to a IRI, not: " + key_iri);
    }
};

/**
 *  Make this a List
 */
Attribute.prototype.list = function () {
    var self = this;
    self.property_value("iot:type", constants.iot_list);
    return self;
};

/**
 *  Make this a Set
 */
Attribute.prototype.set = function () {
    var self = this;
    self.property_value("iot:type", constants.iot_set);
    return self;
};

/**
 *  Specify the "iot:unit" of this attribute. For example,
 *  <code>iot-unit:temperature.imperial.fahrenheit</code>
 *  or <code>iot-unit:length.si.metre</code>.
 *
 *  <p>
 *  Available units can be found at {@link https://iotdb.org/pub/iot-unit},
 *  though of course any semantically meaningful URL can be used
 *
 *  @param {string} unit
 *  A unit IRI. If no colon, assume it to be "iot-unit:"
 *
 *  @return {this}
 */
Attribute.prototype.unit = function (unit_iri) {
    var self = this;

    if (arguments.length === 0) {
        return self.first(constants.iot_unit, null);
    }

    unit_iri = _.ld.expand(unit_iri, "iot-unit:");
    self._validate_unit(unit_iri);

    return self.property_value(constants.iot_unit, unit_iri);
};

Attribute.prototype._validate_unit = function (unit_iri) {
    if (!_.is.AbsoluteURL(unit_iri)) {
        throw new Error("Attribute.unit: key_iri must expand to a IRI, not: " + unit_iri);
    }
};

/**
 *  Specify the name of the vector this attribute belongs to.
 *  Attributes in the same vector should be, um, considered
 *  part of the same vector.
 *
 *  @param {string} name
 *  A name for the vector, preferably human readable
 *
 */
Attribute.prototype.vector = function (name) {
    var self = this;

    if (arguments.length === 0) {
        return self.first(constants.iot_vector, null);
    }

    self._validate_vector(name);

    return self.property_value(constants.iot_vector, name);
};

Attribute.prototype._validate_vector = function (name) {
    if (!_.is.String(name)) {
        throw new Error("Attribute.vector: name must be a String, not: " + name);
    }
};

/**
 *  If a string, it must be one of the following values
 *
 *  @param {array} values
 *  A list of valid values. These are not CIRIs
 *
 *  @return {this}
 *  this
 */
Attribute.prototype.enumeration = function (values) {
    var self = this;

    if (arguments.length === 0) {
        return self.as_list(constants.iot_enumeration, null);
    }

    self._validate_enumeration(values);

    _.ld.add(self, constants.iot_enumeration, values);

    return self;
};

Attribute.prototype._validate_enumeration = function (values) {
    if (!_.is.Array(values)) {
        throw new Error("Attribute.enumeration: values must be an Array, not: " + values);
    }
};

/**
 *  Set the <code>iot:type</code> for this
 *  Attribute, which defines the type(s) of values
 *  this attribute can take.
 *
 *  @param {string} type
 *  Usually one of 'iot:type.boolean', 'iot:type.integer', 'iot:type.number',
 *  'iot:type.string'.
 *
 *  @return {this}
 */
Attribute.prototype.type = function (type_iri) {
    var self = this;

    if (arguments.length === 0) {
        return self.first(constants.iot_type, _.ld.compact(constants.iot_null));
    }

    type_iri = _.ld.expand(type_iri, "iot:");
    self._validate_type(type_iri);

    return self.property_value(constants.iot_type, type_iri);
};

Attribute.prototype._validate_type = function (type_iri) {
    if (!_.is.AbsoluteURL(type_iri)) {
        throw new Error("Attribute.type: type_iri must expand to a IRI, not: " + type_iri);
    }
};

// depreciate?
Attribute.prototype.types = function () {
    return _.ld.list(this, constants.iot_type, []);
};

Attribute.prototype.is_type_null = function () {
    return this.types().indexOf(constants.iot_null) > -1;
};

/**
 *  Set the <code>iot:format</code> for this
 *  Attribute, which constrains the values a string can take.
 *
 *  @param {string} format_iri
 *  Typically <code>rgb<code>, <code>datetime</code>.
 *  If it does not contain a ":", <code>iot:</code>
 *  is prepended.
 *
 *  @return {this}
 */
Attribute.prototype.format = function (format_iri) {
    var self = this;

    if (arguments.length === 0) {
        return self.first(constants.iot_format, null);
    }

    format_iri = _.ld.expand(format_iri, "iot:format.");
    self._validate_format(format_iri);

    return self.property_value(constants.iot_format, format_iri);
};

Attribute.prototype._validate_format = function (format_iri) {
    if (!_.is.AbsoluteURL(format_iri)) {
        throw new Error("Attribute.type: format_iri must expand to a IRI, not: " + format_iri);
    }
};

/**
 *  Specify the <code>iot:minimum</code> of this attribute.
 *
 *  @param {number|integer} value
 *  The minimum value
 *
 *  @return {this}
 */
Attribute.prototype.minimum = function (value) {
    var self = this;

    if (arguments.length === 0) {
        return self.first(constants.iot_minimum, null);
    }

    self._validate_minimum(value);

    return self.property_value(constants.iot_minimum, value);
};

Attribute.prototype._validate_minimum = function (value) {
    if (!_.is.Number(value)) {
        throw new Error("Attribute.minimum: minimum must be a Number, not: " + value);
    }
};

/**
 *  Specify the <code>iot:maximum</code> of this attribute.
 *
 *  @param {number|integer} value
 *  The maximum value
 *
 *  @return {this}
 */
Attribute.prototype.maximum = function (value) {
    var self = this;

    if (arguments.length === 0) {
        return self.first(constants.iot_maximum, null);
    }

    self._validate_maximum(value);

    return self.property_value(constants.iot_maximum, value);
};

Attribute.prototype._validate_maximum = function (value) {
    if (!_.is.Number(value)) {
        throw new Error("Attribute.maximum: maximum must be a Number, not: " + value);
    }
};

/**
 *  Specify that this attribute is read-only
 *
 *  @return {this}
 */
Attribute.prototype.read_only = function () {
    return this.property_value(constants.iot_write, false);
};

/**
 *  Dummy function for consistency with thing.
 *  Does not need to be called.
 *
 *  @return {this}
 */
Attribute.prototype.make = function () {
    return this;
};

/* --- use interface --- */
/**
 *  Take the value and validate it according to
 *  the rules of this Attribute. This can include
 *  changing its type, placing it with bounds,
 *  and calling a validation function.
 *
 *  <p>
 *  Note that the validation function result
 *  is NOT type checked
 *
 *  @param {object} paramd
 *  @param {*} paramd.value
 *  The value to validate AND the returned
 *  validated value.
 *
 *  @param {boolean} paramd.use_otherwise
 *  If the value isn't valid, a 'reasonable'
 *  otherwise value is returned.
 *
 *  @param {object} paramd.lib
 *  A library of useful functions. These are the only
 *  functions you can assume are available beyond
 *  standard JS functions.
 *
 *  @param {Thing} paramd.thing
 *  The {@link Thing} this attribute belongs too. This
 *  is just passed along to the validator function,
 *  but probably should not be used
 *
 */
Attribute.prototype.validate = function (paramd) {
    var self = this;

    var iot_types = _.ld.list(self, constants.iot_type, []);

    if (_.is.Date(paramd.value)) {
        paramd.value = paramd.value.toISOString();
    }

    paramd.value = self._convert(paramd.value, iot_types);

    if (_.is.Number(paramd.value)) {
        paramd.value = self._bounded(
            paramd.value,
            _.ld.first(self, constants.iot_minimum),
            _.ld.first(self, constants.iot_maximum)
        );
    }

    if (_.is.String(paramd.value)) {
        var iot_formats = _.ld.list(self, constants.iot_format, []);
        if (iot_formats.length > 0) {
            var formatted_value = self._format(paramd.value, iot_formats, paramd);
            if (formatted_value === undefined) {
                logger.error({
                    method: "validate",
                    original: paramd.value,
                    formats: iot_formats,
                    cause: "likely programmer error - bad type passed in"
                }, "iot:format failed");

                paramd.value = undefined;
            } else {
                paramd.value = formatted_value;
            }
        }
    }
};

/**
 *  Validate a value
 */
Attribute.prototype.validate_value = function (value) {
    var self = this;
    var paramd;

    var iot_types = _.ld.list(self, constants.iot_type, []);
    var is_set = iot_types.indexOf(constants.iot_set) > -1;
    var is_list = iot_types.indexOf(constants.iot_list) > -1;

    if (is_set || is_list) {
        if ((value === null) || (value === undefined)) {
            value = [];
        } else if (!_.is.Array(value)) {
            value = [value];
            /*
            } else if (is_set) {
                var vs = [];
                for (var vi in value) {
                    var v = value[vi];
                    if (vs.indexOf(v) === -1) {
                        vs.push(v);
                    }
                }
                value = vs;
                */
        }

        var ns = [];
        for (var vi in value) {
            paramd = {
                value: value[vi],
                code: self.code(),
            };

            self.validate(paramd);

            if (paramd.value !== undefined) {
                if (!is_set || (ns.indexOf(paramd.value) === -1)) {
                    ns.push(paramd.value);
                }
            }
        }

        return ns;
    } else {
        if (_.is.Array(value)) {
            if (value.length) {
                value = value[0];
            } else {
                value = null;
            }
        }

        paramd = {
            value: value,
            code: self.code(),
        };

        self.validate(paramd);

        return paramd.value;
    }

};

/* --- internal validation --- */
Attribute.prototype._format = function (value, formats, paramd) {
    var self = this;
    var known = false;
    var otherwise;
    var new_value;

    if (!formats || (formats.length === 0)) {
        return value;
    }

    if (formats.indexOf(constants.iot_color) > -1) {
        known = true;
        otherwise = undefined;
        if (paramd.use_otherwise) {
            if (paramd.otherwise_rgb !== undefined) {
                otherwise = paramd.otherwise_rgb;
            } else {
                otherwise = "#000000";
            }
        }

        new_value = self._format_rgb(value, otherwise);
        if (new_value !== undefined) {
            return new_value;
        }
    }

    if (formats.indexOf(constants.iot_datetime) > -1) {
        known = true;
        otherwise = undefined;
        if (paramd.use_otherwise) {
            if (paramd.otherwise_datetime !== undefined) {
                otherwise = paramd.otherwise_datetime;
            } else {
                otherwise = (new Date()).toISOString();
            }
        }
        new_value = self._format_datetime(value, otherwise);
        if (new_value !== undefined) {
            return new_value;
        }
    }

    if (formats.indexOf(constants.iot_date) > -1) {
        known = true;
        otherwise = undefined;
        if (paramd.use_otherwise) {
            if (paramd.otherwise_date !== undefined) {
                otherwise = paramd.otherwise_date;
            } else {
                otherwise = (new Date()).toISOString().substring(0, 10);
            }
        }
        new_value = self._format_date(value, otherwise);
        if (new_value !== undefined) {
            return new_value;
        }
    }

    if (formats.indexOf(constants.iot_time) > -1) {
        known = true;
        otherwise = undefined;
        if (paramd.use_otherwise) {
            if (paramd.otherwise_time !== undefined) {
                otherwise = paramd.otherwise_time;
            } else {
                otherwise = (new Date()).toISOString().substring(10);
            }
        }
        new_value = self._format_time(value, otherwise);
        if (new_value !== undefined) {
            return new_value;
        }
    }

    if (formats.indexOf(constants.iot_iri) > -1) {
        // XXX not implemented
        return value;
    }

    if (!known) {
        // console.log("# Attribute._format: warning: no recognized formats!", formats);
        logger.error({
            method: "_format",
            formats: formats,
            cause: "likely Node-IOTDB error, shouldn't be called with bad format"
        }, "iot:format failed");
    }

    return undefined;
};

Attribute.prototype._format_rgb = function (value, otherwise) {
    value = value.toUpperCase();
    if (!value.match(/^#[0-9A-F]{6}/)) {
        return _.color.color_to_hex(value, otherwise);
    }

    return value;
};

var iso_tz_re = /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/;
var iso_notz_re = /(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d)/;

/**
 *  Very generous inputs, strict ISO output
 *
 *  @private
 */
Attribute.prototype._format_datetime = function (value, otherwise) {
    var dt = new Date(value);
    if (isNaN(dt.getFullYear())) {
        return otherwise;
    }

    return dt.toISOString();
};

Attribute.prototype._bounded = function (value, min, max) {
    if (min !== undefined) {
        if (value < min) {
            value = min;
        }
    }
    if (max !== undefined) {
        if (value > max) {
            value = max;
        }
    }
    return value;
};

Attribute.prototype._convert = function (value, types) {
    var self = this;
    if (value === undefined) {
        return self._default(value, types);
    } else if (_.is.Boolean(value)) {
        var minimum = _.ld.first(self, constants.iot_minimum, null);
        var maximum = _.ld.first(self, constants.iot_maximum, null);

        return self._convert_boolean(value, types, minimum, maximum);
    } else if (_.is.Integer(value)) {
        return self._convert_integer(value, types);
    } else if (_.is.Number(value)) {
        return self._convert_number(value, types);
    } else if (_.is.String(value)) {
        return self._convert_string(value, types);
    } else {
        return value;
    }
};

Attribute.prototype._default = function (value, types) {
    if (VERBOSE) {
        logger.debug("undefined", "wants-to-be", types);
    }
    if (types.indexOf(constants.iot_boolean) > -1) {
        return false;
    } else if (types.indexOf(constants.iot_integer) > -1) {
        return 0;
    } else if (types.indexOf(constants.iot_number) > -1) {
        return 0.0;
    } else if (types.indexOf(constants.iot_string) > -1) {
        return "";
    } else {
        return null;
    }
};

/**
 *  DPJ 2015-12-20
 *  Note how booleans will be converted to the minimum or maximum 
 *  value if converting to a ranged number-type
 */
Attribute.prototype._convert_boolean = function (value, types, minimum, maximum) {
    if (VERBOSE) {
        logger.debug("is-a-boolean", value, "wants-to-be", types);
    }

    minimum = minimum || 0;
    maximum = maximum || 1;

    if (types.indexOf(constants.iot_boolean) > -1) {
        return value;
    } else if (types.indexOf(constants.iot_integer) > -1) {
        return value ? maximum : minimum;
    } else if (types.indexOf(constants.iot_number) > -1) {
        return value ? maximum : minimum;
    } else if (types.indexOf(constants.iot_string) > -1) {
        return value ? "1" : "0";
    } else {
        return value;
    }
};

Attribute.prototype._convert_integer = function (value, types) {
    if (VERBOSE) {
        logger.debug("is-a-integer", value, "wants-to-be", types);
    }

    if (types.indexOf(constants.iot_boolean) > -1) {
        return value ? true : false;
    } else if (types.indexOf(constants.iot_integer) > -1) {
        return value;
    } else if (types.indexOf(constants.iot_number) > -1) {
        return Math.round(value);
    } else if (types.indexOf(constants.iot_string) > -1) {
        return "" + value;
    } else {
        return value;
    }
};

Attribute.prototype._convert_number = function (value, types) {
    if (VERBOSE) {
        logger.debug("is-a-number", value, "wants-to-be", types);
    }

    if (types.indexOf(constants.iot_boolean) > -1) {
        return value ? true : false;
    } else if (types.indexOf(constants.iot_number) > -1) {
        return value;
    } else if (types.indexOf(constants.iot_integer) > -1) {
        return Math.round(value);
    } else if (types.indexOf(constants.iot_string) > -1) {
        return "" + value;
    } else {
        return value;
    }

    return value;
};

Attribute.prototype._convert_string = function (value, types) {
    var self = this;
    if (VERBOSE) {
        logger.debug("is-a-string", value, "wants-to-be", types);
    }
    if (types.indexOf(constants.iot_string) > -1) {
        return value;
    } else if (types.indexOf(constants.iot_boolean) > -1) {
        value = value.toLowerCase();
        if (value.length === 0) {
            value = false;
        } else if (value === "0") {
            value = false;
        } else if (value === "off") {
            value = false;
        } else if (value === "false") {
            value = false;
        } else if (value === "no") {
            value = false;
        } else {
            value = true;
        }

        if (VERBOSE) {
            logger.debug(" ... became boolean", value);
        }
    } else if (types.indexOf(constants.iot_integer) > -1) {
        value = Math.round(parseFloat(value));
        if (isNaN(value)) {
            value = undefined;
        }
        if (VERBOSE) {
            logger.debug(" ... became integer", value);
        }
    } else if (types.indexOf(constants.iot_number) > -1) {
        value = parseFloat(value);
        if (isNaN(value)) {
            value = undefined;
        }
        if (VERBOSE) {
            logger.debug(" ... became number", value);
        }
    }

    return value;
};

/* --- helper section --- */
exports.Attribute = Attribute;

/**
 *  Shortcut to make a new value {@link Attribute}.
 *
 *  @param {string} purpose_key
 *  If this is present, we call
 *  both {@link Attribute#purpose Attribute.purpose}
 *  and {@link Attribute#code Attribute.code}. This
 *  is useful if your "code" names are going to
 *  be pretty well the same as the semantic
 *  "purpose" names
 *
 *  @return {Attribute}
 *  a new attribute
 */
exports.make = function (purpose, code, name) {
    assert.ok(_.is.String(purpose));
    // code = (code === undefined) ? purpose : code
    code = code === undefined ? purpose.replace(/^.*[.]/, '') : code;
    name = name === undefined ? code.replace(/^:+/, '') : name;

    var attribute = new Attribute();
    if (purpose) {
        attribute
            .purpose(purpose)
            .code(code)
            .name(name);
    }
    return attribute;
};
