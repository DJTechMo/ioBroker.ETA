/*jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

const request   = require('request-promise');
const utils     = require(__dirname + '/lib/utils');
const adapter   = new utils.Adapter('etacontrol');
const xpath     = require('xpath');
const DOMParser    = require('xmldom').DOMParser;
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const select = xpath.useNamespaces({"eta": "http://www.eta.co.at/rest/v1"});
var   menu;
var   variables;
var   menuNodes;
var   addedChannels = 0;
var   addedObjects = 0;
var   addedVariables = 0;
var   skippedVariables = 0;

var   elements = [];
var   elementsValue = [];
var   channels = [];


adapter.on('ready', function () {
	

    	// Start reading the data from ETA unit
	adapter.log.debug("**ETA read called");
    	readEta();
		
	adapter.stop();
});

function readEta() {
	// Check if the expectedt global variable (etamon) does exist in the ETA device
	adapter.log.debug("** Retrieve ETA variable etamon");
	
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
    		if (this.readyState == 4 && this.status == 200) {
				//getMenu();
				adapter.log.debug("**ETA connected and found data");
				getMenu();
   			}
	};
	xhttp.open("GET", adapter.config.etaService+"vars/etamon", true);
	xhttp.send();

}

function getMenu(createStructure) {
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
    		if (this.readyState == 4 && this.status == 200) {
				//getMenu();
				adapter.log.debug("**ETA connected and found data");
				var parser = new DOMParser();
				menu = parser.parseFromString(xhttp.responseText,"text/xml");
				adapter.log.debug(menu);
				adapter.log.debug("** Menu variables read - next: setVariables");
				
				var fubs=menu.getElementsByTagName("fub");
				for(var i = 0; i<1; i++) {
					var mainNode=fubs[i];
					adapter.log.debug("** Found fub: "+mainNode);
				        adapter.setObjectNotExistsAsync(mainNode.getAttribute("name"), 
					{
				        	type: 'channel',
				           	common: {
				            		name: mainNode.getAttribute("name")
				        	},
				        	native: {}
				        }, function(err) {
				    		if(err==null) {
					    		adapter.log.silly("*** Channel created");
					    			adapter.log.debug("** Found child nodes: "+mainNode.childNodes.length);
					    			for(var j = 0; j<mainNode.childNodes.length; j++) {
					    				var childNode=mainNode.childNodes[j];
					    				adapter.log.debug("** Found child node: "+childNode);
					    				if(childNode=="")
					    				{}else{
					    					adapter.setObjectNotExistsAsync(childNode.getAttribute("name"), 
											{
										        	type: 'channel',
										           	common: {
										            		name: childNode.getAttribute("name")
										        	},
										        	native: {}
										        }, function(err) {
										    		if(err==null) {
											    		adapter.log.silly("*** Channel created");
											    	} else {
											    		adapter.log.silly("*** Channel not created (already exists?): "+err);
											    	}
										    	}
											);
					    				}				
					    				/*adapter.setObjectNotExistsAsync(childNode.getAttribute("name"), 
										{
									        	type: 'channel',
									           	common: {
									            		name: childNode.getAttribute("name")
									        	},
									        	native: {}
									        }, function(err) {
									    		if(err==null) {
										    		adapter.log.silly("*** Channel created");
										    	} else {
										    		adapter.log.silly("*** Channel not created (already exists?): "+err);
										    	}
									    	}
										);*/


					    			}

					    	} else {
					    		adapter.log.silly("*** Channel not created (already exists?): "+err);
					    	}
				    	}
					);
				}
   			}else{
   				adapter.log.error("** ETA connection issue: "+this.status);
   			}
	};
	xhttp.open("GET", adapter.config.etaService+"menu", true);
	xhttp.send();
}

function setVariables() {
	menuNodes = (select('//eta:*[@uri]', menu));
	adapter.log.debug("** ETA menu nodes found: "+menuNodes.length);
	getVariables();
}

function getVariables() {
	var xhttp = new XMLHttpRequest();
		xhttp.onreadystatechange = function() {
	    		if (this.readyState == 4 && this.status == 200) {
       			
					var parser = new DOMParser();
					variables = parser.parseFromString(xhttp.responseText);
					setObjects();
	   			}
		};
		xhttp.open("GET", adapter.config.etaService+"vars/etamon", true);
		xhttp.send();
	
	
	
	
}

