const {dialog} = require('electron').remote;
// Const Buffer = require('buffer').Buffer;
const $ = require('jquery');
const plotly = require('plotly.js');
const d3 = require('d3');

let auth = null;
const apiBase = 'https://baas.kinvey.com/appdata/kid_B1bNWWRsX/PSDSData';

$(window).resize(() => {
  plotly.Plots.resize(d3.select('#plot').node());
});

$('#submit').on('click', () => {
  const un = $('#username').val();
  const pw = $('#password').val();
  makeAuth(un, pw);
  makeRequest('psds1001', new Date('2019-06-08'), 50, 1)
    .then(dataArray => {
      plotData(dataArray);
    })
    .catch(error => {
      showError(error);
    });
});

function plotData(dataArray) {
  console.log('plotting data');
  const data = dataArray
    .map(d => {
      return d.sensor_data;
    })
    .flat()
    .reduce((obj, entry) => {
      const typeString = sensorTypeToString(entry.s);
      if (typeString !== 'unknown') {
        if (!obj[typeString]) {
          // Create new plot data object
          const t = [];
          obj[typeString] = {
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
        }

        obj[typeString].t.push(new Date(entry.t));
        obj[typeString].x.y.push(entry.d[0]);
        obj[typeString].y.y.push(entry.d[1]);
        obj[typeString].z.y.push(entry.d[2]);
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
  const gd = d3.select('#plot').node();
  const layout = makeLayout();
  plotly.plot(gd, pdata, layout, {
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
    xaxis: {
      title: 'Time (s)'
    },
    legend: {
      xanchor: 'right'
    },
    // Annotations: annotations,
    margin: {
      pad: 0,
      l: 50,
      r: 0,
      b: 50,
      t: 0
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
  let url = apiBase;
  url += '?';
  const userIdKey = 'user_identifier';
  const query = {
    [userIdKey]: userId,
    '_kmd.ect': {
      $gt: date.toISOString()
    }
  };
  url += `query=${JSON.stringify(query)}&`;
  url += `limit=${limit}&`;
  url += `skip=${skip}`;
  const options = {
    headers: {
      Authorization: auth
    },
    method: 'GET'
  };
  return fetch(url, options)
    .then(data => data.json())
    .then(res => {
      if (res.error) {
        throw res;
      }

      return res;
    });
}

function makeAuth(un, pw) {
  auth = null;
  if (un && pw) {
    // Set up the auth
    const authorizationToEncode = `${un}:${pw}`;
    const _auth = Buffer.from(authorizationToEncode);
    auth = 'Basic ' + _auth.toString('base64');
  }
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
