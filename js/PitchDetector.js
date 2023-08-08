class PitchDetector {
    constructor(conf) {
        
        conf = conf || {};
        
        this.thresholdRms = conf.thresholdRms || 0.01;
        this.thresholdAmplitude = conf.thresholdAmplitude || 0.2;  
        
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
            a = (x1 + x3 - 2 * x2) / 2;
            b = (x3 - x1) / 2;
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
                }).catch((err) => {
                    // handle exception here
                });
                if(typeof callback == 'function')
                {
                    callback(float32Array);
                }
            };
            ajaxRequest.send();
        };
        
        this.chunkSize = function(tempo)
        {     
            /*
            sample per second = 32000
            chunkSize = sampleRate * 60 / (tempo*resolution)
            */
           return this.sampleRate * 240 / (tempo * this.resolution);
        }
        
        this.process = function(tempo, maxTempo)
        {
            maxTempo = maxTempo || 720;
            let mc = new MidiCreator({tempo:tempo, maxTempo:maxTempo});
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
                let buf = this.waveformArray(start, end);
                
                let ac = this.autoCorrelate(buf, this.sampleRate);
                
                //pitch
                //rms
                //velocity
                
                mc.add(ac.pitch, ac.velocity);
                
                start = end;
            } while(end < max);
            
            return mc;
           
        }
        this.resolution = 32;
        this.sampleRate = 32000;
        this.waveformArray = null;
        
        let _this = this;


    }
}