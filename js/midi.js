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
			let noteName = noteFromNumber(note, true);
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
	return (new Date()).getTime() / 1000;
}

let tempo = 130;

// in seconds
let barDuration = 240/tempo;

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
	const track = new MidiWriter.Track();
	track.setTempo(tempo, 0);
	let evt = [];
	for(let i = 0; i<midiData.length; i++)
	{
        let dur = parseInt(barDuration/midiData[i].duration);
        dur = fixDuration(dur);
        
        console.log(dur);
		evt.push(new MidiWriter.NoteEvent({
            channel:4, 
            pitch: [noteFromNumber(midiData[i].midi)], 
            velocity:midiData[i].velocity, 
            startTick:midiData[i].time*1000, 
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

var FLATS = "C Db D Eb E F Gb G Ab A Bb B".split(" ");
var SHARPS = "C C# D D# E F F# G G# A A# B".split(" ");

function noteFromNumber(num, sharps) {
    num = Math.round(num);
    var pcs = sharps === true ? SHARPS : FLATS;
    var pc = pcs[num % 12];
    var o = Math.floor(num / 12) - 1;
    return pc + o;
}