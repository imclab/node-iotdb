/*
 *  graph.js
 *
 *  David Janes
 *  IOTDB.org
 *  2013-12-01
 *
 *  Nodejs IOTDB control
 */

"use strict";

var unirest = require('unirest');
var jsonld = require('jsonld');
var rdf = require('rdf');
var events = require('events');
var util = require('util');
var _ = require('./helpers');
var fs = require('fs')
var path = require('path')
var node_url = require('url')

var GraphManager = function(iot) {
    events.EventEmitter.call(this);

    this.iot = iot;
    this.clear();
    this.verbose = false;
};
util.inherits(GraphManager, events.EventEmitter);

GraphManager.EVENT_UPDATED_SUBJECT = "graph_updated_subject"
GraphManager.EVENT_UPDATED_GRAPH = "graph_updated_graph"
GraphManager.EVENT_LOADED_IRI = "graph_loaded_iri";
GraphManager.EVENT_FAILED_IRI = "graph_failed_iri";

GraphManager.EVENT_UPDATED_DEVICE = "graph_updated_device"
GraphManager.EVENT_UPDATED_PLACE = "graph_updated_place"
GraphManager.EVENT_UPDATED_MODEL = "graph_updated_model"

/* states in IRId */
GraphManager.IRI_LOADING = "loading"                // in process of downloading from IOTDB
GraphManager.IRI_PROCESSING = "processing"          // in process of downloading from IOTDB
GraphManager.IRI_LOADED = "loaded"                  // successfully downloaded from ITODB
GraphManager.IRI_NOT_FOUND = "not_found"            // 404 from server
GraphManager.IRI_NOT_AVAILABLE = "not_available"    // server could not be contacted

GraphManager.prototype.wire = function() {
    var self = this;
    self.iot.on(GraphManager.EVENT_UPDATED_GRAPH, function(url) {
        self._onGraphUpdatedGraph(url);
    });
}

/*
 *  Interface
 */
GraphManager.prototype.clear = function() {
    this.graph = new rdf.TripletGraph();
    this.irid = {};
};

/**
 *  This function will return true iff
 *  nothing is loading or being processed.
 */
GraphManager.prototype.is_active = function() {
    var self = this;
    for (var iri in self.irid) {
        var status = self.irid[iri]
        if (status == GraphManager.IRI_LOADING) {
            return true
        } else if (status == GraphManager.IRI_PROCESSING) {
            return true
        }
    }

    return false
}

/**
 */
GraphManager.prototype.load_jsonld = function(jd) {
    var self = this;

    jsonld.flatten(jd, function(error, robjectds) {
        self._load_flattened(error, jd, robjectds);
    });
};

GraphManager.prototype.has_subject = function(subject) {
    var self = this;
    var ts = self.graph.match(
        _.expand(subject),
        null,
        null
    );
    return ts.length ? true : false
}

GraphManager.prototype.get_object = function(subject, predicate) {
    var self = this;
    var ts = self.graph.match(
        _.expand(subject),
        _.expand(predicate),
        null
    );
    if (!ts.length) {
        return  null;
    }

    if (_.isString(ts[0].object)) {
        return ts[0].object;
    } else {
        return ts[0].object.value;
    }
}

GraphManager.prototype.get_subjects = function(predicate, object) {
    var self = this;
    var ts = self.graph.match(
        null,
        _.expand(predicate),
        _.expand(object)
    );

    var resultd = {}
    ts.map(function(t) {
        if (_.isString(t.subject)) {
            resultd[t.subject] = true;
        } else {
            resultd[t.subject.value] = true;
        }
    });
    return Object.keys(resultd);
}

GraphManager.prototype.get_objects = function(subject, predicate) {
    var self = this;
    var ts = self.graph.match(
        _.expand(subject),
        _.expand(predicate),
        null
    );

    var resultd = {}
    ts.map(function(t) {
        if (_.isString(t.object)) {
            resultd[t.object] = true;
        } else {
            resultd[t.object.value] = true;
        }
    });
    return Object.keys(resultd);
}

GraphManager.prototype.get_dictionary = function(subject, paramd) {
    var self = this;

    paramd = _.defaults(paramd, {
    })

    var d = {}
    var ts = self.get_triples(subject, null, null, paramd);
    for (var ti in ts) {
        var t = ts[ti];

        if (paramd.as_list) {
            _.ld_set(d, t.predicate, t.object_value)
        } else {
            d[t.predicate] = t.object_value
        }
    }

    return d;
}

