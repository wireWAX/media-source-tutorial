/**
 * Module dependencies.
 */

var express = require('express'),
    routes = require('./routes'),
    http = require('http'),
    path = require('path'),
    request = require('request')

// Start app
var app = express();



app.configure(function () {
    app.set('views', __dirname + '/views');
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
    app.engine('html', require('ejs').renderFile);
    app.use(express.errorHandler());
});

var server = app.listen(3105);

exports = module.exports = app;

// Routes
app.get('/basic', routes['basicPlayer']);
app.get('/buffering', routes['bufferingPlayer']);
app.get('/adaptive', routes['adaptiveStreamingPlayer']);
