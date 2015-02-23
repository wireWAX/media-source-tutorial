$(function () {

    var BasicPlayer = function () {
        var self = this;
        this.clearUp = function() {
            if (self.videoElement) {
                //clear down any resources from the previous video embed if it exists
                $(self.videoElement).remove();
                delete self.mediaSource;
                delete self.sourceBuffer;
            }
        }
        this.initiate = function (sourceFile) {
            if (!window.MediaSource || !MediaSource.isTypeSupported('video/webm; codecs="vp8,vorbis"')) {
                self.setState("Your browser is not supported");
                return;
            }
            self.clearUp();
            self.sourceFile = sourceFile;
            self.setState("Creating media source using");
            //create the video element
            self.videoElement = $('<video controls></video>')[0];
            //create the media source
            self.mediaSource = new MediaSource();
            self.mediaSource.addEventListener('sourceopen', function () {
                self.setState("Creating source buffer");
                //when the media source is opened create the source buffer
                self.createSourceBuffer();
            }, false);
            //append the video element to the DOM
            self.videoElement.src = window.URL.createObjectURL(self.mediaSource);
            $('#basic-player').append($(self.videoElement));
        }
        this.createSourceBuffer = function () {

            self.sourceBuffer = self.mediaSource.addSourceBuffer('video/webm; codecs="vp8,vorbis"');
            self.sourceBuffer.addEventListener('updateend', function () {
                self.setState("Ready");
            }, false);
            var xhr = new XMLHttpRequest();
            xhr.open('GET', self.sourceFile, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = function (e) {
                if (xhr.status !== 200) {
                    self.setState("Failed to download video data");
                    self.clearUp();
                } else {
                    var arr = new Uint8Array(xhr.response);
                    if (!self.sourceBuffer.updating) {
                        self.setState("Appending video data to buffer");
                        self.sourceBuffer.appendBuffer(arr);
                    } else {
                        self.setState("Source Buffer failed to update");
                    }
                }
            };
            xhr.onerror = function () {
                self.setState("Failed to download video data");
                self.clearUp();
            };
            xhr.send();
            self.setState("Downloading video data");
        }
        this.setState = function (state) {
            $('#state-display').html(state);
        }
    }

    var basicPlayer = new BasicPlayer();

    window.updatePlayer = function () {
        var sourceFile = $('#source-file').val();
        basicPlayer.initiate(sourceFile);
    }
    updatePlayer();
    $('#embed').click(updatePlayer);
});