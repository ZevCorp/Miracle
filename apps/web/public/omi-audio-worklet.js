// AudioWorklet que reproduce en continuo los bloques de PCM decodificados del
// Omi. Recibe Float32Array por postMessage y los va vaciando en el buffer de
// salida; si se queda sin datos (el Omi no mandó nada a tiempo) rellena con
// silencio en vez de trabarse, para que la sonda de mic-health.ts distinga
// "sin señal" real de un simple hueco de red.
class OmiPcmStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.readOffset = 0;
    this.port.onmessage = (event) => {
      const chunk = event.data;
      if (chunk instanceof Float32Array && chunk.length > 0) {
        this.queue.push(chunk);
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0][0];
    if (!output) return true;
    let written = 0;
    while (written < output.length) {
      const current = this.queue[0];
      if (!current) {
        output.fill(0, written);
        break;
      }
      const available = current.length - this.readOffset;
      const toCopy = Math.min(available, output.length - written);
      output.set(current.subarray(this.readOffset, this.readOffset + toCopy), written);
      written += toCopy;
      this.readOffset += toCopy;
      if (this.readOffset >= current.length) {
        this.queue.shift();
        this.readOffset = 0;
      }
    }
    return true;
  }
}

registerProcessor("omi-pcm-stream-processor", OmiPcmStreamProcessor);
