function soundToMidi(path)
{
    let midiCreator = new MidiCreator({tempo:120, maxTempo:720, resolution:32, sampleRate:32000, channel:3});
    midiCreator.loadAudioFile(path, function(float32Array){
        midiCreator.soundToNote();
        midiData = midiCreator.createMidi();
        //window.open('data:audio/midi;base64,'+midiData);
    });
}