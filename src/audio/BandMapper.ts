import type { BandMapping } from "../types/bands";
import type { ParamDescriptor, ParamValues } from "../types/params";

/**
 * Applies band→param modulation: takes base param values and
 * modulates them with live band levels each frame.
 */
export class BandMapper {
  private mappings: BandMapping[] = [];

  setMappings(mappings: BandMapping[]): void {
    this.mappings = mappings;
  }

  getMappings(): BandMapping[] {
    return this.mappings;
  }

  /**
   * Apply band modulation to base params, returning modulated values.
   * Only number params are modulated; others pass through unchanged.
   */
  apply(
    baseParams: ParamValues,
    bands: Float32Array,
    paramDescriptors: readonly ParamDescriptor[],
  ): ParamValues {
    if (this.mappings.length === 0) return baseParams;

    // Build lookup for param descriptors
    const descMap = new Map<string, ParamDescriptor>();
    for (const d of paramDescriptors) {
      descMap.set(d.key, d);
    }

    const result: ParamValues = { ...baseParams };

    for (const m of this.mappings) {
      const base = baseParams[m.paramKey];
      if (typeof base !== "number") continue;

      const desc = descMap.get(m.paramKey);
      if (!desc || desc.type !== "number") continue;

      const bandVal = bands[m.bandIndex] ?? 0;
      const range = desc.max - desc.min;

      let modulated: number;
      if (m.mode === "add") {
        modulated = base + bandVal * m.amount * range;
      } else {
        // multiply
        modulated = base * (1 + bandVal * m.amount);
      }

      // Clamp to param range
      result[m.paramKey] = Math.max(desc.min, Math.min(desc.max, modulated));
    }

    return result;
  }
}
