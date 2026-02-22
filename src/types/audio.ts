export interface AudioFeatures {
  /** Overall volume level, 0.0 - 1.0 */
  energy: number;
  /** Bass frequency energy, 0.0 - 1.0 */
  bass: number;
  /** Mid frequency energy, 0.0 - 1.0 */
  mid: number;
  /** Treble frequency energy, 0.0 - 1.0 */
  treble: number;
  /** Spectral centroid (brightness), 0.0 - 1.0 normalized */
  spectralCentroid: number;
  /** Whether a beat was detected this frame */
  beat: boolean;
  /** Current BPM estimate, 0 if unknown */
  bpm: number;
  /** Isolated kick drum energy (60-150Hz), 0.0 - 1.0 */
  kick: number;
  /** Proportional beat strength, 0.0 - 1.0 */
  beatIntensity: number;
  /** Frame-to-frame spectral change (onset/transient detection), 0.0 - 1.0 */
  spectralFlux: number;
}

export const SILENT_AUDIO: AudioFeatures = {
  energy: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  spectralCentroid: 0,
  beat: false,
  bpm: 0,
  kick: 0,
  beatIntensity: 0,
  spectralFlux: 0,
};
