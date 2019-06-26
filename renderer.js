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
        .catch(err => { showError(err) });
});

function plotData(dataArray) {
    const pdata = dataArray.sensor_data
          .filter(d => {
              return d.s == 10; // linear acceleration
          })
          .reduce((arr, data) => {
              return arr.concat(data.d);
          }, []);
	var gd3 = d3.select('#plot')
		.style({
		    width: '100%',
		    'min-width': '400px',
		    height: '100%',
		    'min-height': '200px'
		});

	var gd = gd3.node();
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
