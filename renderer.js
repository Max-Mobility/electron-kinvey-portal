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

function showError(err) {
    console.error('showError:',err);
    let title = 'Error Making Kinvey Request';
    if (err.error) title += ' - ' + err.error;
    let message = '';
    if (err.description) message += err.description;
    if (err.debug) message += '\n\n' + err.debug;
    dialog.showErrorBox(title, message);
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
