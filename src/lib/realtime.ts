import type { LunaArtifact, LunaToolCall, LunaToolResult, LunaToolSpec } from "../vite-env";

export type LunaConnectionState = "idle" | "connecting" | "connected" | "error";
export type LunaMood = "idle" | "listening" | "thinking" | "speaking" | "working" | "error";

export type MouthShape = {
  open: number;
  width: number;
  round: number;
  teeth: number;
};

export type TranscriptEntry = {
  id: string;
  role: "user" | "luna" | "system" | "tool";
  text: string;
  at: string;
};

export type RealtimeCallbacks = {
  onConnectionState: (state: LunaConnectionState) => void;
  onMood: (mood: LunaMood) => void;
  onMouthShape: (shape: MouthShape) => void;
  onTranscript: (entry: TranscriptEntry) => void;
  onArtifact: (artifact: LunaArtifact) => void;
  onMode: (mode: "display" | "computer") => void;
  onStatus: (message: string) => void;
  onThumbnailReady: () => void;
};

type ElevenLabsMessage = {
  type: string;
  audio?: { chunk: string };
  user_transcript?: string;
  agent_response?: string;
  interruption?: unknown;
  ping?: { event_id: number };
  conversation_initiation_metadata?: unknown;
};

export class LunaRealtimeClient {
  private ws: WebSocket | null = null;
  private micStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private callbacks: RealtimeCallbacks;
  private toolSpecs: LunaToolSpec[] = [];
  private toolRunning = false;
  private smoothedMouthShape: MouthShape = silentMouthShape();
  private outputMeterFrame = 0;
  private playbackContext: AudioContext | null = null;
  private audioQueue: ArrayBuffer[] = [];
  private isPlayingAudio = false;
  private mediaRecorder: MediaRecorder | null = null;
  private micMuted = false;
  private outputVolumePercent = 80;
  private outputGain: GainNode | null = null;

  constructor(callbacks: RealtimeCallbacks) {
    this.callbacks = callbacks;
  }

  setMicMuted(muted: boolean): void {
    this.micMuted = muted;
    if (this.micStream) {
      for (const track of this.micStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
  }

  setOutputVolume(percent: number): void {
    this.outputVolumePercent = Math.min(100, Math.max(0, percent));
    if (this.outputGain) {
      this.outputGain.gain.value = this.outputVolumePercent / 100;
    }
  }

  async connect(): Promise<void> {
    if (this.ws) return;
    this.callbacks.onConnectionState("connecting");
    this.callbacks.onMood("thinking");
    this.callbacks.onStatus("Connecting to Luna...");

    try {
      this.toolSpecs = await window.luna.getToolSpecs();
      const config = await window.luna.getRealtimeConfig();

      if (config.provider !== "elevenlabs") {
        throw new Error("Only ElevenLabs provider is supported");
      }

      await this.connectElevenLabs(config.signedUrl);
    } catch (error) {
      this.callbacks.onConnectionState("error");
      this.callbacks.onMood("error");
      this.callbacks.onStatus(error instanceof Error ? error.message : String(error));
      this.disconnect();
    }
  }

  private async connectElevenLabs(signedUrl: string): Promise<void> {
    const ws = new WebSocket(signedUrl);
    this.ws = ws;

    ws.onopen = () => {
      this.callbacks.onConnectionState("connected");
      this.callbacks.onMood("idle");
      this.callbacks.onStatus("Luna is ready. Start talking.");
      void this.startAudioCapture();
    };

    ws.onmessage = async (event) => {
      const data = event.data;
      let message: ElevenLabsMessage;
      
      if (data instanceof Blob) {
        const text = await data.text();
        message = JSON.parse(text) as ElevenLabsMessage;
      } else {
        message = JSON.parse(data as string) as ElevenLabsMessage;
      }

      await this.handleElevenLabsMessage(message);
    };

    ws.onerror = () => {
      this.callbacks.onConnectionState("error");
      this.callbacks.onMood("error");
      this.callbacks.onStatus("WebSocket connection error");
    };

    ws.onclose = () => {
      if (this.callbacks) {
        this.callbacks.onConnectionState("idle");
        this.callbacks.onMood("idle");
      }
    };
  }

  private async startAudioCapture(): Promise<void> {
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
      },
    });

    const audioContext = new AudioContext({ sampleRate: 16000 });
    this.audioContext = audioContext;
    const source = audioContext.createMediaStreamSource(this.micStream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    let isSpeaking = false;
    let silenceFrames = 0;
    const SILENCE_THRESHOLD = 0.01;
    const SILENCE_FRAMES_TO_STOP = 20;

    processor.onaudioprocess = (event) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.micMuted) return;