GraphManager.prototype.get_triples = function(subject, predicate, object, paramd) {
    var self = this;

    paramd = (paramd === undefined) ? {} : paramd;
    paramd.expand_subject = (paramd.expand_subject === undefined) ? true : false;
    paramd.expand_predicate = (paramd.expand_predicate === undefined) ? true : false;
    paramd.expand_object = (paramd.expand_object === undefined) ? true : false;
    paramd.compact_subject = (paramd.compact_subject === undefined) ? true : false;
    paramd.compact_predicate = (paramd.compact_predicate === undefined) ? true : false;
    paramd.compact_object = (paramd.compact_object === undefined) ? true : false;

    if (paramd.expand_subject) {
        subject = _.expand(subject)
    }
    if (paramd.expand_predicate) {
        predicate = _.expand(predicate)
    }
    if (paramd.expand_subject) {
        object = _.expand(object)
    }

    var ts = self.graph.match(subject, predicate, object)

    // console.log(ts)
    ts.map(function(t) {
        if (paramd.compact_subject) {
            t.subject = _.compact(t.subject);
        }
        if (paramd.compact_predicate) {
            t.predicate = _.compact(t.predicate);
        }
        if (_.isString(t.object)) {
            if (paramd.compact_object) {
                t.object = _.compact(t.object)
            }
            t.object_value = t.object;
        } else {
            t.object_value = t.object.value;
        }
    });

    return ts;
}

