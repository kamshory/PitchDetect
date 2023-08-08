let timeOffset = 0;
let midiData = [];
let lastNote = null;

function resetMidi()
{
	timeOffset = now();
	midiData = [];
	lastNote = null;	
}
let lastTime = 0;
function updateMidiData(note, rms, velocity)
{
	let currentTime = now();
	if(currentTime - lastTime < 60/720)
	{
		return;
	}
    velocity = velocity*200;

	lastTime = currentTime;
	let process = false;
	if(!process && (note == null && lastNote != null))
	{
		// last note off
		if(midiData.length > 0)
		{
			let start = midiData[midiData.length - 1].time;
			midiData[midiData.length - 1].duration = currentTime - timeOffset - start;
		}
		process = true;
	}
	if(!process && note != null && !isNaN(note))
	{
		// last note off
		if(midiData.length > 0)
		{
			let start = midiData[midiData.length - 1].time;
			midiData[midiData.length - 1].duration = currentTime - timeOffset - start;
		}
		if(note != lastNote)
		{
			// new note on
			let noteName = noteFromNumber(note, false);
			let newData = {
				name: noteName,
				midi: note,
				velocity: Math.round(velocity),
				time:currentTime-timeOffset,
				duration: 0.1
			};
			midiData.push(newData);
		}
		process = true;
	}
	
	lastNote = note;
}

function now()
{
	return (new Date()).getTime();
}

let tempo = 130;

let barSeg = 96;

// in seconds
let barDuration = 60/(tempo*barSeg);

function fixDuration(dur)
{
    if(dur>32)
    {
        dur = 32;
    }
    else if(dur > 16)
    {
        dur = 16;
    }
    else if(dur > 8)
    {
        dur = 8;
    }
    else if(dur > 4)
    {
        dur = 4;
    }
    else if(dur > 2)
    {
        dur = 2;
    }
    else if(dur > 1 || dur < 1)
    {
        dur = 1;
    }
    return dur+'';
}

function saveMidi()
{
	var smf = new JZZ.MIDI.SMF(0, barSeg);
	let track1 = new JZZ.MIDI.SMF.MTrk();

	track1.add(0, JZZ.MIDI.smfBPM(tempo)) 
	
	let evt = [];
	let time1 = 0;
	let time2 = 0;
	for(let i = 0; i<midiData.length; i++)
	{
        let dur = parseInt(barDuration/midiData[i].duration);
		
		time1 = Math.round(midiData[i].time / barDuration) / 1000;
		time2 = Math.round((midiData[i].time + midiData[i].duration) / barDuration) / 1000;
		
		// note On
		track1.add(time1, JZZ.MIDI.noteOn(0, midiData[i].name, midiData[i].velocity));

		// note Off
		track1.add(time2, JZZ.MIDI.noteOff(0, midiData[i].name));
		
	}
	
	track1.add(time2, JZZ.MIDI.smfEndOfTrack());	

	smf.push(track1);

	var str = smf.dump(); // MIDI file dumped as a string
	var b64 = JZZ.lib.toBase64(str); // convert to base-64 string
	var uri = 'data:audio/midi;base64,' + b64; // data URI

	// Finally, write it to the document as a link and as an embedded object:
	document.getElementById('out').innerHTML = 'New file: <a download=lame.mid href=' + uri + '>DOWNLOAD</a> <embed src=' + uri + ' autostart=false>';

}

function saveMidi2()
{
	const track = new MidiWriter.Track();
	track.setTempo(tempo, 0);
	let evt = [];
	for(let i = 0; i<midiData.length; i++)
	{
        let dur = parseInt(barDuration/midiData[i].duration);
        dur = fixDuration(dur);
		evt.push(new MidiWriter.NoteEvent({
            channel:4, 
            pitch: [noteFromNumber(midiData[i].midi)], 
            velocity:midiData[i].velocity, 
            startTick:midiData[i].time, 
            duration:dur
        }));
	}
	track.addEvent(evt, function(event, index) {
		return {sequential: true};
		}
	);
	let programEvent = new MidiWriter.ProgramChangeEvent({ instrument: 64 });
	track.addEvent(programEvent);
	const write = new MidiWriter.Writer(track);
	window.open(write.dataUri());
}

var noteFlats = "C Db D Eb E F Gb G Ab A Bb B".split(" ");
var noteSharps = "C C# D D# E F F# G G# A A# B".split(" ");

function noteFromNumber(num, sharps) {
    num = Math.round(num);
    var pcs = sharps === true ? noteSharps : noteFlats;
    var pc = pcs[num % 12];
    var o = Math.floor(num / 12) - 1;
    return pc + o;
}