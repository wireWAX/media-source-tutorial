$(function () {


    var BasicPlayer = function () {
        var self = this;
        self.clusters = [];


        function Cluster(byteStart, byteEnd, isInitCluster, timeStart, timeEnd) {
            this.byteStart = byteStart; //byte range start inclusive
            this.byteEnd = byteEnd; //byte range end exclusive
            this.timeStart = timeStart ? timeStart : -1; //timecode start inclusive
            this.timeEnd = timeEnd ? timeEnd : -1; //exclusive
            this.requested = false; //cluster download has started
            this.isInitCluster = isInitCluster; //is an init cluster
            this.queued = false; //cluster has been downloaded and queued to be appended to source buffer
            this.buffered = false; //cluster has been added to source buffer
            this.data = null; //cluster data from vid file
        }

        Cluster.prototype.download = function (callback) {
            this.requested = true;
            this._getClusterData(function () {
                self.flushBufferQueue();
                if (callback) {
                    callback();
                }
            })
        };
        Cluster.prototype._makeCacheBuster = function () {
            var text = "";
            var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            for (var i = 0; i < 10; i++)
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            return text;
        };
        Cluster.prototype._getClusterData = function (callback, retryCount) {
            var xhr = new XMLHttpRequest();

            var vidUrl = self.sourceFile;
            if (retryCount) {
                vidUrl += '?cacheBuster=' + this._makeCacheBuster();
            }
            xhr.open('GET', vidUrl, true);
            xhr.responseType = 'arraybuffer';
            xhr.timeout = 6000;
            xhr.setRequestHeader('Range', 'bytes=' + this.byteStart + '-' +
                this.byteEnd);
            xhr.send();
            var cluster = this;
            xhr.onload = function (e) {
                if (xhr.status != 206) {
                    console.err("media: Unexpected status code " + xhr.status);
                    return false;
                }
                cluster.data = new Uint8Array(xhr.response);
                ;
                cluster.queued = true;
                callback();
            };
            xhr.ontimeout = function () {
                var retryAmount = !retryCount ? 0 : retryCount;
                if (retryCount == 2) {
                    console.err("Given up downloading")
                } else {
                    cluster._getClusterData(callback, retryCount++);
                }
            }
        };


        this.clearUp = function () {
            if (self.videoElement) {
                //clear down any resources from the previous video embed if it exists
                $(self.videoElement).remove();
                delete self.mediaSource;
                delete self.sourceBuffer;
            }
        }
        this.initiate = function (sourceFile, clusterFile) {
            if (!window.MediaSource || !MediaSource.isTypeSupported('video/webm; codecs="vp8,vorbis"')) {
                self.setState("Your browser is not supported");
                return;
            }

            self.clearUp();
            self.sourceFile = sourceFile;
            self.clusterFile = clusterFile;
            self.setState("Downloading cluster file");
            self.downloadClusterData(function () {
                self.setState("Creating media source");
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
            });
        }
        this.downloadClusterData = function (callback) {
            var xhr = new XMLHttpRequest();

            var url = self.clusterFile;
            xhr.open('GET', url, true);
            xhr.responseType = 'json';

            xhr.send();
            xhr.onload = function (e) {
                self.createClusters(xhr.response);
                console.log("clusters", self.clusters);
                callback();
            };
        }
        this.createClusters = function (rslt) {
            self.clusters.push(new Cluster(
                rslt.init.offset,
                    rslt.init.size - 1,
                true
            ));

            for (var i = 0; i < rslt.media.length; i++) {
                self.clusters.push(new Cluster(
                    rslt.media[i].offset,
                        rslt.media[i].offset + rslt.media[i].size - 1,
                    false,
                    rslt.media[i].timecode,
                    (i === rslt.media.length - 1) ? parseFloat(rslt.duration / 1000) : rslt.media[i + 1].timecode
                ));
            }
        }
        this.createSourceBuffer = function () {
            self.sourceBuffer = self.mediaSource.addSourceBuffer('video/webm; codecs="vp8,vorbis"');
            self.sourceBuffer.addEventListener('updateend', function () {
                self.flushBufferQueue();
            }, false);
            self.setState("Downloading clusters");
            self.downloadInitCluster();
            self.videoElement.addEventListener('timeupdate',function(){
                self.downloadUpcomingClusters();
            },false);
        }
        this.flushBufferQueue = function () {
            if (!self.sourceBuffer.updating) {
                var initCluster = _.findWhere(self.clusters, {isInitCluster: true});
                if (initCluster.queued || initCluster.buffered) {
                    var bufferQueue = _.filter(self.clusters, function (cluster) {
                        return (cluster.queued === true && cluster.isInitCluster === false)
                    });
                    if (!initCluster.buffered) {
                        bufferQueue.unshift(initCluster);
                    }
                    if (bufferQueue.length) {
                        var concatData = self.concatClusterData(bufferQueue);
                        _.each(bufferQueue, function (bufferedCluster) {
                            bufferedCluster.queued = false;
                            bufferedCluster.buffered = true;
                        });
                        self.sourceBuffer.appendBuffer(concatData);
                    }
                }
            }
        }
        this.downloadInitCluster = function () {
            _.findWhere(self.clusters, {isInitCluster: true}).download(self.downloadUpcomingClusters);
        }
        this.downloadUpcomingClusters = function () {
            var nextClusters = _.filter(self.clusters, function (cluster) {
                return (cluster.requested === false && cluster.timeStart <= self.videoElement.currentTime + 5)
            });
            if (nextClusters.length) {
                _.each(nextClusters, function (nextCluster) {
                    nextCluster.download();
                });
            } else {
                if (_.filter(self.clusters, function (cluster) {
                    return (cluster.requested === false )
                }).length === 0) {
                    self.setState("Finished buffering whole video");
                } else {
                    self.finished = true;
                    self.setState("Finished buffering ahead");
                }
            }
        }
        this.concatClusterData = function (clusterList) {
            console.log(clusterList);
            var bufferArrayList = [];
            _.each(clusterList, function (cluster) {
                bufferArrayList.push(cluster.data);
            })
            var arrLength = 0;
            _.each(bufferArrayList, function (bufferArray) {
                arrLength += bufferArray.length;
            });
            var returnArray = new Uint8Array(arrLength);
            var lengthSoFar = 0;
            _.each(bufferArrayList, function (bufferArray, idx) {
                returnArray.set(bufferArray, lengthSoFar);
                lengthSoFar += bufferArray.length
            });
            return returnArray;
        };

        this.setState = function (state) {
            $('#state-display').html(state);
        }
    }

    var basicPlayer = new BasicPlayer();

    window.updatePlayer = function () {
        var sourceFile = 'vidData/example.webm';
        var clusterData = 'vidData/example.json';
        basicPlayer.initiate(sourceFile, clusterData);
    }
    updatePlayer();
});