function setObjects() {
	//console.log("setObjects 01");
	

	var addedNodes = 0;
	var addedVariables = 0;
	var skippedVariables = 0;
	var thisUri = "";
	adapter.log.debug("** ETA menu nodes found: "+menuNodes.length);
	//console.log("setObjects 02");
	
	
	for(var i = 0; i<10; i++) {
		//console.log("setObjects 03 - "+i);
		adapter.log.debug("** Try to add ETA menu node ["+i+"/"+menuNodes.length+"]: "+menuNodes[i] );
		var parentNodes = (select('ancestor::eta:*[@uri]', menuNodes[i]));
		var parentPath = "";
		for(var pkey in parentNodes) {
			var parentNode = parentNodes[pkey];
			if (parentNode.getAttribute("uri")!="") {
				if(parentPath!="") {
					parentPath = parentPath + ".";
				}
				parentPath = parentPath + parentNode.getAttribute("uri").substr(1);
			}
		}
		
		if(parentPath!="") {
			thisUri = parentPath.split("/").join("_")+"."+menuNodes[i].getAttribute("uri").substr(1).split("/").join("_");
		} else {
			thisUri = menuNodes[i].getAttribute("uri").substr(1).split("/").join("_");
		}
		//adapter.log.debug("** Create object ["+menuNodes[i].getAttribute("name")+"] "+thisUri);
		var varObjects = (select('//eta:variable[@uri="'+menuNodes[i].getAttribute("uri").substr(1)+'"]',variables));
		//console.log("** Create object ["+menuNodes[i].getAttribute("name")+"] "+thisUri);
		//adapter.stop();
		if(varObjects.length==0) {
			//console.log("setObjects 03.a - "+i);
			channels.push([thisUri, menuNodes[i].getAttribute("name")]);
			adapter.log.silly("** Channel: "+thisUri+" ("+menuNodes[i].getAttribute("name")+") ["+channels.length+"]");
			//setChannel(thisUri, menuNodes[i].getAttribute("name"));
			//console.log("** addedChannels: "+addedChannels);
		} else {
			//console.log("setObjects 03.b - "+i);
			// Read attributes from value node
			var AttUri           = (select('./@uri',           varObjects[0])[0].nodeValue);
			var AttStrValue      = (select('./@strValue',      varObjects[0])[0].nodeValue);
			var AttUnit          = (select('./@unit',          varObjects[0])[0].nodeValue);
			var AttDecPlaces     = (select('./@decPlaces',     varObjects[0])[0].nodeValue);
			var AttScaleFactor   = (select('./@scaleFactor',   varObjects[0])[0].nodeValue);
			var AttAdvTextOffset = (select('./@advTextOffset', varObjects[0])[0].nodeValue);
			var AttText          = (select('./text()',         varObjects[0])[0].nodeValue);
			
			//console.log("object to add: "+thisUri+" => "+menuNodes[i].getAttribute("name"));
			
			// Set params for object
			if(AttUnit.length>0) {
				var outValue = AttText * 1.0 / AttScaleFactor * 1.0;
				var outType  = "number"
				var outUnit  = AttUnit;
				if(AttUnit=="°C") {
					var outRole  = "value.temperature";
				} else {
					var outRole  = "state";
				}
			} else {
				var outValue = AttStrValue;
				var outType  = "text"
				var outUnit  = AttUnit;
				var outRole  = "state";
			}
			adapter.log.silly("*** outUri  : " + thisUri);
			adapter.log.silly("***   strValue     : " + AttStrValue);
			adapter.log.silly("***   unit         : " + AttUnit);
			adapter.log.silly("***   decPlaces    : " + AttDecPlaces);
			adapter.log.silly("***   scaleFactor  : " + AttScaleFactor);
			adapter.log.silly("***   advTextOffset: " + AttAdvTextOffset);
			adapter.log.silly("***   text()       : " + AttText);
			adapter.log.silly("***     outType  : " + outType);
			adapter.log.silly("***     outValue : " + outValue);
			adapter.log.silly("***     outUnit  : " + outUnit);
			adapter.log.silly("***     outRole  : " + outRole);
			
			// Create object and store data
			//setObject(thisUri, menuNodes[i].getAttribute("name"), outType, outUnit, outRole);
			//setValue (thisUri, outValue);
			elements.push([thisUri, menuNodes[i].getAttribute("name"), outType, outUnit, outRole, outValue]);
			adapter.log.silly("** Element: "+thisUri+" ("+menuNodes[i].getAttribute("name")+") ["+elements.length+"]");
		}
		//console.log("setObjects 04");
		//console.log(varObjects[0]);
	}
	//console.log("setObjects 05");
	//adapter.log.debug("** Channels: "+channels.length);
	//adapter.log.debug("** Elements: "+elements.length);
	// adapter.stop();
	createChannels();
	
	
	/*
	for(var i = 0; i<channels.length; i++) {
		setChannel(channels[i][0], channels[i][1]);
	}
	for(var i = 0; i<eöements.length; i++) {
		setObject(eöements[i][0], eöements[i][1], eöements[i][2], eöements[i][3], eöements[i][4]);
	}
	*/
	// setChannel(thisUri, menuNodes[i].getAttribute("name")); -> channels
	// setObject(thisUri, menuNodes[i].getAttribute("name"), outType, outUnit, outRole) -> eöements
	// setValue (thisUri, outValue);
	
	/*
	adapter.log.silly("** addedObjects: "+addedObjects+", addedVariables: "+addedVariables);
	
	adapter.log.debug("** ETA Adapter finished");
	*/
	//adapter.stop();
	
}

