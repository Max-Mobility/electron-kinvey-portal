var Buffer = require('buffer').Buffer;
var $ = require("jquery");
let auth = null;

$('#submit').on('click', function() {
    const un = $('#username').val();
    const pw = $('#password').val();
    if (un && pw) {
	    const authorizationToEncode = `${un}:${pw}`;
	    const _auth = new Buffer.from(authorizationToEncode);
	    auth = 'Basic ' + _auth.toString('base64');
        console.log('auth', auth);
    }
});
