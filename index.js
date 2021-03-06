const newrelic = require('newrelic');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'pug');
app.locals.newrelic = newrelic;

// Pauses for about 1 second
var lookBusy = function() {
  const end = Date.now() + 100;
  while (Date.now() < end) {
    const doSomethingHeavyInJavaScript = 1 + 2 + 3;
  }
};

// Throws an error 10% of the time
var maybeError = function() {
  var throwError = Math.floor(Math.random() * 10) === 1;
  if (throwError) {
    throw new Error('This is a synthetic error.');
  }
}

// Look busy middleware
app.use(function(req, res, next) {
    lookBusy();
  next();
});

// annotate transactions middleware
// with ecs metadata
var getMetadata = function() {
  var ecsMetadata = 'Not found. ECS_ENABLE_CONTAINER_METADATA must be set to true.';
  if (process.env.ECS_CONTAINER_METADATA_FILE) {
    try {
      ecsMetadata = JSON.parse(fs.readFileSync(process.env.ECS_CONTAINER_METADATA_FILE, 'utf8'));
    } catch (e) {
      return 'Error parsing file';
    }
    newrelic.addCustomParameters({
      "ImageID": ecsMetadata.ImageID,
      "ImageName": ecsMetadata.ImageName,
      "DockerContainerName": ecsMetadata.DockerContainerName,
      "ContainerName": ecsMetadata.ContainerName,
      "TaskARN": ecsMetadata.TaskARN,
      "Cluster": ecsMetadata.Cluster
    });
  }
  return ecsMetadata;
}

app.get('/', function (req, res) {
  if (process.env.THROW_ERROR) {
    try {
      maybeError();
    } catch (e) {
      console.error('error: ', e);
      newrelic.noticeError(e);
      return res.status(500).send(e.toString());
    }
  }

  ecsMetadata = getMetadata();

  newrelic.addCustomParameter('IMAGE_URI', ecsMetadata.ImageName || 'unknown');
  res.render('index', {
    title: 'New Relic Node.js Example',
    message: 'Send a string to redis.',
    envs: JSON.stringify(process.env, '', 2),
    envMetadata: JSON.stringify(ecsMetadata, '', 2)
    });
});

app.get('/healthz', function (req, res) {
  res.status(200).send('OK');    
});

app.listen(process.env.PORT || 80, function () {
  console.error('Example app listening on port 80!');
});
