"""Regenerate visualization data from the demo videos with ffmpeg and numpy."""
from pathlib import Path
import subprocess, json
import numpy as np
media = Path(__file__).resolve().parents[1] / 'dist' / 'media'
for source in sorted(media.glob('sample-*.mp4')):
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-vn','-f','f32le','-ac','1','-ar','24000','pipe:1'])
    x = np.frombuffer(raw, dtype='<f4')
    size, hop, sr = 1024, 256, 24000
    frames = np.lib.stride_tricks.sliding_window_view(x, size)[::hop]
    fft = np.abs(np.fft.rfft(frames * np.hanning(size)))
    bands = fft[:, :512].reshape(len(frames),128,4).max(axis=2)
    db = 20*np.log10(np.maximum(bands,1e-10)/max(float(bands.max()),1e-10))
    spectrogram = np.clip((db+65)/65*255,0,255).astype(np.uint8)
    envelope = [float(np.max(np.abs(chunk))) for chunk in np.array_split(x,700)]
    frequencies = np.fft.rfftfreq(size,1/sr)
    weights = np.maximum(fft,1e-10)
    centroid = (weights*frequencies).sum(axis=1)/weights.sum(axis=1)
    spread = np.sqrt((weights*(frequencies-centroid[:,None])**2).sum(axis=1)/weights.sum(axis=1))
    rms = np.sqrt((frames**2).mean(axis=1))
    nodes=[]
    for indices in np.array_split(np.arange(len(frames)),36):
        i=int(indices[np.argmax(rms[indices])])
        nodes.append({'t':round(i*hop/sr,3),'centroid':round(float(centroid[i]),2),'spread':round(float(spread[i]),2),'rms':round(float(rms[i]),5)})
    result={'duration':len(x)/sr,'sampleRate':sr,'hop':hop,'fftSize':size,'bands':128,'spectrogram':spectrogram.tolist(),'envelope':envelope,'nodes':nodes}
    output=source.with_suffix('.json')
    output.write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
    print(f'{output.name}: {len(frames)} frames, {len(nodes)} acoustic points')
