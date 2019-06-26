const { dialog } = require('electron').remote
const Buffer = require('buffer').Buffer;
const $ = require('jquery');
const https = require('https');
const plotly = require('plotly.js');
const d3 = require('d3');

let auth = null;
const api_base = 'https://baas.kinvey.com/appdata/kid_B1bNWWRsX/PSDSData';

$( window ).resize(function() {
	plotly.Plots.resize(d3.select('#plot').node());
});

$('#submit').on('click', function() {
    const un = $('#username').val();
    const pw = $('#password').val();
    makeAuth(un, pw);
    makeRequest('psds1001', new Date('2019-06-08'), 50, 1)
        .then(dataArray => { plotData( dataArray ) })
        .catch(err => { showError(err) });
});

function plotData(dataArray) {
    const data = dataArray
          .map(d => d.sensor_data)
          .reduce((obj, entry) => {
              const typeString = sensorTypeToString(entry.s);
              if (typeString !== 'unknown') {
                  if (!obj[typeString]) {
                      // create new plot data object
                      let t = [];
                      obj[typeString] = {
                          't': t,
                          'x': {
                              x: t, y: [], name: typeString + ' x', type: 'scatter', mode: 'lines'
                          },
                          'y': {
                              x: t, y: [], name: typeString + ' y', type: 'scatter', mode: 'lines'
                          },
                          'z': {
                              x: t, y: [], name: typeString + ' z', type: 'scatter', mode: 'lines'
                          }                              
                      };
                  }
                  obj[typeString]['t'].push(entry.t);
                  obj[typeString]['x'].y.push(entry.d[0]);
                  obj[typeString]['y'].y.push(entry.d[0]);
                  obj[typeString]['z'].y.push(entry.d[0]);
              }
              return obj;
          }, {});
    const pdata = Object.keys(data).reduce((arr, k) => {
        return arr.concat([
            data[k].x,
            data[k].y,
            data[k].z
        ]);
    }, []);
    /*
	var gd3 = d3.select('#plot')
		.style({
		    width: '100%',
		    'min-width': '400px',
		    height: '100%',
		    'min-height': '200px'
		});
	var gd = gd3.node();
    */
	var gd = d3.select('#plot').node();
    const layout = makeLayout();
	Plotly.plot(gd, pdata, layout, {
		modeBarButtons: [[{
		    'name': 'toImage',
		    'title': 'Download plot as png',
		    'icon': Plotly.Icons.camera,
		    'click': function(gd) {
			    var format = 'png';

			    var n = $(container).find(id);
			    Plotly.downloadImage(gd, {
			        'format': format,
			        'width': n.width(),
			        'height': n.height(),
			    })
			        .then(function(filename) {
			        })
			        .catch(function() {
			        });
		    }
		}],[
		    'zoom2d',
		    'pan2d',
		    'select2d',
		    'lasso2d',
		    'zoomIn2d',
		    'zoomOut2d',
		    'autoScale2d',
		    'resetScale2d',
		    'hoverClosestCartesian',
		    'hoverCompareCartesian'
		]],
	});
    
}

function sensorTypeToString(t) {
    let typeString = 'unknown';
    switch (t) {
    case 9:
        typeString = 'Gravity'
        break;
    case 10:
        typeString = 'Linear Acceleration'
        break;
    case 4:
        typeString = 'Gyroscope'
        break;
    case 15:
        typeString = 'Rotation Vector'
        break;
    }
    return typeString;
}

function makeRequest(userId, date, limit, skip) {
    if (!auth) {
        return Promise.reject({
            error: 'No Credentials Provided',
            description: 'No username / password combination was provided.'
        });
    }
    // do a test request
    let url = api_base;
    url += '?';
    const query = {
        user_identifier: userId,
        '_kmd.ect': {
            '$gt': date.toISOString()
        }
    };
    url += `query=${JSON.stringify(query)}&`;
    url += `limit=${limit}&`;
    url += 'skip=${skip}';
    const options = {
        headers: {
            'Authorization': auth
        },
        method: 'GET'
    };
    return fetch(url, options)
        .then(data => data.json())
        .then(res => {
            if (res.error) {
                throw res;
            }
            // do something here
            console.log('got res', res);
            return res;
        });
}

function makeAuth(un, pw) {
    auth = null;
    if (un && pw) {
        // set up the auth
	    const authorizationToEncode = `${un}:${pw}`;
	    const _auth = new Buffer.from(authorizationToEncode);
	    auth = 'Basic ' + _auth.toString('base64');
    }
}

function showError(err) {
    console.error('showError:',err);
    let title = 'Error Making Kinvey Request';
    if (err.error) title += ' - ' + err.error;
    let message = '';
    if (err.description) message += err.description;
    if (err.debug) message += '\n\n' + err.debug;
    dialog.showErrorBox(title, message);
}
