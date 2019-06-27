const {remote} = require('electron');
const $ = require('jquery');
const plotly = require('plotly.js');
const d3 = require('d3');
const axios = require('axios');
const privateKeys = require('@maxmobility/private-keys');
const {startSpinner, stopSpinner} = require('./spinner');

const {CancelToken} = axios;
const {dialog} = remote;
const keytar = remote.require('keytar');

const keytarServiceName = 'com.permobil.electron.kinvey.portal';
const keytarKinveyName = 'KinveyAccountToken';

let auth = null;
let token = null;
keytar.getPassword(keytarServiceName, keytarKinveyName)
  .then(t => {
    token = t;
    if (token) {
      auth = sessionAuth(token);
      hideLogin();
      showMenu();
    } else {
      hideMenu();
    }
  });

let username = null;
let password = null;
let userData = {};
let plotDataArray = [];
const apiBase = privateKeys.KinveyKeys.HOST_URL;
const appKey = privateKeys.KinveyKeys.PROD_KEY;
const dbId = 'PSDSData';
const appAuth = privateKeys.KinveyKeys.PROD_SECRET;

$(window).resize(() => {
  plotly.Plots.resize(d3.select('#plot').node());
});

$('#submit').on('click', () => {
  username = $('#username').val();
  password = $('#password').val();
  startSpinner();
  login()
    .then(ret => {
      stopSpinner();
      console.log('got ret', ret);
      if (ret) {
        hideLogin(500);
        showMenu(500);
      }
    })
    .catch(error => {
      stopSpinner();
      showError(error);
    });
});

$('#fetch').on('click', () => {
  const userId = $('#user_id').val();
  const date = $('#date').val();
  const limit = $('#limit').val();
  const skip = $('#skip').val();
  console.log(date);
  startSpinner();
  makeRequest(userId, new Date(date), limit, skip)
    .then(dataArray => {
      stopSpinner();
      if (dataArray) {
        plotData(dataArray);
      }
    })
    .catch(error => {
      stopSpinner();
      showError(error);
    });
});

$('#clear_plot').on('click', () => {
  clearPlot();
});

function clearPlot() {
  plotly.purge(d3.select('#plot').node());
  userData = {};
  plotDataArray = [];
}

function plotData(dataArray) {
  console.log('plotting data');
  dataArray
    .map(d => {
      return d.sensor_data;
    })
    .flat()
    // eslint-disable-next-line array-callback-return
    .map(entry => {
      const typeString = sensorTypeToString(entry.s);
      if (typeString !== 'unknown') {
        if (!userData[typeString]) {
          // Create new plot data object
          const t = [];
          userData[typeString] = {
            t,
            x: {
              x: t, y: [], name: typeString + ' x', type: 'scatter', mode: 'lines'
            },
            y: {
              x: t, y: [], name: typeString + ' y', type: 'scatter', mode: 'lines'
            },
            z: {
              x: t, y: [], name: typeString + ' z', type: 'scatter', mode: 'lines'
            }
          };
          // Make sure to update the data array
          plotDataArray.push(
            userData[typeString].x,
            userData[typeString].y,
            userData[typeString].z
          );
        }

        // Now add the new data
        userData[typeString].t.push(new Date(entry.t));
        userData[typeString].x.y.push(entry.d[0]);
        userData[typeString].y.y.push(entry.d[1]);
        userData[typeString].z.y.push(entry.d[2]);
      }
    });
  const gd = d3.select('#plot').node();
  const layout = makeLayout();
  plotly.react(gd, plotDataArray, layout, {
    modeBarButtons: [[{
      name: 'toImage',
      title: 'Download plot as png',
      icon: plotly.Icons.camera,
      click(gd) {
        const format = 'png';

        const n = $('.container').find('#plot');
        plotly.downloadImage(gd, {
          format,
          width: n.width(),
          height: n.height()
        })
          .catch(() => {
          });
      }
    }], [
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
    ]]
  });
}

