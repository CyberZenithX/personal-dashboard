/**
 * Dev check for the Gemini Live pipeline (needs GEMINI_API_KEY in the environment):
 *   GEMINI_API_KEY=… node scripts/live-test.mjs [model ...]
 * Synthesises a sentence with Gemini TTS, mints an ephemeral token the same way the app does,
 * streams the audio to the Live API and prints the live input transcription.
 */
import { GoogleGenAI, Modality } from '@google/genai';

const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error('Set GEMINI_API_KEY');
const models = process.argv.slice(2).length ? process.argv.slice(2) : ['gemini-3.5-transcribe-live', 'gemini-3.1-flash-live-preview', 'gemini-3.8-live', 'gemini-2.5-flash-native-audio-preview-12-2025'];
const SENTENCE = 'Remind me to send the clinic quote Tuesday morning, and put a call with Bilal on Thursday at four.';

async function tts() {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: SENTENCE }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } }
    })
  });
  const j = await res.json();
  const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error('TTS failed: ' + JSON.stringify(j).slice(0, 300));
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType)?.[1] ?? 24000);
  const buf = Buffer.from(part.inlineData.data, 'base64');
  const src = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
  const ratio = rate / 16000;
  const out = new Int16Array(Math.floor(src.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const p = i * ratio, i0 = Math.floor(p), f = p - i0;
    out[i] = Math.round(src[i0] * (1 - f) + (src[Math.min(i0 + 1, src.length - 1)] * f));
  }
  return Buffer.from(out.buffer);
}

async function mintToken(model) {
  const now = Date.now();
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ uses: 1, expireTime: new Date(now + 10 * 60000).toISOString(), newSessionExpireTime: new Date(now + 60000).toISOString() })
  });
  const j = await res.json();
  if (!j.name) throw new Error('token failed: ' + JSON.stringify(j).slice(0, 300));
  return j.name;
}

const pcm = await tts();
console.log(`audio: ${(pcm.length / 32000).toFixed(1)}s @16k`);

for (const model of models) {
  const t0 = Date.now();
  let transcript = '', audioOut = 0, closed = '';
  try {
    const token = await mintToken(model);
    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });
    const session = await ai.live.connect({
      model,
      config: {
        responseModalities: [model.includes('transcribe') ? Modality.TEXT : Modality.AUDIO],
        inputAudioTranscription: {},
        systemInstruction: 'You are a silent dictation transcriber. Never speak or answer; the user is dictating notes.'
      },
      callbacks: {
        onmessage: (m) => {
          const t = m.serverContent?.inputTranscription?.text;
          if (t) transcript += t;
          if (m.serverContent?.modelTurn?.parts?.some((p) => p.inlineData)) audioOut++;
        },
        onerror: (e) => (closed += 'error:' + (e.message ?? e)),
        onclose: (e) => (closed += 'close:' + (e.code ?? '') + ' ' + (e.reason ?? ''))
      }
    });
    const chunk = 3200; // 100 ms
    for (let i = 0; i < pcm.length; i += chunk) {
      session.sendRealtimeInput({ audio: { data: pcm.subarray(i, i + chunk).toString('base64'), mimeType: 'audio/pcm;rate=16000' } });
      await new Promise((r) => setTimeout(r, 40));
    }
    session.sendRealtimeInput({ audioStreamEnd: true });
    await new Promise((r) => setTimeout(r, 7000));
    session.close();
  } catch (e) {
    closed += 'EXC:' + (e.message ?? e);
  }
  console.log(`\n== ${model} (${((Date.now() - t0) / 1000).toFixed(1)}s)\ntranscript: ${JSON.stringify(transcript.trim())}\nmodel audio chunks: ${audioOut}  ${closed}`);
}
process.exit(0);