function createChannels() {
	
	/*adapter.log.debug("** Channels to create: "+channels.length);
	if(channels.length>0) {	
		createChannel();
	} else {
		adapter.log.debug("** Channels created - next: setObjects");
		createObjects();
	}*/
}

function createChannel() {
	
	adapter.log.silly("*** Creating channel: " + channels[0][0]);
    adapter.setObjectNotExistsAsync(channels[0][0], {
        type: 'channel',
        common: {
            name: channels[0][1]
        },
        native: {}
    }, function(err) {
    	if(err) {
	    	adapter.log.silly("*** Channel created");
		    channels.shift();
		    createChannels();
	    } else {
	    	adapter.log.silly("*** Channel not created (already exists?): "+err);
		    channels.shift();
		    createChannels();
	    }
    });
	adapter.log.silly("*** Created channel: " + channels[0][0]);
	
}

function createObjects() {
	
	adapter.log.debug("** Elements to create: "+elements.length);
	if(elements.length>0) {	
		elementsValue.push(elements[0]);
		createObject();
	} else {
		adapter.log.debug("** Elements created - next: writeObjects");
		writeObjects();
	}
}

function createObject() {
	
	adapter.log.silly("*** Creating element: " + elements[0][0]);
    adapter.setObjectNotExists(elements[0][0], {
        type: 'state',
        common: {
            name: elements[0][1],
            type: elements[0][2],
            unit: elements[0][3],
            role: elements[0][4]
        },
        native: {}
    }, function(err) {
    	if(!err) {
	    	adapter.log.silly("*** Element created");
    		elements.shift();
    		createObjects();
	    } else {
	    	adapter.log.error("*** Element not created: "+err);
    		elements.shift();
    		createObjects();
	    }
    });
	adapter.log.silly("*** Created element: " + elements[0][0]);
	
}

function writeObjects() {
	
	adapter.log.debug("** Elements to write: "+elementsValue.length);
	if(elementsValue.length>0) {	
		writeObject();
	} else {
		adapter.log.debug("** Elements written - next: NOTHING");
		adapter.log.info("** ETA Adapter finished");
		// Skript finished...
		adapter.stop();
	}
}

function writeObject() {
	adapter.log.silly("*** Writing element: " + elementsValue[0][0]+" => "+elementsValue[0][5]);
    adapter.setStateAsync(elementsValue[0][0], {
    	val: elementsValue[0][5], 
    	ack: true
    }, function(err) {
    	if(!err) {
	    	adapter.log.silly("*** Element written");
    		elementsValue.shift();
    		createObjects();
	    } else {
	    	adapter.log.error("*** Element not written: "+err);
    		elementsValue.shift();
    		createObjects();
	    }
    });
	adapter.log.silly("*** Written element: " + elementsValue[0][0]+" => "+elementsValue[0][5]);
}

function deleteEta() {
	/*adapter.log.debug("** Deleting ETA variabel etamon");
	request(
		{
			url: adapter.config.etaService+"vars/etamon",
			method: "DELETE"
		},
		function(error, response, content) {
			if(!error && response.statusCode == 200) {
				adapter.log.debug("** ETA variable deleted!");
			} else {
				adapter.log.error(error);
			}
		}
	).then(
		function() {
			adapter.log.debug("** Deleted ETA variabel etamon");
			readEta();
		}
	).catch(
		function() {
			adapter.log.debug("** No ETA variabel etamon found to delete");
			readEta();
		}
	);
	adapter.log.debug("** Deleted ETA variabel etamon");
	*/
}
