"""Bounded visualization analysis; originals are read-only, results are resumable."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
VERSION = 2
SR, FFT, HOP, BANDS, ROWS = 24000, 1024, 256, 128, 512


def digest(file):
    h = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def encode(data):
    return json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def atomic_write(file, text, expected=None):
    file.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=file.parent, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as stream:
            stream.write(text)
        for attempt in range(6):
            if expected is not None and file.read_text(encoding='utf-8') != expected:
                raise RuntimeError('ave.json changed during analysis; preserving user edits')
            try:
                os.replace(tmp, file)
                break
            except PermissionError:
                if attempt == 5:
                    raise
                time.sleep(.1 * 2 ** attempt)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def analyze_samples(x):
    n = len(x)
    if not n or not np.isfinite(x).all():
        raise ValueError('Empty or non-finite decoded audio')
    duration = n / SR
    count = max(1, int(np.ceil(n / HOP)))
    row_count, node_count = min(ROWS, count), min(36, count)
    spectra = np.zeros((row_count, BANDS), dtype=np.float64)
    peaks = np.full(node_count, -1.0)
    nodes = [None] * node_count
    window = np.hanning(FFT)
    frequencies = np.fft.rfftfreq(FFT, 1 / SR)
    # Batch FFTs bound memory independently of recording duration.
    for start in range(0, count, 256):
        length = min(256, count - start)
        needed = (length - 1) * HOP + FFT
        samples = x[start * HOP:start * HOP + needed]
        if len(samples) < needed:
            samples = np.pad(samples, (0, needed - len(samples)))
        frames = np.lib.stride_tricks.sliding_window_view(samples, FFT)[::HOP]
        magnitude = np.abs(np.fft.rfft(frames * window))
        power = magnitude ** 2
        bands = power[:, :512].reshape(length, BANDS, 4).max(axis=2)
        positions = np.arange(start, start + length)
        row_ids = np.minimum(row_count - 1, (positions * HOP / n * row_count).astype(int))
        np.maximum.at(spectra, row_ids, bands)
        rms = np.sqrt(np.mean(frames.astype(np.float64) ** 2, axis=1))
        totals = magnitude.sum(axis=1)
        centers = (magnitude * frequencies).sum(axis=1) / np.maximum(totals, 1e-20)
        spread = np.sqrt((magnitude * (frequencies - centers[:, None]) ** 2).sum(axis=1) / np.maximum(totals, 1e-20))
        groups = np.minimum(node_count - 1, positions * node_count // count)
        for group in np.unique(groups):
            indices = np.where(groups == group)[0]
            i = indices[np.argmax(rms[indices])]
            if rms[i] > peaks[group]:
                peaks[group] = rms[i]
                nodes[group] = dict(t=round(float(positions[i] * HOP / SR), 6), centroid=round(float(centers[i]), 2), spread=round(float(spread[i]), 2), rms=round(float(rms[i]), 6))
    peak = float(spectra.max())
    if peak > 0:
        db = 10 * np.log10(np.maximum(spectra, 1e-30) / peak)
        quantized = np.clip((db + 65) / 65 * 255, 0, 255).astype(np.uint8)
    else:
        quantized = np.zeros_like(spectra, dtype=np.uint8)
    envelope = [round(float(np.max(np.abs(chunk))), 6) for chunk in np.array_split(x, min(700, n))]
    return dict(version=VERSION, duration=duration, sampleRate=SR, hop=HOP, fftSize=FFT, bands=BANDS,
                rowSeconds=duration / row_count, aggregation='peak power per uniform time bin; relative dB, 65 dB range',
                spectrogram=quantized.tolist(), envelope=envelope, nodes=nodes)


def analyze_file(source):
    with tempfile.TemporaryDirectory(prefix='aviario-analysis-') as temp:
        raw = Path(temp) / 'decoded.f32'
        subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-nostdin', '-i', str(source), '-vn', '-f', 'f32le', '-ac', '1', '-ar', str(SR), str(raw)], check=True, capture_output=True, timeout=600)
        if raw.stat().st_size == 0:
            raise ValueError('Empty decoded audio')
        samples = np.memmap(raw, dtype='<f4', mode='r')
        try:
            return analyze_samples(samples)
        finally:
            samples._mmap.close()


def inside(dir, relative):
    file = (dir / relative).resolve()
    if not file.is_relative_to(dir.resolve()):
        raise ValueError('Path escapes bird directory')
    return file


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--all', action='store_true')
    group.add_argument('--bird', action='append')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    report = dict(version=VERSION, processed=0, generated=0, skipped=0, errors=[], excluded=[], bytes=0)
    folders = sorted((ROOT / 'dist/content').glob('*/ave.json'))
    if args.bird:
        unknown = set(args.bird) - {p.parent.name for p in folders}
        if unknown:
            parser.error('Unknown birds: ' + ', '.join(sorted(unknown)))
        folders = [p for p in folders if p.parent.name in args.bird]
    lock = ROOT / '.audio-analysis.lock'
    with lock.open('x') as stream:
        stream.write(str(os.getpid()))
    try:
        for metadata_file in folders:
            try:
                original = metadata_file.read_text(encoding='utf-8')
                bird = json.loads(original)
                for recording in bird.get('audio', []):
                    report['processed'] += 1
                    try:
                        if recording.get('derivativesAllowed') is False:
                            report['excluded'].append(dict(bird=bird['id'], file=recording['file'], reason='ND; analysis not generated'))
                            continue
                        source = inside(metadata_file.parent, recording['file'])
                        relative = 'analysis/' + source.name + '.json'
                        output = inside(metadata_file.parent, relative)
                        source_hash = digest(source)
                        if not args.force and output.exists():
                            try:
                                old = json.loads(output.read_text(encoding='utf-8'))
                            except (ValueError, UnicodeError):
                                old = {}
                            if isinstance(old, dict) and old.get('version') == VERSION and old.get('sourceSha256') == source_hash and recording.get('analysis') == relative and recording.get('analysisSha256') == digest(output):
                                report['skipped'] += 1
                                report['bytes'] += output.stat().st_size
                                continue
                        data = analyze_file(source)
                        if digest(source) != source_hash:
                            raise RuntimeError('Audio changed during analysis')
                        data.update(sourceFile=recording['file'], sourceSha256=source_hash)
                        text = encode(data)
                        if len(text.encode('utf-8')) > 350000:
                            raise ValueError('Analysis exceeds 350 kB budget')
                        atomic_write(output, text + '\n')
                        recording.update(analysis=relative, analysisSha256=digest(output), analysisVersion=VERSION)
                        next_text = json.dumps(bird, ensure_ascii=False, indent=2, allow_nan=False) + '\n'
                        atomic_write(metadata_file, next_text, original)
                        original = next_text
                        report['generated'] += 1
                        report['bytes'] += output.stat().st_size
                        print(f"{bird['id']}/{source.name}: {output.stat().st_size} bytes", flush=True)
                    except Exception as error:
                        report['errors'].append(dict(bird=bird['id'], file=recording.get('file'), error=str(error)))
                        print(f"ERROR {bird['id']}: {error}", flush=True)
            except Exception as error:
                report['errors'].append(dict(bird=metadata_file.parent.name, error=str(error)))
        atomic_write(ROOT / 'dist/audio-analysis-report.json', json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(report, ensure_ascii=False), flush=True)
    finally:
        lock.unlink()
    return bool(report['errors'])


if __name__ == '__main__':
    raise SystemExit(main())
