exports.index = function(req, res) {
    res.render('index.html');
};
exports.basicPlayer = function(req , res){
	res.render('basic-player.html');
};
exports.bufferingPlayer = function(req , res){
    res.render('buffering-player.html');
};
exports.adaptiveStreamingPlayer = function(req , res){
    res.render('adaptive-streaming-player.html');
};

