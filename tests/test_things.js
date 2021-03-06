/*
 *  test_things.js
 *
 *  David Janes
 *  IOTDB
 *  2016-01-06
 */

"use strict";

var assert = require("assert")
var sleep = require("sleep");
var _ = require("../helpers")

var iotdb = require("../iotdb");
var things = require("../things");
var keystore = require("../keystore");

require('./instrument/iotdb');

describe('test_things', function() {
    describe('constructor', function() {
            /*
        it('global', function() {
            var t = things.things();
            t._reset();
            var ts = t.things();

            assert.ok(_.is.ThingArray(ts));
            assert.strictEqual(ts.length, 0);

            var t2 = things.things();
            assert.strictEqual(t, t2);
        });
         */
        it('new', function() {
            var t = new things.Things();
            t._reset();
            var ts = t.things();

            assert.ok(_.is.ThingArray(ts));
            assert.strictEqual(ts.length, 0);
        });
    });
    describe('discover', function() {
        it('no argument', function() {
            var t = new things.Things();
            t._reset();
            
            var model_code = t.discover();

//XXX            assert.strictEqual(model_code, undefined);
        });
        it('model:Test / string argument', function() {
            var t = new things.Things();
            t._reset();
            
            var model_code = t.discover("Test");

//XXX            assert.strictEqual(model_code, "test");
        });
        it('model:Test / string argument + dictionary', function() {
            var t = new things.Things();
            t._reset();
            
            var model_code = t.discover("Test", {
                parameter: 123,
            });

//XXX            assert.strictEqual(model_code, "test");
        });
        it('model:Test / dictionary', function() {
            var t = new things.Things();
            t._reset();
            
            var model_code = t.discover({
                model_code: "Test",
                parameter: 123,
            });

//XXX            assert.strictEqual(model_code, "test");
        });
        it('model:Test / dictionary (obsolete way)', function() {
            var t = new things.Things();
            t._reset();
            
            var model_code = t.discover({
                model: "Test",
                parameter: 123,
            });

//XXX            assert.strictEqual(model_code, "test");
        });
        it('multiple dictionaries', function() {
            var t = new things.Things();
            t._reset();
            
            var model_code = t.discover({
                model: "Test",
            }, {
                parameter: 123,
            }, {
                "iot:name": "David",
            })
             

//XXX            assert.strictEqual(model_code, "test");
        });
        describe('bad', function() {
            it('bad argument', function() {
                var t = new things.Things();
                t._reset();
                
                assert.throws(function() {
                    var model_code = t.discover(123);
                }, Error);
            });
            it('bad model code', function() {
                var t = new things.Things();
                t._reset();
                
                assert.throws(function() {
                    var model_code = t.discover({
                        model: 123,
                    });
                }, Error);
            });
            it('bad second argument', function() {
                var t = new things.Things();
                t._reset();
                
                assert.throws(function() {
                    var model_code = t.discover({
                        model: "ModelCode",
                    }, 1234);
                }, Error);
            });
            it('bad third argument', function() {
                var t = new things.Things();
                t._reset();
                
                assert.throws(function() {
                    var model_code = t.discover({
                        model: "ModelCode",
                    }, {}, 1234);
                }, Error);
            });
        });
        /*
        describe('discover_bridge', function() {
            it('simple', function() {
                var t = new things.Things();
                t._reset();
                
                var model_code = t.discover({
                    model: "Test",
                    bridge: "test-bridge",
                });
            });
        });
        */
        describe('disconnect', function() {
            it('nothing connected', function() {
                var t = new things.Things();
                t._reset();
                t.disconnect();
            });
            it('something connected', function(done) {
                var t = new things.Things();
                t._reset();
                
                var ts = t.connect({
                    model: "Test",
                });

                ts.on("thing", function() {
                    t.disconnect();
                    done();
                });

            });
        });
    });
});
