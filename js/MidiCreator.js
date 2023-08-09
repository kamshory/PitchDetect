class MidiCreator {
    constructor(conf) {
        conf = conf || {};
        this.timeOffset = 0;
        this.midiData = [];
        this.lastNote = null;
        this.lastTime = 0;
        this.tempo = conf.tempo || 130;
        this.barSeg = 96;
        this.maxTempo = 720;
        this.channel = conf.channel || 0;

        // in seconds
        this.barDuration = 60 / (this.tempo * this.barSeg);

        this.noteFlats = "C Db D Eb E F Gb G Ab A Bb B".split(" ");
        this.noteSharps = "C C# D D# E F F# G G# A A# B".split(" ");
        
        this.thresholdRms = conf.thresholdRms || 0.01;
        this.thresholdAmplitude = conf.thresholdAmplitude || 0.2;  
        
        this.resolution = 32;
        this.sampleRate = 32000;
        this.waveformArray = null;
        
    this.noteFromPitch = function(frequency) {
        let noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
            return Math.round(noteNum) + 69;
        }
        
        this.frequencyFromNoteNumber = function(note) {
            return 440 * Math.pow(2, (note - 69) / 12);
        }
        
        this.centsOffFromPitch = function(frequency, note) {
            return Math.floor(
                (1200 * Math.log(frequency / frequencyFromNoteNumber(note))) / Math.log(2)
            );
        }
        
        this.octaveFromNote = function(note) {
            return parseInt(note / 12) - 1;
        }

        this.resetMidi = function () {
            this.timeOffset = this.now();
            this.midiData = [];
            this.lastNote = null;
        };
        this.add = function (pitch, velocity, currentTime) {
            let note = this.noteFromPitch(pitch);
            velocity = 30 + (200 * velocity);
            if(velocity > 127)
            {
                velocity = 127;
            }
            console.log(velocity)
            currentTime = currentTime || this.now();
            this.lastTime = currentTime;
            let process = false;
            if (!process && note == null && this.lastNote != null && !isNaN(this.lastNote)) {
                // last note off
                if (this.midiData.length > 0) {
                    let start = this.midiData[this.midiData.length - 1].time;
                    this.midiData[this.midiData.length - 1].duration = currentTime - this.timeOffset - start;
                }
                process = true;
            }
            if (!process && note != null && !isNaN(note)) {
                // last note off
                if (this.midiData.length > 0) {
                    let start = this.midiData[this.midiData.length - 1].time;
                    this.midiData[this.midiData.length - 1].duration = currentTime - start;
                }
                if (note != this.lastNote) {
                    // new note on
                    let noteName = this.noteFromNumber(note, false);
                    let newData = {
                        name: noteName,
                        midi: note,
                        velocity: Math.round(velocity),
                        time: currentTime,
                        duration: 0.1
                    };
                    this.midiData.push(newData);
                }
                process = true;
            }

            this.lastNote = note;
        };

        this.now = function () {
            return (new Date()).getTime();
        };
        
        /**
         * Convert time in millisecond into midi time
         * @param {Number} time 
         * @returns {Number}
         */
        this.midiTime = function(time)
        {
            return Math.round((time / this.barDuration) / 1000);
        }

        /**
         * Create MIDI
         */
        this.createMidi = function () {
            let smf = new JZZ.MIDI.SMF(0, this.barSeg);
            let track1 = new JZZ.MIDI.SMF.MTrk();
            
            track1.add(0, JZZ.MIDI.smfBPM(this.tempo));

            let time1 = 0;
            let time2 = 0;
            for (let i = 0; i < this.midiData.length; i++) {
                
                time1 = this.midiTime(this.midiData[i].time);

                // send event note On at time1
                track1.add(time1, JZZ.MIDI.noteOn(this.channel, this.midiData[i].name, this.midiData[i].velocity));

                // send event note Off at time1
                time2 = this.midiTime(this.midiData[i].time + this.midiData[i].duration);
                track1.add(time2, JZZ.MIDI.noteOff(this.channel, this.midiData[i].name));

            }

            track1.add(time2, JZZ.MIDI.smfEndOfTrack());

            smf.push(track1);

            let str = smf.dump(); // MIDI file dumped as a string
            return JZZ.lib.toBase64(str); // convert to base-64 string
        };

        this.noteFromNumber = function (num, sharps) {
            num = Math.round(num);
            let pcs = sharps === true ? this.noteSharps : this.noteFlats;
            let pc = pcs[num % 12];
            let o = Math.floor(num / 12) - 1;
            return pc + o;
        };
        
        this.autoCorrelate = function (buf, sampleRate) {
            // Implements the ACF2+ algorithm
            let bufSize = buf.length;
            let rms = 0;

            let velocity = 0;
            let vel = 0;
            for (let i = 0; i < bufSize; i++) {
                let val = buf[i];
                rms += val * val;
                vel += Math.abs(val);
            }
            velocity = vel / bufSize;
            rms = Math.sqrt(rms / bufSize);
            if (rms < this.thresholdRms) {
                // not enough signal
                return -1;
            }

            let r1 = 0;
            let r2 = bufSize - 1;
 
            for (let i = 0; i < bufSize / 2; i++) {
                if (Math.abs(buf[i]) < this.thresholdAmplitude) {
                    r1 = i;
                    break;
                }
            }
            for (let i = 1; i < bufSize / 2; i++) {
                if (Math.abs(buf[bufSize - i]) < this.thresholdAmplitude) {
                    r2 = bufSize - i;
                    break;
                }
            }

            buf = buf.slice(r1, r2);
            bufSize = buf.length;

            let c = new Array(bufSize).fill(0);
            for (let i = 0; i < bufSize; i++) {
                for (let j = 0; j < bufSize - i; j++) {
                    c[i] = c[i] + buf[j] * buf[j + i];
                }
            }

            let d = 0;
            while (c[d] > c[d + 1]) {
                d++;
            }
            let maxval = -1;
            let maxpos = -1;
            for (let i = d; i < bufSize; i++) {
                if (c[i] > maxval) {
                    maxval = c[i];
                    maxpos = i;
                }
            }
            let T0 = maxpos;
            let x1 = c[T0 - 1];
            let x2 = c[T0];
            let x3 = c[T0 + 1];
            let a = (x1 + x3 - 2 * x2) / 2;
            let b = (x3 - x1) / 2;
            if (a) {
                T0 = T0 - b / (2 * a);
            }

            return { pitch: sampleRate / T0, rms: rms, velocity: velocity };
        };
        
        
        this.loadAudioFile = function (path, callback) {
            let audioContext = new AudioContext({
                sampleRate: this.sampleRate
            });
            let ajaxRequest = new XMLHttpRequest();
            ajaxRequest.open("GET", path, true);
            ajaxRequest.responseType = "arraybuffer";
            
            let float32Array = null;

            ajaxRequest.onload = () => {
                audioContext.decodeAudioData(ajaxRequest.response).then((decodedData) => {
                    float32Array = decodedData.getChannelData(0);
                    _this.waveformArray = float32Array;
                    if(typeof callback == 'function')
                    {
                        callback(float32Array);
                    }
                }).catch((err) => {
                    // handle exception here
                    console.log(err)
                });
                
            };
            ajaxRequest.send();
        };
        
        this.chunkSize = function()
        {     
            /*
            sample per second = 32000
            chunkSize = sampleRate * 60 / (tempo*resolution)
            */
           return this.sampleRate * 240 / (this.tempo * this.resolution);
        }
        
        this.getCurrentTime = function(position)
        {
            return position * 60000 / (this.tempo * this.sampleRate)
        }
        
        this.soundToNote = function()
        {
            this.resetMidi();
            let bSize = this.waveformArray.length;
            let max = bSize - 1;
            let cSize = this.chunkSize();
            let start = 0;
            let end = 0;
            do{
                end = start + cSize;
                if(end > max)
                {
                    end = max;
                }
                let buf = this.waveformArray.slice(start, end);
                
                let ac = this.autoCorrelate(buf, this.sampleRate);
                let currentTime = this.getCurrentTime(start);
                
                //pitch
                //rms
                //velocity
                if(typeof ac.pitch != 'undefined')
                {
                    this.add(ac.pitch, ac.velocity, currentTime);
                }
                
                start = end;
            } while(end < max);
            
            return this;
        }
        
        
        let _this = this;
        
        
    }
}