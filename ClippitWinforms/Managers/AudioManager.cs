﻿using NAudio.Wave;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json;

namespace ClippitWinforms.Managers
{
    public interface IAudioManager : IDisposable
    {
        void PlayFrameSound(string soundId);
        bool IsSoundAvailable(string soundId);
    }

    public class JsonAudioManager : IAudioManager
    {
        private Dictionary<string, byte[]> soundBuffers = new Dictionary<string, byte[]>();
        private ConcurrentDictionary<string, WaveOutEvent> activeOutputs = new ConcurrentDictionary<string, WaveOutEvent>();

        public JsonAudioManager(string jsonFilePath)
        {
            LoadSounds(jsonFilePath);
        }

        private void LoadSounds(string jsonFilePath)
        {
            string soundsJson = File.ReadAllText(jsonFilePath);
            var sounds = JsonSerializer.Deserialize<Dictionary<string, string>>(soundsJson);
            foreach (var sound in sounds)
            {
                try
                {
                    string base64Data = sound.Value.Split(',')[1];
                    byte[] mp3Bytes = Convert.FromBase64String(base64Data);
                    using (var mp3Stream = new MemoryStream(mp3Bytes))
                    using (var mp3Reader = new Mp3FileReader(mp3Stream))
                    using (var wavStream = new MemoryStream())
                    {
                        WaveFileWriter.WriteWavFileToStream(wavStream, mp3Reader);
                        soundBuffers[sound.Key] = wavStream.ToArray();
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Error loading sound {sound.Key}: {ex.Message}");
                }
            }
        }

        public bool IsSoundAvailable(string soundId)
        {
            return !string.IsNullOrEmpty(soundId) && soundBuffers.ContainsKey(soundId);
        }

        public void PlayFrameSound(string soundId)
        {
            if (!IsSoundAvailable(soundId)) return;

            Task.Run(() =>
            {
                try
                {
                    var waveOut = new WaveOutEvent();
                    var soundStream = new MemoryStream(soundBuffers[soundId]);
                    var waveReader = new WaveFileReader(soundStream);
                    waveOut.Init(waveReader);
                    activeOutputs[soundId + "_" + Guid.NewGuid()] = waveOut;
                    waveOut.PlaybackStopped += (s, e) =>
                    {
                        waveOut.Dispose();
                        waveReader.Dispose();
                        soundStream.Dispose();
                        var keyToRemove = activeOutputs.FirstOrDefault(x => x.Value == waveOut).Key;
                        if (keyToRemove != null)
                        {
                            activeOutputs.TryRemove(keyToRemove, out _);
                        }
                    };
                    waveOut.Play();
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Error playing sound {soundId}: {ex.Message}");
                }
            });
        }

        public void Dispose()
        {
            foreach (var output in activeOutputs.Values)
            {
                try
                {
                    output.Stop();
                    output.Dispose();
                }
                catch { }
            }
            activeOutputs.Clear();
        }
    }

    public class WavDirectoryAudioManager : IAudioManager
    {
        private readonly string directoryPath;
        private readonly Dictionary<string, string> soundPaths = new Dictionary<string, string>();
        private ConcurrentDictionary<string, WaveOutEvent> activeOutputs = new ConcurrentDictionary<string, WaveOutEvent>();

        public WavDirectoryAudioManager(string directoryPath)
        {
            this.directoryPath = directoryPath;
            LoadSounds();
        }

        private void LoadSounds()
        {
            try
            {
                var wavFiles = Directory.GetFiles(directoryPath, "*.wav", SearchOption.AllDirectories);
                foreach (var wavFile in wavFiles)
                {
                    string soundId = Path.GetFileNameWithoutExtension(wavFile);
                    soundPaths[soundId] = wavFile;
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error loading WAV directory: {ex.Message}");
            }
        }

        public bool IsSoundAvailable(string soundId)
        {
            return !string.IsNullOrEmpty(soundId) && soundPaths.ContainsKey(soundId);
        }

        public void PlayFrameSound(string soundId)
        {
            soundId = Path.GetFileNameWithoutExtension(soundId);
            if (!IsSoundAvailable(soundId)) return;

            Task.Run(() =>
            {
                try
                {
                    var waveOut = new WaveOutEvent();
                    var audioFile = new AudioFileReader(soundPaths[soundId]);
                    waveOut.Init(audioFile);
                    activeOutputs[soundId + "_" + Guid.NewGuid()] = waveOut;
                    waveOut.PlaybackStopped += (s, e) =>
                    {
                        waveOut.Dispose();
                        audioFile.Dispose();
                        var keyToRemove = activeOutputs.FirstOrDefault(x => x.Value == waveOut).Key;
                        if (keyToRemove != null)
                        {
                            activeOutputs.TryRemove(keyToRemove, out _);
                        }
                    };
                    waveOut.Play();
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"Error playing sound {soundId}: {ex.Message}");
                }
            });
        }

        public void Dispose()
        {
            foreach (var output in activeOutputs.Values)
            {
                try
                {
                    output.Stop();
                    output.Dispose();
                }
                catch { }
            }
            activeOutputs.Clear();
        }
    }
}