      const inputData = event.inputBuffer.getChannelData(0);
      
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);

      if (rms > SILENCE_THRESHOLD) {
        if (!isSpeaking) {
          isSpeaking = true;
          this.callbacks.onMood("listening");
        }
        silenceFrames = 0;
      } else if (isSpeaking) {
        silenceFrames++;
        if (silenceFrames > SILENCE_FRAMES_TO_STOP) {
          isSpeaking = false;
          if (!this.toolRunning && !this.isPlayingAudio) {
            this.callbacks.onMood("thinking");
          }
        }
      }

      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
      
      this.ws?.send(JSON.stringify({
        user_audio_chunk: base64Audio,
      }));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
    this.setMicMuted(this.micMuted);
  }

  private async handleElevenLabsMessage(msg: ElevenLabsMessage): Promise<void> {
    switch (msg.type) {
      case "conversation_initiation_metadata":
        break;

      case "audio":
        if (msg.audio?.chunk) {
          this.callbacks.onMood("speaking");
          this.playAudioChunk(msg.audio.chunk);
        }
        break;

      case "user_transcript":
        if (msg.user_transcript) {
          this.callbacks.onTranscript(newEntry("user", msg.user_transcript));
        }
        break;

      case "agent_response":
        if (msg.agent_response) {
          this.callbacks.onTranscript(newEntry("luna", msg.agent_response));
        }
        break;

      case "interruption":
        this.audioQueue = [];
        this.isPlayingAudio = false;
        this.callbacks.onMood("listening");
        break;

      case "ping":
        if (msg.ping?.event_id !== undefined) {
          this.ws?.send(JSON.stringify({
            type: "pong",
            event_id: msg.ping.event_id,
          }));
        }
        break;

      default:
        break;
    }
  }

  private playAudioChunk(base64Data: string): void {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    this.audioQueue.push(bytes.buffer);
    void this.processAudioQueue();
  }

  private async processAudioQueue(): Promise<void> {
    if (this.isPlayingAudio || this.audioQueue.length === 0) return;
    this.isPlayingAudio = true;

    if (!this.playbackContext || this.playbackContext.state === "closed") {
      this.playbackContext = new AudioContext({ sampleRate: 16000 });
      this.outputGain = this.playbackContext.createGain();
      this.outputGain.gain.value = this.outputVolumePercent / 100;
      this.outputGain.connect(this.playbackContext.destination);
    }

    const analyser = this.playbackContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.connect(this.outputGain ?? this.playbackContext.destination);

    this.startMouthAnimation(analyser);

    while (this.audioQueue.length > 0) {
      const chunk = this.audioQueue.shift()!;
      
      const pcm16 = new Int16Array(chunk);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }

      const audioBuffer = this.playbackContext.createBuffer(1, float32.length, 16000);
      audioBuffer.getChannelData(0).set(float32);

      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);

      source.start();
      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
      });
    }

    this.isPlayingAudio = false;
    this.stopMouthAnimation();
    if (!this.toolRunning) {
      this.callbacks.onMood("idle");
    }
  }

  private startMouthAnimation(analyser: AnalyserNode): void {
    const samples = new Uint8Array(analyser.fftSize);
    const frequencies = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!this.isPlayingAudio) return;

      analyser.getByteTimeDomainData(samples);
      analyser.getByteFrequencyData(frequencies);

      let total = 0;
      for (const sample of samples) {
        const centered = (sample - 128) / 128;
        total += centered * centered;
      }
      const rms = Math.sqrt(total / samples.length);
      const energy = clamp01(rms * 10.5);
      const bands = getSpeechBands(frequencies);

      const target: MouthShape = {
        open: clamp01(energy * 0.75 + bands.mid * 0.45 - bands.high * 0.16),
        width: clamp01(0.28 + bands.mid * 0.55 + bands.high * 0.74 - bands.low * 0.28),
        round: clamp01(0.08 + bands.low * 0.95 + energy * 0.1 - bands.high * 0.42),
        teeth: clamp01(bands.high * 1.4 + bands.mid * 0.25 - bands.low * 0.35),
      };

      this.smoothedMouthShape = smoothMouthShape(this.smoothedMouthShape, target, 0.36);
      this.callbacks.onMouthShape(this.smoothedMouthShape);
      this.outputMeterFrame = window.requestAnimationFrame(tick);
    };
    tick();
  }

  private stopMouthAnimation(): void {
    if (this.outputMeterFrame) {
      window.cancelAnimationFrame(this.outputMeterFrame);
      this.outputMeterFrame = 0;
    }
    this.smoothedMouthShape = silentMouthShape();
    this.callbacks.onMouthShape(this.smoothedMouthShape);
  }

  disconnect(): void {
    this.ws?.close();
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.stopMouthAnimation();
    void this.audioContext?.close();
    void this.playbackContext?.close();
    this.ws = null;
    this.micStream = null;
    this.audioContext = null;
    this.playbackContext = null;
    this.audioQueue = [];
    this.isPlayingAudio = false;
    this.callbacks.onConnectionState("idle");
    this.callbacks.onMood("idle");
    this.callbacks.onMouthShape(silentMouthShape());
  }

  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.callbacks.onStatus("Connect Luna before sending a text prompt.");
      return;
    }
    this.callbacks.onTranscript(newEntry("user", text));
    this.ws.send(JSON.stringify({
      type: "user_message",
      user_message: text,
    }));
  }
}

function silentMouthShape(): MouthShape {
  return { open: 0, width: 0.18, round: 0, teeth: 0 };
}

function smoothMouthShape(current: MouthShape, target: MouthShape, amount: number): MouthShape {
  return {
    open: lerp(current.open, target.open, amount),
    width: lerp(current.width, target.width, amount),
    round: lerp(current.round, target.round, amount),
    teeth: lerp(current.teeth, target.teeth, amount),
  };
}

function getSpeechBands(frequencies: Uint8Array): { low: number; mid: number; high: number } {
  const low = averageRange(frequencies, 2, 14) / 255;
  const mid = averageRange(frequencies, 14, 48) / 255;
  const high = averageRange(frequencies, 48, 110) / 255;
  return { low: clamp01(low * 2.2), mid: clamp01(mid * 2.1), high: clamp01(high * 2.8) };
}

function averageRange(values: Uint8Array, start: number, end: number): number {
  const cappedEnd = Math.min(end, values.length);
  if (start >= cappedEnd) return 0;
  let total = 0;
  for (let index = start; index < cappedEnd; index += 1) {
    total += values[index];
  }
  return total / (cappedEnd - start);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function newEntry(role: TranscriptEntry["role"], text: string): TranscriptEntry {
  return {
    id: crypto.randomUUID(),
    role,
    text,
    at: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
  };
}
