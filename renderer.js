const Buffer = require('buffer').Buffer;
const $ = require('jquery');
const https = require('https');

let auth = null;
const api_base = 'https://baas.kinvey.com/appdata/kid_B1bNWWRsX/PSDSData';

$('#submit').on('click', function() {
    const un = $('#username').val();
    const pw = $('#password').val();
    if (un && pw) {
        // set up the auth
	    const authorizationToEncode = `${un}:${pw}`;
	    const _auth = new Buffer.from(authorizationToEncode);
	    auth = 'Basic ' + _auth.toString('base64');
        console.log('auth', auth);
        // do a test request
        let url = api_base;
        url += '?';
        const query = {
            user_identifier: 'psds1001',
            '_kmd.ect': {
                '$gt': new Date('2019-06-08').toISOString()
            }
        };
        url += `query=${JSON.stringify(query)}&`;
        url += 'limit=1&';
        url += 'skip=1';
        const options = {
            headers: {
                'Authorization': auth
            },
            method: 'GET'
        };
        fetch(url, options)
            .then(data => data.json())
            .then(res => {
                // do something here
                console.log('got res', res);
            })
            .catch(err => {
                console.error(error);
            });
    }
});
