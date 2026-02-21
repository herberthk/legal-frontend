class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.bufferSize = 48000 * 3; // 3 seconds safety buffer
    this.buffer = new Float32Array(this.bufferSize);

    this.writeIndex = 0;
    this.readIndex = 0;

    this.port.onmessage = (event) => {
      const input = event.data;

      for (let i = 0; i < input.length; i++) {
        this.buffer[this.writeIndex] = input[i];
        this.writeIndex = (this.writeIndex + 1) % this.bufferSize;

        // Prevent overwrite (drop oldest safely)
        if (this.writeIndex === this.readIndex) {
          this.readIndex = (this.readIndex + 128) % this.bufferSize;
        }
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const channel = output[0];

    for (let i = 0; i < channel.length; i++) {
      if (this.readIndex !== this.writeIndex) {
        channel[i] = this.buffer[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
      } else {
        channel[i] = 0; // underrun safety silence
      }
    }

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
