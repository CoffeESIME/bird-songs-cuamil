import unittest
import contextlib
import io
import json
from pathlib import Path
import tempfile
from unittest.mock import patch
import wave
import numpy as np
import analyze_bird_audio as analyzer
from analyze_bird_audio import analyze_samples, SR, encode


class AnalysisTests(unittest.TestCase):
    def test_silent_and_short_audio(self):
        for n in [1, 100, 1024, SR]:
            data = analyze_samples(np.zeros(n, dtype=np.float32))
            self.assertTrue(data['nodes'])
            self.assertEqual(max(map(max, data['spectrogram'])), 0)
            self.assertTrue(all(node['rms'] == 0 for node in data['nodes']))
            self.assertNotIn('NaN', encode(data))

    def test_known_tone_and_bounded_size(self):
        x = (.5 * np.sin(2 * np.pi * 1500 * np.arange(SR * 8) / SR)).astype(np.float32)
        data = analyze_samples(x)
        self.assertLessEqual(len(data['spectrogram']), 512)
        self.assertLess(len(encode(data)), 350000)
        self.assertAlmostEqual(data['rowSeconds'] * len(data['spectrogram']), 8)
        self.assertAlmostEqual(data['nodes'][0]['centroid'], 1500, delta=5)
        self.assertAlmostEqual(data['nodes'][0]['rms'], .5 / np.sqrt(2), delta=.01)
        self.assertEqual(int(np.argmax(data['spectrogram'][10])), 16)

    def test_invalid_and_trailing_impulse(self):
        for x in [np.array([]), np.array([np.nan]), np.array([np.inf])]:
            with self.assertRaises(ValueError):
                analyze_samples(x)
        x = np.zeros(SR * 2, dtype=np.float32)
        x[-1] = 1
        data = analyze_samples(x)
        self.assertEqual(data['envelope'][-1], 1)
        self.assertGreater(max(data['spectrogram'][-1]), 0)
        self.assertTrue(all(n['t'] < data['duration'] for n in data['nodes']))

    def test_resume_corruption_and_metadata_preservation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / 'dist/content/test/audio'
            folder.mkdir(parents=True)
            source = folder / 'test.wav'
            def write_wave(frequency):
                with wave.open(str(source), 'wb') as output:
                    output.setparams((1, 2, SR, 0, 'NONE', 'not compressed'))
                    samples = (12000 * np.sin(2 * np.pi * frequency * np.arange(2400) / SR)).astype('<i2')
                    output.writeframes(samples.tobytes())
            write_wave(1000)
            original_bytes = source.read_bytes()
            metadata = folder.parent / 'ave.json'
            metadata.write_text(json.dumps(dict(id='test',custom={'preserved': True},audio=[dict(file='audio/test.wav',recordist='Test',derivativesAllowed=True)])))
            with patch.object(analyzer, 'ROOT', root), patch('sys.argv', ['analyzer', '--all']), contextlib.redirect_stdout(io.StringIO()):
                self.assertFalse(analyzer.main())
                first = metadata.read_bytes()
                self.assertFalse(analyzer.main())
                self.assertEqual(metadata.read_bytes(), first)
                self.assertEqual(source.read_bytes(), original_bytes)
                report = json.loads((root / 'dist/audio-analysis-report.json').read_text())
                self.assertEqual(report['skipped'], 1)
                result = folder.parent / 'analysis/test.wav.json'
                result.write_text('[]')
                self.assertFalse(analyzer.main())
                self.assertEqual(json.loads((root / 'dist/audio-analysis-report.json').read_text())['generated'], 1)
                previous_hash = json.loads(result.read_text())['sourceSha256']
                write_wave(2000)
                self.assertFalse(analyzer.main())
                self.assertNotEqual(json.loads(result.read_text())['sourceSha256'], previous_hash)
                self.assertEqual(json.loads(metadata.read_text())['custom'], {'preserved': True})


if __name__ == '__main__':
    unittest.main()
