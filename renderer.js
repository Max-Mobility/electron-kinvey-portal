const {remote} = require('electron');
const $ = require('jquery');
const plotly = require('plotly.js');
const d3 = require('d3');
const axios = require('axios');
const privateKeys = require('@maxmobility/private-keys');
const config = require('./config');
const {startSpinner, stopSpinner} = require('./spinner');

const {CancelToken} = axios;
const {dialog} = remote;
const keytar = remote.require('keytar');

const keytarServiceName = 'com.permobil.electron.kinvey.portal';
const keytarKinveyName = 'KinveyAccountToken';

let auth = null;
let token = null;

let username = null;
let password = null;
let userData = {};
let userDataArray = [];
let geoData = {};
let geoDataArray = [];
const apiBase = privateKeys.SmartEvalKinveyKeys.HOST_URL;
let appKey = config.get('kinvey.environment');
let dbId = config.get('kinvey.collection');
console.log(privateKeys);
let appAuth = privateKeys.SmartEvalKinveyKeys.PROD_SECRET;
const mapboxKey = privateKeys.MapboxKeys.MAPBOX_TOKEN;

const envAuth = {
  [privateKeys.SmartEvalKinveyKeys.PROD_KEY]: privateKeys.SmartEvalKinveyKeys.PROD_SECRET,
  [privateKeys.SmartEvalKinveyKeys.DEV_KEY]: privateKeys.SmartEvalKinveyKeys.DEV_SECRET
};

$(document).ready(() => {
  // Set up ui
  showLogin();
  hideMenu();
  // Load saved login token and update ui accordingly
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
  // Build environment selector
  $('#environment_select').append(new Option('Production', privateKeys.SmartEvalKinveyKeys.PROD_KEY));
  $('#environment_select').append(new Option('Development', privateKeys.SmartEvalKinveyKeys.DEV_KEY));
  // Update auth when environment is selected
  $('#environment_select').change(function () {
    console.log('env select');
    appKey = $(this).children('option:selected').val();
    appAuth = envAuth[appKey];
    config.set('kinvey.environment', appKey);
  });
  // Update db id when collection is selected
  $('#collection_select').change(function () {
    console.log('collection select');
    dbId = $(this).children('option:selected').val();
    config.set('kinvey.collection', dbId);
  });

  // Set the selected one based on what is saved
  $('#environment_select').val(appKey);
  $('#collection_select').val(dbId);
});

$('#logout').on('click', () => {
  logout()
    .then(() => {
      hideMenu(500);
      showLogin(500);
    });
});

$('#submit').on('click', () => {
  username = $('#username').val();
  password = $('#password').val();
  startSpinner();
  login()
    .then(ret => {
      stopSpinner();
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
        collectData(dataArray);
        plotData();
        plotGeo();
      }
    })
    .catch(error => {
      stopSpinner();
      showError(error);
    });
});

$('#fetch_geo').on('click', () => {
  const userId = $('#user_id').val();
  const date = $('#date').val();
  const limit = $('#limit').val();
  const skip = $('#skip').val();
  const fields = ['location', 'locations','user_identifier']
  console.log(date);
  startSpinner();
  makeRequest(userId, new Date(date), limit, skip, fields)
    .then(dataArray => {
      stopSpinner();
      if (dataArray) {
        collectData(dataArray);
        plotData();
        plotGeo();
      }
    })
    .catch(error => {
      stopSpinner();
      showError(error);
    });
});

