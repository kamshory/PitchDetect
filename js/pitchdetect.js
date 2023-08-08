let midiCreator = new MidiCreator({
  tempo:130
});

/*
The MIT License (MIT)

Copyright (c) 2014 Chris Wilson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

window.AudioContext = window.AudioContext || window.webkitAudioContext;

let audioContext = null;
let isPlaying = false;
let sourceNode = null;
let analyser = null;
let theBuffer = null;
let DEBUGCANVAS = null;
let mediaStreamSource = null;
let detectorElem;
let canvasElem;
let waveCanvas;
let pitchElem;
let noteElem;
let detuneElem;
let detuneAmount;
  

window.onload = function () {
  audioContext = new AudioContext();
  MAX_SIZE = Math.max(4, Math.floor(audioContext.sampleRate / 5000)); // corresponds to a 5kHz signal

  detectorElem = document.getElementById("detector");
  canvasElem = document.getElementById("output");
  DEBUGCANVAS = document.getElementById("waveform");
  if (DEBUGCANVAS) {
    waveCanvas = DEBUGCANVAS.getContext("2d");
    waveCanvas.strokeStyle = "black";
    waveCanvas.lineWidth = 1;
  }
  pitchElem = document.getElementById("pitch");
  noteElem = document.getElementById("note");
  detuneElem = document.getElementById("detune");
  detuneAmount = document.getElementById("detune_amt");

  detectorElem.ondragenter = function () {
    this.classList.add("droptarget");
    return false;
  };
  detectorElem.ondragleave = function () {
    this.classList.remove("droptarget");
    return false;
  };
  detectorElem.ondrop = function (e) {
    this.classList.remove("droptarget");
    e.preventDefault();
    theBuffer = null;

    let reader = new FileReader();
    reader.onload = function (event) {
      audioContext.decodeAudioData(
        event.target.result,
        function (buffer) {
          theBuffer = buffer;
        },
        function () {
          alert("error loading!");
        }
      );
    };
    reader.onerror = function (event) {
      alert("Error: " + reader.error);
    };
    reader.readAsArrayBuffer(e.dataTransfer.files[0]);
    return false;
  };

  fetch("whistling3.ogg")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error, status = ${response.status}`);
      }
      return response.arrayBuffer();
    })
    .then((buffer) => audioContext.decodeAudioData(buffer))
    .then((decodedData) => {
      theBuffer = decodedData;
    });
};

function startPitchDetect() {
  // grab an audio context
  audioContext = new AudioContext();

  // Attempt to get audio input
  navigator.mediaDevices
    .getUserMedia({
      audio: {
        mandatory: {
          googEchoCancellation: "false",
          googAutoGainControl: "false",
          googNoiseSuppression: "false",
          googHighpassFilter: "false",
        },
        optional: [],
      },
    })
    .then((stream) => {
      // Create an AudioNode from the stream.
      mediaStreamSource = audioContext.createMediaStreamSource(stream);

      // Connect it to the destination.
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      mediaStreamSource.connect(analyser);
      updatePitch();
    })
    .catch((err) => {
      // always check for errors at the end.
      console.error(`${err.name}: ${err.message}`);
      alert("Stream generation failed.");
    });
}

function toggleOscillator() {
  if (isPlaying) {
    //stop playing and return
    sourceNode.stop(0);
    sourceNode = null;
    analyser = null;
    isPlaying = false;
    if (!window.cancelAnimationFrame)
      window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
    window.cancelAnimationFrame(rafID);
    return "play oscillator";
  }
  sourceNode = audioContext.createOscillator();

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);
  sourceNode.start(0);
  isPlaying = true;
  isLiveInput = false;
  updatePitch();

  return "stop";
}

function toggleLiveInput() {
  if (isPlaying) {
    //stop playing and return
    sourceNode.stop(0);
    sourceNode = null;
    analyser = null;
    isPlaying = false;
    if (!window.cancelAnimationFrame)
      window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
    window.cancelAnimationFrame(rafID);
  } else {
    midiCreator.tempoMidi();
  }
  getUserMedia(
    {
      audio: {
        mandatory: {
          googEchoCancellation: "false",
          googAutoGainControl: "false",
          googNoiseSuppression: "false",
          googHighpassFilter: "false",
        },
        optional: [],
      },
    },
    gotStream
  );
}

function togglePlayback() {
  if (isPlaying) {
    //stop playing and return
    sourceNode.stop(0);
    sourceNode = null;
    analyser = null;
    isPlaying = false;
    if (!window.cancelAnimationFrame)
      window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
    window.cancelAnimationFrame(rafID);
    return "start";
  } else {
    midiCreator.resetMidi();
  }
  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = theBuffer;
  sourceNode.loop = true;

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);
  sourceNode.start(0);
  isPlaying = true;
  isLiveInput = false;
  updatePitch();

  return "stop";
}

let rafID = null;
let tracks = null;
let buflen = 2048;
let buf = new Float32Array(buflen);

let noteStrings = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

function noteFromPitch(frequency) {
  let noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return Math.round(noteNum) + 69;
}

function frequencyFromNoteNumber(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function centsOffFromPitch(frequency, note) {
  return Math.floor(
    (1200 * Math.log(frequency / frequencyFromNoteNumber(note))) / Math.log(2)
  );
}

function octaveFromNote(note) {
  return parseInt(note / 12) - 1;
}

function autoCorrelate(buf, sampleRate) {
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
  if (rms < 0.01)
  {
    // not enough signal
    return -1;
  }

  let r1 = 0;
  let r2 = bufSize - 1;
  let thres = 0.2;
  for (let i = 0; i < bufSize / 2; i++) {
    if (Math.abs(buf[i]) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < bufSize / 2; i++) {
    if (Math.abs(buf[bufSize - i]) < thres) {
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
  while (c[d] > c[d + 1]) 
  {
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
  if (a) 
  {
    T0 = T0 - b / (2 * a);
  }

  return { pitch: sampleRate / T0, rms: rms, velocity: velocity };
}



function updatePitch(time) {
  let cycles = new Array();
  analyser.getFloatTimeDomainData(buf);
  let ac = autoCorrelate(buf, audioContext.sampleRate);
  // TODO: Paint confidence meter on canvasElem here.

  if (DEBUGCANVAS) {
    // This draws the current waveform, useful for debugging
    waveCanvas.clearRect(0, 0, 512, 256);
    waveCanvas.strokeStyle = "red";
    waveCanvas.beginPath();
    waveCanvas.moveTo(0, 0);
    waveCanvas.lineTo(0, 256);
    waveCanvas.moveTo(128, 0);
    waveCanvas.lineTo(128, 256);
    waveCanvas.moveTo(256, 0);
    waveCanvas.lineTo(256, 256);
    waveCanvas.moveTo(384, 0);
    waveCanvas.lineTo(384, 256);
    waveCanvas.moveTo(512, 0);
    waveCanvas.lineTo(512, 256);
    waveCanvas.stroke();
    waveCanvas.strokeStyle = "black";
    waveCanvas.beginPath();
    waveCanvas.moveTo(0, buf[0]);
    for (let i = 1; i < 512; i++) {
      waveCanvas.lineTo(i, 128 + buf[i] * 128);
    }
    waveCanvas.stroke();
  }

  if (ac.pitch == -1) {
    detectorElem.className = "vague";
    pitchElem.innerText = "--";
    noteElem.innerText = "-";
    detuneElem.className = "";
    detuneAmount.innerText = "--";

    midiCreator.add(null, null);
  } else {
    detectorElem.className = "confident";
    pitch = ac.pitch;
    pitchElem.innerText = Math.round(pitch);
    let note = noteFromPitch(pitch);

    if (!isNaN(note)) {
      noteElem.innerHTML = noteStrings[note % 12];
      let detune = centsOffFromPitch(pitch, note);
      if (detune == 0) {
        detuneElem.className = "";
        detuneAmount.innerHTML = "--";
      } else {
        if (detune < 0) {
          detuneElem.className = "flat";
        } else {
          detuneElem.className = "sharp";
        }
        detuneAmount.innerHTML = Math.abs(detune);
      }

      midiCreator.add(note, ac.velocity);
    }
  }

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = window.webkitRequestAnimationFrame;
  }
  rafID = window.requestAnimationFrame(updatePitch);
}
