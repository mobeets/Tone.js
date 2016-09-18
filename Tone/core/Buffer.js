define(["Tone/core/Tone", "Tone/core/Emitter", "Tone/type/Type"], function(Tone){

	"use strict";

	/**
	 *  @class  Buffer loading and storage. Tone.Buffer is used internally by all 
	 *          classes that make requests for audio files such as Tone.Player,
	 *          Tone.Sampler and Tone.Convolver.
	 *          <br><br>
	 *          Aside from load callbacks from individual buffers, Tone.Buffer 
	 *  		provides static methods which keep track of the loading progress 
	 *  		of all of the buffers. These methods are Tone.Buffer.onload, Tone.Buffer.onprogress,
	 *  		and Tone.Buffer.onerror. 
	 *
	 *  @constructor 
	 *  @extends {Tone}
	 *  @param {AudioBuffer|string} url The url to load, or the audio buffer to set. 
	 *  @param {Function=} onload A callback which is invoked after the buffer is loaded. 
	 *                            It's recommended to use Tone.Buffer.onload instead 
	 *                            since it will give you a callback when ALL buffers are loaded.
	 *  @param {Function=} onerror The callback to invoke if there is an error
	 *  @example
	 * var buffer = new Tone.Buffer("path/to/sound.mp3", function(){
	 * 	//the buffer is now available.
	 * 	var buff = buffer.get();
	 * });
	 */
	Tone.Buffer = function(){

		var options = this.optionsObject(arguments, ["url", "onload", "onerror"], Tone.Buffer.defaults);

		/**
		 *  stores the loaded AudioBuffer
		 *  @type {AudioBuffer}
		 *  @private
		 */
		this._buffer = null;

		/**
		 *  indicates if the buffer should be reversed or not
		 *  @type {Boolean}
		 *  @private
		 */
		this._reversed = options.reverse;

		/**
		 *  The url of the buffer. <code>undefined</code> if it was 
		 *  constructed with a buffer
		 *  @type {String}
		 *  @readOnly
		 */
		this.url = undefined;

		/**
		 *  The callback to invoke when everything is loaded. 
		 *  @type {Function}
		 */
		this.onload = options.onload.bind(this, this);

		/**
		 *  The callback to invoke if there is an error
		 *  @type {Function}
		 */
		this.onerror = options.onerror.bind(this);

		if (options.url instanceof AudioBuffer || options.url instanceof Tone.Buffer){
			this.set(options.url);
			this.onload(this);
		} else if (this.isString(options.url)){
			this.url = options.url;
			Tone.Buffer._addToQueue(options.url, this);
		}
	};

	Tone.extend(Tone.Buffer);

	/**
	 *  the default parameters
	 *  @type {Object}
	 */
	Tone.Buffer.defaults = {
		"url" : undefined,
		"onload" : Tone.noOp,
		"onerror" : Tone.noOp,
		"reverse" : false
	};

	/**
	 *  Pass in an AudioBuffer or Tone.Buffer to set the value
	 *  of this buffer.
	 *  @param {AudioBuffer|Tone.Buffer} buffer the buffer
	 *  @returns {Tone.Buffer} this
	 */
	Tone.Buffer.prototype.set = function(buffer){
		if (buffer instanceof Tone.Buffer){
			this._buffer = buffer.get();
		} else {
			this._buffer = buffer;
		}
		return this;
	};

	/**
	 *  @return {AudioBuffer} The audio buffer stored in the object.
	 */
	Tone.Buffer.prototype.get = function(){
		return this._buffer;
	};

	/**
	 *  Load url into the buffer. 
	 *  @param {String} url The url to load
	 *  @param {Function=} callback The callback to invoke on load. 
	 *                              don't need to set if `onload` is
	 *                              already set.
	 *  @returns {Tone.Buffer} this
	 */
	Tone.Buffer.prototype.load = function(url, callback){
		this.url = url;
		this.onload = this.defaultArg(callback, this.onload);
		Tone.Buffer._addToQueue(url, this);
		return this;
	};

	/**
	 *  dispose and disconnect
	 *  @returns {Tone.Buffer} this
	 */
	Tone.Buffer.prototype.dispose = function(){
		Tone.prototype.dispose.call(this);
		Tone.Buffer._removeFromQueue(this);
		this._buffer = null;
		this.onload = Tone.Buffer.defaults.onload;
		return this;
	};

	/**
	 * If the buffer is loaded or not
	 * @memberOf Tone.Buffer#
	 * @type {Boolean}
	 * @name loaded
	 * @readOnly
	 */
	Object.defineProperty(Tone.Buffer.prototype, "loaded", {
		get : function(){
			return this.length > 0;
		},
	});

	/**
	 * The duration of the buffer. 
	 * @memberOf Tone.Buffer#
	 * @type {Number}
	 * @name duration
	 * @readOnly
	 */
	Object.defineProperty(Tone.Buffer.prototype, "duration", {
		get : function(){
			if (this._buffer){
				return this._buffer.duration;
			} else {
				return 0;
			}
		},
	});

	/**
	 * The length of the buffer in samples
	 * @memberOf Tone.Buffer#
	 * @type {Number}
	 * @name length
	 * @readOnly
	 */
	Object.defineProperty(Tone.Buffer.prototype, "length", {
		get : function(){
			if (this._buffer){
				return this._buffer.length;
			} else {
				return 0;
			}
		},
	});

	/**
	 * The number of discrete audio channels. Returns 0 if no buffer
	 * is loaded.
	 * @memberOf Tone.Buffer#
	 * @type {Number}
	 * @name numberOfChannels
	 * @readOnly
	 */
	Object.defineProperty(Tone.Buffer.prototype, "numberOfChannels", {
		get : function(){
			if (this._buffer){
				return this._buffer.numberOfChannels;
			} else {
				return 0;
			}
		},
	});

	/**
	 *  Reverse the buffer.
	 *  @private
	 *  @return {Tone.Buffer} this
	 */
	Tone.Buffer.prototype._reverse = function(){
		if (this.loaded){
			for (var i = 0; i < this._buffer.numberOfChannels; i++){
				Array.prototype.reverse.call(this._buffer.getChannelData(i));
			}
		}
		return this;
	};

	/**
	 *  Set the audio buffer from the array
	 *  @param {Float32Array} array The array to fill the audio buffer
	 *  @param {Number} [channels=1] The number of channels contained in the array. 
	 *                               If the channel is more than 1, the input array
	 *                               is expected to be a multidimensional array
	 *                               with dimensions equal to the number of channels.
	 *  @return {Tone.Buffer} this
	 */
	Tone.Buffer.prototype.fromArray = function(array){
		var isMultidimensional = array[0].length > 0;
		var channels = isMultidimensional ? array.length : 1;
		var len = isMultidimensional ? array[0].length : array.length;
		var buffer = this.context.createBuffer(channels, len, this.context.sampleRate);
		if (!isMultidimensional && channels === 1){
			array = [array];
		}
		for (var c = 0; c < channels; c++){
			if (this.isFunction(buffer.copyToChannel)){
				buffer.copyToChannel(array[c], c);
			} else {
				var channel = buffer.getChannelData(c);
				var channelArray = array[c];
				for (var i = 0; i < channelArray.length; i++){
					channel[i] = channelArray[i];
				}
			}
		}
		this._buffer = buffer;
		return this;
	};

	/**
	 * 	Get the buffer as an array. Single channel buffers will return a 1-dimensional 
	 * 	Float32Array, and multichannel buffers will return multidimensional arrays.
	 *  @param {Number=} channel Optionally only copy a single channel from the array.
	 *  @return {Array}
	 */
	Tone.Buffer.prototype.toArray = function(channel){
		if (this.isNumber(channel)){
			return this._buffer.getChannelData(channel);
		} else {
			var ret = [];
			for (var c = 0; c < this.numberOfChannels; c++){
				ret[c] = new Float32Array(this.length);
				if (this.isFunction(this._buffer.copyFromChannel)){
					this._buffer.copyFromChannel(ret[c], c);
				} else {
					var channelData = this._buffer.getChannelData(c);
					var retArray = ret[c];
					for (var i = 0; i < channelData.length; i++){
						retArray[i] = channelData[i];
					}
				}
			}
			if (ret.length === 1){
				return ret[0];
			} else {
				return ret;
			}
		}
	};

	/**
	 *  Cut a subsection of the array and return a buffer of the
	 *  subsection. Does not modify the original buffer
	 *  @param {Time} start The time to start the slice
	 *  @param {Time=} end The end time to slice. If none is given
	 *                     will default to the end of the buffer
	 *  @return {Tone.Buffer} this
	 */
	Tone.Buffer.prototype.slice = function(start, end){
		end = this.defaultArg(end, this.duration);
		var startSamples = Math.floor(this.context.sampleRate * this.toSeconds(start));
		var endSamples = Math.floor(this.context.sampleRate * this.toSeconds(end));
		var replacement = [];
		for (var i = 0; i < this.numberOfChannels; i++){
			replacement[i] = this.toArray(i).slice(startSamples, endSamples);
		}
		var retBuffer = new Tone.Buffer().fromArray(replacement);
		return retBuffer;
	};

	/**
	 * Reverse the buffer.
	 * @memberOf Tone.Buffer#
	 * @type {Boolean}
	 * @name reverse
	 */
	Object.defineProperty(Tone.Buffer.prototype, "reverse", {
		get : function(){
			return this._reversed;
		},
		set : function(rev){
			if (this._reversed !== rev){
				this._reversed = rev;
				this._reverse();
			}
		},
	});

	///////////////////////////////////////////////////////////////////////////
	// STATIC METHODS
	///////////////////////////////////////////////////////////////////////////

	//statically inherits Emitter methods
	Tone.Emitter.mixin(Tone.Buffer);
	 
	/**
	 *  the static queue for all of the xhr requests
	 *  @type {Array}
	 *  @private
	 */
	Tone.Buffer._queue = [];

	/**
	 *  the array of current downloads
	 *  @type {Array}
	 *  @private
	 */
	Tone.Buffer._currentDownloads = [];

	/**
	 *  the total number of downloads
	 *  @type {Number}
	 *  @private
	 */
	Tone.Buffer._totalDownloads = 0;

	/**
	 *  the maximum number of simultaneous downloads
	 *  @static
	 *  @type {Number}
	 */
	Tone.Buffer.MAX_SIMULTANEOUS_DOWNLOADS = 6;
	
	/**
	 *  Adds a file to be loaded to the loading queue
	 *  @param   {String}   url      the url to load
	 *  @param   {Function} callback the callback to invoke once it's loaded
	 *  @private
	 */
	Tone.Buffer._addToQueue = function(url, buffer){
		Tone.Buffer._queue.push({
			url : url,
			Buffer : buffer,
			progress : 0,
			xhr : null
		});
		this._totalDownloads++;
		Tone.Buffer._next();
	};

	/**
	 *  Remove an object from the queue's (if it's still there)
	 *  Abort the XHR if it's in progress
	 *  @param {Tone.Buffer} buffer the buffer to remove
	 *  @private
	 */
	Tone.Buffer._removeFromQueue = function(buffer){
		var i;
		for (i = 0; i < Tone.Buffer._queue.length; i++){
			var q = Tone.Buffer._queue[i];
			if (q.Buffer === buffer){
				Tone.Buffer._queue.splice(i, 1);
			}
		}
		for (i = 0; i < Tone.Buffer._currentDownloads.length; i++){
			var dl = Tone.Buffer._currentDownloads[i];
			if (dl.Buffer === buffer){
				Tone.Buffer._currentDownloads.splice(i, 1);
				dl.xhr.abort();
				dl.xhr.onprogress = null;
				dl.xhr.onload = null;
				dl.xhr.onerror = null;
			}
		}
	};

	/**
	 *  load the next buffer in the queue
	 *  @private
	 */
	Tone.Buffer._next = function(){
		if (Tone.Buffer._queue.length > 0){
			if (Tone.Buffer._currentDownloads.length < Tone.Buffer.MAX_SIMULTANEOUS_DOWNLOADS){
				var next = Tone.Buffer._queue.shift();
				Tone.Buffer._currentDownloads.push(next);
				next.xhr = Tone.Buffer.load(next.url, function(buffer){
					//remove this one from the queue
					var index = Tone.Buffer._currentDownloads.indexOf(next);
					Tone.Buffer._currentDownloads.splice(index, 1);
					next.Buffer.set(buffer);
					if (next.Buffer._reversed){
						next.Buffer._reverse();
					}
					next.Buffer.onload(next.Buffer);
					Tone.Buffer._onprogress();
					Tone.Buffer._next();
				}, function(err){
					next.Buffer.onerror(err);
					Tone.Buffer.trigger("error", err);
					Tone.Buffer._next();
				});
				next.xhr.onprogress = function(event){
					if (event.lengthComputable){
						next.progress = event.loaded / event.total;
						Tone.Buffer._onprogress();
					}
				};
			} 
		} else if (Tone.Buffer._currentDownloads.length === 0){
			Tone.Buffer.trigger("load");
			//reset the downloads
			Tone.Buffer._totalDownloads = 0;
		}
	};

	/**
	 *  internal progress event handler
	 *  @private
	 */
	Tone.Buffer._onprogress = function(){
		var curretDownloadsProgress = 0;
		var currentDLLen = Tone.Buffer._currentDownloads.length;
		var inprogress = 0;
		if (currentDLLen > 0){
			for (var i = 0; i < currentDLLen; i++){
				var dl = Tone.Buffer._currentDownloads[i];
				curretDownloadsProgress += dl.progress;
			}
			inprogress = curretDownloadsProgress;
		}
		var currentDownloadProgress = currentDLLen - inprogress;
		var completed = Tone.Buffer._totalDownloads - Tone.Buffer._queue.length - currentDownloadProgress;
		Tone.Buffer.trigger("progress", completed / Tone.Buffer._totalDownloads);
	};

	/**
	 *  A path which is prefixed before every url.
	 *  @type  {String}
	 *  @static
	 */
	Tone.Buffer.baseUrl = "";

	/**
	 *  Makes an xhr reqest for the selected url then decodes
	 *  the file as an audio buffer. Invokes
	 *  the callback once the audio buffer loads.
	 *  @param {String} url The url of the buffer to load.
	 *                      filetype support depends on the
	 *                      browser.
	 *  @param {Function} callback The function to invoke when the url is loaded. 
	 *  @param {Function} error Callback to invoke if there is an error. 
	 *  @returns {XMLHttpRequest} returns the XHR
	 */
	Tone.Buffer.load = function(url, callback, onerror){
		var request = new XMLHttpRequest();
		request.open("GET", Tone.Buffer.baseUrl + url, true);
		request.responseType = "arraybuffer";
		// decode asynchronously
		request.onload = function() {
			if (request.status === 200){
				Tone.context.decodeAudioData(request.response, function(buff) {
					callback(buff);
				}, function(){
					if (onerror){
						onerror("Tone.Buffer: could not decode audio data: " + url);
					} else {
						throw new Error("Tone.Buffer: could not decode audio data: " + url);
					}
				}.bind(this));
			} else {
				onerror("Tone.Buffer: could not locate file: "+url);
			}
		}.bind(this);
		request.onerror = onerror;
		//send the request
		request.send();
		return request;
	};

	/**
	 *  Checks a url's extension to see if the current browser can play that file type.
	 *  @param {String} url The url/extension to test
	 *  @return {Boolean} If the file extension can be played
	 *  @static
	 *  @example
	 * Tone.Buffer.supportsType("wav"); //returns true
	 * Tone.Buffer.supportsType("path/to/file.wav"); //returns true
	 */
	Tone.Buffer.supportsType = function(url){
		var extension = url.split(".");
		extension = extension[extension.length - 1];
		var response = document.createElement("audio").canPlayType("audio/"+extension);
		return response !== "";
	};

	return Tone.Buffer;
});