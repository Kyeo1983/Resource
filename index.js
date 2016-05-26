var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var http = require('http').Server(app);



app.use(bodyParser.urlencoded({ extended : true }));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));


app.get('/', function (req, res) {
    res.sendFile(__dirname + '/public/views/main.html');
});
app.get('*', function(req, res){
	res.sendFile(__dirname + '/public/views/main.html');
});


http.listen(process.env.PORT || 3000, function(err) {
	if (err) console.log(err);
	else console.log('Listening on port ' + (process.env.PORT || 3000));
});