GraphManager.prototype.has_type = function(subject, type) {
    var self = this;
    type = _.expand(type);
    subject = _.expand(subject);

    var types = self.get_objects(subject, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
    for (var ti = 0; ti < types.length; ti++) {
        if (types[ti] == type) {
            return true;
        }
    }
    return false;
}

GraphManager.prototype.contains_triple = function(subject, predicate, object) {
    return this.iot.gm.graph.match(
        _.expand(subject),
        _.expand(predicate),
        object
    ).length > 0;
}

/**
 *  Load a JSON-LD file (by name) into the graph
 *
 *  <p>
 *  The URL for the graph item is always "file:///<basename>"
 *  We do join the @id and @base. The only thing we're really interested in is getting
 *  the last path component, which we then convert 
 *  to file:///<component>
 *
 *  @param {string} filename
 *  the file to load
 */
GraphManager.prototype.load_file = function(filename) {
    var self = this;
    fs.readFile(filename, { encoding: 'utf8' }, function(error, data) {
        if (error) {
            console.log("GraphManager.load_file", "not ok", "filename", filename, "error", error);
            return
        }

        var body = JSON.parse(data)

        /*
         *  We make sure this looks like it came from the filesystem,
         *  munging the URLs where possible. Note that there's an 
         *  expectation here that data looks like it came from IOTDB
         *  where the JSON-LD data has already been run through compact &c
         *  so that '@context.@base' controls all the relative pathnames
         */
        var base = "file:///";

        var contextd = body['@context']
        if (contextd) {
            var cbase = contextd['@base']
            if (cbase) base = cbase;
        }

        var id = body['@id']
        if (!id) id = ''

        var urlp = node_url.parse(base);
        urlp.pathname = path.join(urlp.pathname, id)

        var basename = path.basename(urlp.pathname)
        var url = "file:///" + basename;

        if (contextd) {
            contextd['@base'] = url;
            body['@id'] = ''
        }

        self.loaded_iri(url, body)
    })
}

GraphManager.prototype.load_iri = function(iri, callback) {
    var self = this;
    var headerd = {
        'Accept': 'application/ld+json'
    }

    if (self.irid[iri] == GraphManager.IRI_LOADING) {
        return
    }
    self.irid[iri] = GraphManager.IRI_LOADING

    if (self.iot.iotdb_oauthd.access_token) {
        headerd["Authorization"] = "Bearer " + self.iot.iotdb_oauthd.access_token
    }

    unirest
        .get(iri)
        .followAllRedirects(true)
        .headers(headerd)
        .end(function(result) {
            if (!result.ok) {
                if (result.status == 404) {
                    self.failed_iri(iri, GraphManager.IRI_NOT_FOUND, result.status);
                } else if (result.status == 500) {
                    console.log("# GraphManager.load_iri: unexpected 500 error",
                        "\n ", result.body
                    )
                    self.failed_iri(iri, GraphManager.IRI_NOT_AVAILABLE, result.status);
                } else if (result.status) {
                    self.failed_iri(iri, GraphManager.IRI_NOT_AVAILABLE, result.status);
                } else {
                    self.failed_iri(iri, GraphManager.IRI_NOT_AVAILABLE, result.status);
                }

                if (callback !== undefined) {
                    callback({
                        error: result.status,
                        iri: iri
                    })
                }
            } else {
                var bodyd = result.body
                if (_.isString(result.body)) {
                    try {
                        bodyd = JSON.parse(result.body);
                    }
                    catch (x) {
                        console.log("# GraphManager.load_iri", 
                            "\n url", iri, 
                            "\n exception", x
                            // ,"\n body", result.body
                            );
                        self.failed_iri(iri, GraphManager.IRI_NOT_AVAILABLE, "unparsable result")

                        if (callback !== undefined) {
                            callback({
                                error: "unparasable result",
                                iri: iri
                            })
                        }

                        return
                    }
                }

                self.loaded_iri(iri, bodyd, callback)
            }
        })
    ;
}

GraphManager.prototype.failed_iri = function(iri, iri_status, status) {
    var self = this;

    console.log("- GraphManager.failed_iri", "\n  iri", iri, "\n  result", status)

    self.irid[iri] = iri_status
    self.iot.emit(GraphManager.EVENT_FAILED_IRI, iri)
}

GraphManager.prototype.loaded_iri = function(iri, jd, callback) {
    var self = this;

    var loading_status = self.irid[iri];
    if (loading_status === GraphManager.IRI_PROCESSING) {
        return
    }

    self.irid[iri] = GraphManager.IRI_PROCESSING

    jd['@id'] = iri;
    self.load_jsonld(jd);
    self.iot.emit(GraphManager.EVENT_LOADED_IRI, iri, jd);

    if (callback !== undefined) {
        callback({
            iri: iri
        })
    }
};

GraphManager.prototype._onGraphUpdatedGraph = function(iri) {
    var self = this;

    // console.log(self.irid)

    self.irid[iri] = GraphManager.IRI_LOADED
    
    if (self.has_type(iri, "iot:device")) {
        console.log("- GraphManger._onUpdatedGraph:", "\n ", "got iot:device", iri)

        self.iot.emit(GraphManager.EVENT_UPDATED_DEVICE, iri)
    } else if (self.has_type(iri, "iot:system")) {
        console.log("- GraphManger._onUpdatedGraph:", "\n ", "got iot:system", iri)

        var devices = self.get_objects(
            self.iot.iotdb_prefix + "/" + self.iot.username + "/things/uuid", 
            self.iot.iotdb_prefix + "/" + self.iot.username + "/things/uuid#links");
        devices.map(function(device) {
            self.load_iri(device);
        });
    } else if (self.has_type(iri, "iot:place")) {
        console.log("- GraphManger._onUpdatedGraph:", "\n ", "got iot:place", iri)
        self.iot.emit(GraphManager.EVENT_UPDATED_PLACE, iri)
    } else if (self.has_type(iri, "iot:model")) {
        console.log("- GraphManger._onUpdatedGraph:", "\n ", "got iot:model", iri)
        self.iot.emit(GraphManager.EVENT_UPDATED_MODEL, iri)
    } else if (self.has_type(iri, "iot:item")) {
        console.log("- GraphManger._onUpdatedGraph:", "\n ", "got iot:item", iri)

        var iris = self.get_objects(iri, "iot:item")
        for (var ii in iris) {
            self.load_iri(iris[ii]);
        }
    } else {
        console.log("# GraphManger._onUpdatedGraph:", 
            "got iri but don't know the @type", 
            "\n  iri", iri)
    }

}

/*
 *  Internals
 */
GraphManager.prototype._load_flattened = function(error, jd, robjectds) {
    if (error) {
        console.log("GraphManager._load_flattened: error", _.format(error));
        return;
    }

    var self = this;
    robjectds.map(function(robjectd) {
        self._load_flattened_object(robjectd);
    });

    self.iot.emit(GraphManager.EVENT_UPDATED_GRAPH, jd['@id']);
}

GraphManager.prototype._load_flattened_object = function(robjectd) {
    var self = this;

    var node_subject = robjectd['@id']
    if (!node_subject) {
        return;
    }

    var node_types = robjectd['@type'];
    if (node_types) {
        node_types.map(function(node_type) {
            self._load_node({
                node_subject : node_subject,
                node_predicate : _.rdf_type,
                node_object_id : node_type
            });
        });
    }

    Object.keys(robjectd).map(function(node_predicate) {
        if (node_predicate.substring(0, 1) == '@') {
            return;
        }

        var node_objectds = robjectd[node_predicate];
        node_objectds.map(function(node_objectd) {
            self._load_node({
                node_subject : node_subject,
                node_predicate : node_predicate,
                node_objectd : node_objectd,
                node_object_id : node_objectd['@id'],
                node_object_value : node_objectd['@value'],
                node_types : node_types,
            })
        });
    });

    self.iot.emit(GraphManager.EVENT_UPDATED_SUBJECT, node_subject);
};

GraphManager.prototype._load_node = function(noded) {
    var self = this;
    var env = rdf.environment;

    // console.log(noded);
    if (noded.node_object_id !== undefined) {
        if (this.verbose) console.log("subject", noded.node_subject, 
            "\n", "predicate", noded.node_predicate, 
            "\n", "object(url)", noded.node_object_id);

        var t = env.createTriple(
            noded.node_subject,
            noded.node_predicate,
            noded.node_object_id
        );
            
        self.graph.add(t);
        return;
    }

    if (noded.node_object_value !== undefined) {
        if (this.verbose) console.log("subject", noded.node_subject, 
            "\n", "predicate", noded.node_predicate, 
            "\n", "object(value)", noded.node_object_value);

        var t = env.createTriple(
            noded.node_subject,
            noded.node_predicate,
            env.createLiteral(
                noded.node_object_value,
                null,
                null
            )
        );
        self.graph.add(t);
        return;
    }
}

/*
 *  API
 */
exports.GraphManager = GraphManager;
