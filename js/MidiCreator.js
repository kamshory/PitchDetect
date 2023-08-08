class MidiCreator {
    constructor(conf) {
        conf = conf || {};
        this.timeOffset = 0;
        this.midiData = [];
        this.lastNote = null;
        this.lastTime = 0;
        this.tempo = conf.tempo || 130;
        this.barSeg = 96;

        // in seconds
        this.barDuration = 60 / (this.tempo * this.barSeg);

        this.noteFlats = "C Db D Eb E F Gb G Ab A Bb B".split(" ");
        this.noteSharps = "C C# D D# E F F# G G# A A# B".split(" ");

        this.resetMidi = function () {
            this.timeOffset = this.now();
            this.midiData = [];
            this.lastNote = null;
        };
        this.add = function (note, velocity) {
            let currentTime = this.now();
            if (currentTime - this.lastTime < 60 / 720) {
                return;
            }
            velocity = velocity * 200;

            this.lastTime = currentTime;
            let process = false;
            if (!process && (note == null && this.lastNote != null)) {
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
                    this.midiData[this.midiData.length - 1].duration = currentTime - this.timeOffset - start;
                }
                if (note != this.lastNote) {
                    // new note on
                    let noteName = this.noteFromNumber(note, false);
                    let newData = {
                        name: noteName,
                        midi: note,
                        velocity: Math.round(velocity),
                        time: currentTime - this.timeOffset,
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
            return Math.round(time / this.barDuration) / 1000;
        }

        /**
         * Save MIDI
         */
        this.saveMidi = function () {
            let smf = new JZZ.MIDI.SMF(0, this.barSeg);
            let track1 = new JZZ.MIDI.SMF.MTrk();

            track1.add(0, JZZ.MIDI.smfBPM(this.tempo));

            let time1 = 0;
            let time2 = 0;
            for (let i = 0; i < this.midiData.length; i++) {
                time1 = this.midiTime(this.midiData[i].time);
                time2 = this.midiTime(this.midiData[i].time + this.midiData[i].duration);

                // note On
                track1.add(time1, JZZ.MIDI.noteOn(0, this.midiData[i].name, this.midiData[i].velocity));

                // note Off
                track1.add(time2, JZZ.MIDI.noteOff(0, this.midiData[i].name));

            }

            track1.add(time2, JZZ.MIDI.smfEndOfTrack());

            smf.push(track1);

            let str = smf.dump(); // MIDI file dumped as a string
            let b64 = JZZ.lib.toBase64(str); // convert to base-64 string
            let uri = 'data:audio/midi;base64,' + b64; // data URI


            // Finally, write it to the document as a link and as an embedded object:
            document.getElementById('out').innerHTML = 'New file: <a download=lame.mid href=' + uri + '>DOWNLOAD</a> <embed src=' + uri + ' autostart=false>';

        };

        this.noteFromNumber = function (num, sharps) {
            num = Math.round(num);
            let pcs = sharps === true ? this.noteSharps : this.noteFlats;
            let pc = pcs[num % 12];
            let o = Math.floor(num / 12) - 1;
            return pc + o;
        };
        
        
    }
}