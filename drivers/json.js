/*
 *  drivers/json.js
 *
 *  David Janes
 *  IOTDB.org
 *  2014-01-02
 *
 *  Connect to JSON / REST-like webservices
 */

"use strict"

var _ = require("../helpers");
var driver = require('../driver')
var FIFOQueue = require('../queue').FIFOQueue
var unirest = require('unirest');

var queue = new FIFOQueue("JSONDriver");

/**
 */
var JSONDriver = function(paramd) {
    var self = this;
    driver.Driver.prototype.driver_construct.call(self);

    paramd = _.defaults(paramd, {
        verbose: false,
        driver_iri: "iot-driver:json",
        initd: {}
    })

    self.verbose = paramd.verbose;
    self.driver_iri = _.expand(paramd.driver_iri)

    self._init(paramd.initd)

    return self;
}

JSONDriver.prototype = new driver.Driver;

/* --- class methods --- */

/**
 *  Pull information from initd
 *
 *  @protected
 */
JSONDriver.prototype._init = function(initd) {
    var self = this;

    if (!initd) {
        return
    }
    if (initd.api) {
        self.api = initd.api
    }

    self.mqtt_init(initd)
}

/**
 *  See {@link Driver#identity Driver.identity}
 */
JSONDriver.prototype.identity = function(kitchen_sink) {
    var self = this;

    if (self.__identityd === undefined) {
        var identityd = {}
        identityd["driver_iri"] = self.driver_iri

        // once the driver is 'setup' this will have a value
        if (self.api) {
            identityd["api"] = self.api
        }

        _.thing_id(identityd);
        
        self.__identityd = identityd;
    }

    return self.__identityd;
}

/**
 *  See {@link Driver#setup Driver.setup}
 *  <p>
 *  Record the actual API of the JSON. This
 *  is used in creating the proper identity
 */
JSONDriver.prototype.setup = function(paramd) {
    var self = this;

    /* chain */
    driver.Driver.prototype.setup.call(self, paramd);

    self._init(paramd.initd)

    if (self.mqtt_topic) {
        self.mqtt_subscribe()
    }

    return self;
}

/**
 *  See {@link Driver#discover Driver.discover}
 */
JSONDriver.prototype.discover = function(paramd, discover_callback) {
    discover_callback(new JSONDriver());
}

/**
 *  Just send the data via PUT to the API
 *  <p>
 *  See {@link Driver#push Driver.push}
 */
JSONDriver.prototype.push = function(paramd) {
    var self = this;

    console.log("- JSONDriver.push", 
        "\n  api", self.api, 
        "\n  driverd", paramd.driverd, 
        "\n  initd", paramd.initd)

    var qitem = {
        id: self.light,
        run: function() {
            unirest
                .put(self.api)
                .headers({'Accept': 'application/json'})
                .type('json')
                .send(paramd.driverd)
                .end(function(result) {
                    queue.finished(qitem);
                    if (!result.ok) {
                        console.log("# JSONDriver.push/.end", "not ok", "url", self.api, "result", result.text);
                        return
                    }

                    console.log("- JSONDriver.push/.end.body", result.body);
                })
            ;
        }
    }
    queue.add(qitem);

    return self;
}

/**
 *  Request the Driver's current state. It should
 *  be called back with <code>callback</code>
 *  <p>
 *  See {@link Driver#pull Driver.pull}
 */
JSONDriver.prototype.pull = function() {
    var self = this;

    console.log("- JSONDriver.pull", 
        "\n  api", self.api
    )

    var qitem = {
        id: self.light,
        run: function() {
            unirest
                .get(self.api)
                .headers({'Accept': 'application/json'})
                .end(function(result) {
                    queue.finished(qitem);
                    if (!result.ok) {
                        console.log("# JSONDriver.pull/.end - not ok", "\n  url", self.api, "\n  result", result.text);
                        return
                    }

                    self.pulled(result.body)
                })
            ;
        }
    }
    queue.add(qitem);

    return self;
}


/*
 *  API
 */
exports.Driver = JSONDriver