$('#fetch_sensor').on('click', () => {
  const userId = $('#user_id').val();
  const date = $('#date').val();
  const limit = $('#limit').val();
  const skip = $('#skip').val();
  const fields = ['sensor_data','user_identifier']
  console.log(date);
  startSpinner();
  makeRequest(userId, new Date(date), limit, skip)
    .then(dataArray => {
      stopSpinner();
      if (dataArray) {
        collectData(dataArray);
        plotData();
        plotGeo();
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

function resizePlots() {
  d3.selectAll('.kinvey-plot').each(function () {
    if (d3.select(this).node()) {
      plotly.Plots.resize(d3.select(this).node()).catch(error => {
        console.error(error);
      });
    }
  });
}

function clearPlot() {
  try {
    plotly.purge(d3.select('#raw_data').node());
    plotly.purge(d3.select('#locations').node());
  } catch (error) {
    console.error(error);
  }

  userData = {};
  userDataArray = [];
  geoData = {};
  geoDataArray = [];
}

function updateGeoData(geo, userId) {
  // Upsert geodata
  if (!geoData[userId]) {
    geoData[userId] = {
      type: 'scattermapbox',
      mode: 'lines',
      name: userId,
      lon: [],
      lat: [],
      time: [],
      text: []
    };
    geoDataArray.push(geoData[userId]);
  }

  const lat = geo.latitude;
  const lon = geo.longitude;
  const t = geo.time;
  // find the right place to insert
  let index = 0;
  geoData[userId].time.map((time, i) => {
    if (time < t) index = i + 1;
  });
  var closest = geoData[userId].time.reduce(function(prev, curr) {
    return (Math.abs(curr - t) < Math.abs(prev - t) ? curr : prev);
  }, -1);
  if (closest !== t) {
    // Insert into geodata
    geoData[userId].lon.splice(index, 0, lon);
    geoData[userId].lat.splice(index, 0, lat);
    geoData[userId].time.splice(index, 0, t);
    geoData[userId].text.splice(index, 0, new Date(t));
    console.log(geoData[userId].time);
  }
  console.log(geoData[userId].time);
}

function collectData(dataArray) {
  console.log('parsing data');
  dataArray
    .map(d => {
      // Pull out which user this is
      const userId = d.user_identifier;
      // Pull out the location data
      const geo = d.location;
      const geos = d.locations;
      if (geos && geos.length) {
        console.log('has updated location data');
        // NEW STYLE LOCATION ARRAY
        // eslint-disable-next-line array-callback-return
        geos.map(g => {
          updateGeoData(g, userId);
        });
      } else if (geo) {
        console.log('only has old style location data');
        // OLD STYLE SINGLE LOCATION PER ENTRY
        updateGeoData(geo, userId);
      } else {
        console.log('no location data for this record.');
      }

      // Need to return the original for the chain
      return d;
    })
      // eslint-disable-next-line array-callback-return
    .map(d => {
      // Pull out which user this is
      const userId = d.user_identifier;
      d.sensor_data
      // eslint-disable-next-line array-callback-return
        .map(entry => {
          if (entry === null || entry === undefined) return;
          const typeString = userId + ' ' + sensorTypeToString(entry.s);
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
              userDataArray.push(
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
    });
}

function plotGeo() {
  if (geoDataArray.length <= 0) {
    return;
  }

  console.log('plotting geo');
  const gd = d3.select('#locations').node();
  const center = {
    lat: geoDataArray[0].lat[0],
    lon: geoDataArray[0].lon[0]
  };
  const layout = makeGeoLayout(center);
  plotly.setPlotConfig({
    mapboxAccessToken: mapboxKey
  });
  plotly.react(gd, geoDataArray, layout, {
    modeBarButtons: [[{
      name: 'toImage',
      title: 'Download plot as png',
      icon: plotly.Icons.camera,
      click(gd) {
        const format = 'png';

        const n = $('.container').find('#raw_data');
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

function plotData() {
  console.log('plotting data');
  const gd = d3.select('#raw_data').node();
  const layout = makeLayout();
  plotly.react(gd, userDataArray, layout, {
    modeBarButtons: [[{
      name: 'toImage',
      title: 'Download plot as png',
      icon: plotly.Icons.camera,
      click(gd) {
        const format = 'png';

        const n = $('.container').find('#raw_data');
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

function makeGeoLayout(coord) {
  const layout = {
    mapbox: {
      center: {
        lat: coord.lat,
        lon: coord.lon
      },
      domain: {
        x: [0, 1],
        y: [0, 1]
      },
      style: 'dark',
      zoom: 10
    },
    margin: {
      r: 0,
      t: 0,
      b: 0,
      l: 0,
      pad: 0
    }
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

function makeRequest(userId, date, limit, skip, fields = undefined) {
  if (!auth) {
    // eslint-disable-next-line prefer-promise-reject-errors
    return Promise.reject({
      error: 'No Credentials Provided',
      description: 'No username / password combination was provided.'
    });
  }

  console.log('fetching data from kinvey.');
  // Do a test request
  const query = {};
  if (userId) {
    const userIdKey = 'user_identifier';
    query[userIdKey] = userId;
  }

  if (date) {
    query['_kmd.ect'] = {
      $gt: date.toISOString()
    };
  }

  if (fields && fields.length) {
    fields = fields.join(',')
  }

  let cancel = null;
  const url = `${apiBase}/appdata/${appKey}/${dbId}`;
  return axios.get(url, {
    params: {
      query,
      limit,
      skip,
      fields
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
  const url = `${apiBase}/user/${appKey}/login`;
  return axios({
    url,
    method: 'post',
    data,
    headers
  })
    .then(res => res.data)
    .then(data => {
      token = data._kmd.authtoken;
      auth = null;
      if (token) {
        try {
          auth = sessionAuth(token);
          keytar.setPassword(keytarServiceName, keytarKinveyName, token);
        } catch (e) {
          auth = sessionAuth(token);
          console.error('could not save token:', e);
        }
      }

      return Boolean(auth);
    })
    .catch(error => {
      showError(error);
      return false;
    });
}

function logout() {
  clearPlot();
  const headers = {
    Authorization: auth
  };
  const url = `${apiBase}/user/${appKey}/_logout`;
  return axios({
    url,
    method: 'post',
    headers
  })
    .catch(error => {
      showError(error);
    })
    .finally(() => {
      auth = null;
      token = null;
      keytar.deletePassword(keytarServiceName, keytarKinveyName);
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

function showLogin(duration) {
  if (duration) {
    $('#login').show({duration});
  } else {
    $('#login').show();
  }
}

module.exports.plotData = plotData;
module.exports.plotGeo = plotGeo;
module.exports.resizePlots = resizePlots;