function makeLayout() {
  const layout = {
    datarevision: new Date().getTime(),
    xaxis: {
      title: 'Time (s)'
    },
    legend: {
      xanchor: 'right'
    },
    margin: {
      pad: 0,
      l: 50,
      r: 50,
      b: 50,
      t: 50
    },
    hovermode: 'closest',
    autosize: true,
    showlegend: true
  };
  return layout;
}

function sensorTypeToString(t) {
  let typeString = 'unknown';
  switch (t) {
    case 9:
      typeString = 'Gravity';
      break;
    case 10:
      typeString = 'Linear Acceleration';
      break;
    case 4:
      typeString = 'Gyroscope';
      break;
    case 15:
      typeString = 'Rotation Vector';
      break;
    default:
      typeString = 'unknown';
      break;
  }

  return typeString;
}

function makeRequest(userId, date, limit, skip) {
  if (!auth) {
    // eslint-disable-next-line prefer-promise-reject-errors
    return Promise.reject({
      error: 'No Credentials Provided',
      description: 'No username / password combination was provided.'
    });
  }

  console.log('fetching data from kinvey.');
  // Do a test request
  const userIdKey = 'user_identifier';
  const query = {
    [userIdKey]: userId,
    '_kmd.ect': {
      $gt: date.toISOString()
    }
  };
  let cancel = null;
  const url = `${apiBase}/appdata/${appKey}/${dbId}`;
  return axios.get(url, {
    params: {
      query,
      limit,
      skip
    },
    headers: {
      Authorization: auth
    },
    onDownloadProgress: progressEvent => {
      console.log('download progress');
      console.log(progressEvent);
    },
    onUploadProgress: progressEvent => {
      console.log('upload progress');
      console.log(progressEvent);
    },
    cancelToken: new CancelToken(c => {
      cancel = c;
    })
  })
    .then(res => res.data)
    .catch(error => {
      cancel();
      showError(error);
    });
}

function login() {
  const data = {
    username,
    password
  };
  const headers = {
    Authorization: makeAuth(appKey, appAuth),
    'Content-Type': 'application/json'
  };
  let cancel = null;
  const url = `${apiBase}/user/${appKey}/login`;
  console.log(url);
  console.log(data);
  console.log(headers);
  return axios({
    url,
    method: 'post',
    data,
    headers,
    cancelToken: new CancelToken(c => {
      cancel = c;
    })
  })
    .then(res => res.data)
    .then(data => {
      token = data._kmd.authtoken;
      auth = null;
      if (token) {
        keytar.setPassword(keytarServiceName, keytarKinveyName, token);
        auth = sessionAuth(token);
      }

      console.log(token);
      console.log(auth);
      return Boolean(auth);
    })
    .catch(error => {
      cancel();
      showError(error);
      return false;
    });
}

function basicAuth(s) {
  return 'Basic ' + Buffer.from(s).toString('base64');
}

function sessionAuth(s) {
  return 'Kinvey ' + s;
}

function makeAuth(un, pw) {
  let _auth = null;
  if (un && pw) {
    // Set up the auth
    _auth = basicAuth(`${un}:${pw}`);
  }

  return _auth;
}

function showError(err) {
  console.error('showError:', err);
  let title = 'Error Making Kinvey Request';
  if (err.error) {
    title += ' - ' + err.error;
  }

  let message = '';
  if (err.description) {
    message += err.description;
  }

  if (err.debug) {
    message += '\n\n' + err.debug;
  }

  dialog.showErrorBox(title, message);
}

function hideMenu(duration) {
  if (duration) {
    $('#controls').hide({duration});
  } else {
    $('#controls').hide();
  }
}

function showMenu(duration) {
  if (duration) {
    $('#controls').show({duration});
  } else {
    $('#controls').show();
  }
}

function hideLogin(duration) {
  if (duration) {
    $('#login').hide({duration});
  } else {
    $('#login').hide();
  }
}
